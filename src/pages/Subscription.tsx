import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Zap, Crown, Rocket, Tag, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

type BillingPeriod = 'monthly' | 'yearly';

interface Plan {
  id: 'omega' | 'beta' | 'alpha';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxSdrs: number;
  rakePercentage: number;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  popular?: boolean;
  bestFor: string;
  teamDescription: string;
}

const plans: Plan[] = [
  {
    id: 'omega',
    name: 'Omega',
    monthlyPrice: 247,
    yearlyPrice: 2497,
    maxSdrs: 1,
    rakePercentage: 2,
    features: [
      'Full CRM access',
      'Manual dialer',
      '1 free phone number',
      '1,000 free minutes/mo',
      'Contract e-signatures',
      'Priority support',
    ],
    icon: Zap,
    bestFor: 'Agencies starting out',
    teamDescription: 'Build your team of 1 SDR',
  },
  {
    id: 'beta',
    name: 'Beta',
    monthlyPrice: 347,
    yearlyPrice: 3497,
    maxSdrs: 2,
    rakePercentage: 1.5,
    features: [
      'Full CRM access',
      'Power dialer',
      '2 free phone numbers',
      '1,000 free minutes/mo',
      'Contract e-signatures',
      'Priority support',
    ],
    icon: Crown,
    popular: true,
    bestFor: 'Growing agencies',
    teamDescription: 'Build your team of 2 SDRs',
  },
  {
    id: 'alpha',
    name: 'Alpha',
    monthlyPrice: 497,
    yearlyPrice: 4997,
    maxSdrs: 5,
    rakePercentage: 1,
    features: [
      'Full CRM access',
      'Power dialer',
      '5 free phone numbers',
      '1,000 free minutes/mo',
      'Contract e-signatures',
      'Dedicated account manager',
    ],
    icon: Rocket,
    bestFor: 'Established agencies',
    teamDescription: 'Build your team of 5 SDRs',
  },
];

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const queryWorkspaceId = searchParams.get('workspace');
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  // Use query param workspace if provided, otherwise use current workspace from context
  const workspaceId = queryWorkspaceId || currentWorkspace?.id;
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isFirstSubscription, setIsFirstSubscription] = useState(true);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const { user, userRole } = useAuth();
  const { hasActiveSubscription } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if this is first-time subscription and get current tier
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!workspaceId) return;
      
      const { data } = await supabase
        .from('workspaces')
        .select('first_subscription_at, subscription_tier, subscription_status')
        .eq('id', workspaceId)
        .single();
      
      // If they have first_subscription_at OR an active subscription, they're not first-time
      setIsFirstSubscription(!data?.first_subscription_at && data?.subscription_status !== 'active');
      if (data?.subscription_status === 'active' && data?.subscription_tier) {
        setCurrentTier(data.subscription_tier);
      } else {
        setCurrentTier(null);
      }
    };
    
    checkSubscriptionStatus();
  }, [workspaceId]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (userRole !== 'agency_owner') {
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);

  // Show loading state while workspace context is loading
  if (workspaceLoading && !queryWorkspaceId) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Subscription" />
        <div className="p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading subscription options...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setIsValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({
          variant: 'destructive',
          title: 'Invalid coupon',
          description: 'This coupon code is not valid or has expired.',
        });
        setAppliedCoupon(null);
        return;
      }

      // Check if max uses reached
      if (data.max_uses && data.current_uses >= data.max_uses) {
        toast({
          variant: 'destructive',
          title: 'Coupon exhausted',
          description: 'This coupon has reached its maximum usage limit.',
        });
        setAppliedCoupon(null);
        return;
      }

      // Check validity period
      const now = new Date();
      if (data.valid_until && new Date(data.valid_until) < now) {
        toast({
          variant: 'destructive',
          title: 'Coupon expired',
          description: 'This coupon has expired.',
        });
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon({
        code: data.code,
        discount: data.discount_percentage,
      });
      
      toast({
        title: 'Coupon applied!',
        description: `${data.discount_percentage}% discount will be applied.`,
      });
    } catch (error) {
      console.error('Error validating coupon:', error);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const getDiscountedPrice = (price: number) => {
    if (!appliedCoupon) return price;
    return Math.round(price * (1 - appliedCoupon.discount / 100));
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user || !workspaceId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Missing workspace information.',
      });
      return;
    }

    setSelectedPlan(planId);
    setIsProcessing(true);

    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan');

      const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
      const discountedPrice = getDiscountedPrice(price);

      // Call create-subscription edge function
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          workspace_id: workspaceId,
          tier: plan.id,
          billing_period: billingPeriod,
          coupon_code: appliedCoupon?.code || null,
          discount_percentage: appliedCoupon?.discount || null,
          is_first_subscription: isFirstSubscription,
          success_url: `${window.location.origin}/dashboard?subscription=success`,
          cancel_url: `${window.location.origin}/subscription?workspace=${workspaceId}&cancelled=true`,
        },
      });

      if (error) throw error;

      // If Stripe checkout URL is returned, redirect to it
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      // If no Stripe checkout URL, treat as an error (we should never activate locally)
      throw new Error(data?.error || 'Unable to start checkout. Please try again.');
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      // Parse the error to provide specific feedback
      let errorMessage = 'Failed to process subscription.';
      if (error?.message?.includes('stripe_not_configured')) {
        errorMessage = 'Payment system is being configured. Please try again in a few minutes or contact support.';
      } else if (error?.message?.includes('non-2xx')) {
        errorMessage = 'Payment service temporarily unavailable. Please try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Subscription Error',
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };


  return (
    <DashboardLayout>
      <DashboardHeader title="Subscription" />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Choose Your Plan
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Scale your agency with the right plan. All plans include full platform access.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as BillingPeriod)}>
              <TabsList className="bg-muted">
                <TabsTrigger value="monthly" className="px-6">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="px-6 gap-2">
                  Yearly
                  <Badge className="bg-success/20 text-success border-0 text-xs font-medium">
                    2 months free
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

        {/* Coupon Input */}
        <div className="max-w-sm mx-auto mb-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={!!appliedCoupon}
                className="pl-10"
              />
            </div>
            {appliedCoupon ? (
              <Button variant="outline" onClick={removeCoupon} size="default">
                Remove
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={validateCoupon}
                disabled={isValidatingCoupon || !couponCode.trim()}
                size="default"
              >
                {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
            )}
          </div>
          {appliedCoupon && (
            <p className="text-sm text-success mt-2 flex items-center gap-1">
              <Check className="w-4 h-4" />
              {appliedCoupon.discount}% discount applied
            </p>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const discountedPrice = getDiscountedPrice(price);
            const hasDiscount = appliedCoupon && discountedPrice < price;
            const isCurrentPlan = currentTier === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative bg-card border-border transition-all duration-200 hover:border-primary/50 ${
                  plan.popular ? 'ring-2 ring-primary border-primary' : ''
                } ${isCurrentPlan ? 'ring-2 ring-success border-success' : ''}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-success text-success-foreground px-3">
                      Current Plan
                    </Badge>
                  </div>
                )}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-8 pb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                    isCurrentPlan ? 'bg-success/10' : 'bg-primary/10'
                  }`}>
                    <Icon className={`w-6 h-6 ${isCurrentPlan ? 'text-success' : 'text-primary'}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Best for: {plan.bestFor}
                  </p>
                </CardHeader>
                <CardContent className="space-y-5 pb-6">
                  {/* SDR Slots Highlight */}
                  <div className="text-center py-3 px-4 rounded-lg bg-muted">
                    <p className="text-sm font-medium text-foreground">
                      {plan.teamDescription}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.rakePercentage}% fee per deal closed
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center py-2">
                    {hasDiscount && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${billingPeriod === 'monthly' && isFirstSubscription ? price * 2 : price}
                      </p>
                    )}
                    <p className="text-3xl font-bold text-foreground">
                      ${billingPeriod === 'monthly' && isFirstSubscription ? discountedPrice * 2 : discountedPrice}
                      {billingPeriod === 'monthly' && isFirstSubscription ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}for 2 months
                        </span>
                      ) : (
                        <span className="text-sm font-normal text-muted-foreground">
                          /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </p>
                    {billingPeriod === 'monthly' && isFirstSubscription && (
                      <p className="text-xs text-primary mt-1">
                        2-month minimum • Then ${discountedPrice}/mo
                      </p>
                    )}
                    {billingPeriod === 'yearly' && (
                      <p className="text-xs text-success mt-1">
                        2 months free
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {isCurrentPlan ? (
                    <Button
                      className="w-full mt-4"
                      variant="outline"
                      disabled
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Active
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-4"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing && selectedPlan === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : currentTier ? (
                        plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentTier) 
                          ? 'Upgrade' 
                          : 'Downgrade'
                      ) : (
                        'Get Started'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          14-day money-back guarantee • Cancel anytime
        </p>
        </div>
      </div>
    </DashboardLayout>
  );
}