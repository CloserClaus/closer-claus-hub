import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Zap, Crown, Rocket, Tag, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import logoFull from '@/assets/logo-full.png';

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
      '1 SDR slot',
      'Full CRM access',
      'Dialer integration',
      'Contract e-signatures',
      'Training materials',
      '2% platform rake',
    ],
    icon: Zap,
  },
  {
    id: 'beta',
    name: 'Beta',
    monthlyPrice: 347,
    yearlyPrice: 3497,
    maxSdrs: 2,
    rakePercentage: 1.5,
    features: [
      '2 SDR slots',
      'Full CRM access',
      'Dialer integration',
      'Contract e-signatures',
      'Training materials',
      '1.5% platform rake',
      'Priority support',
    ],
    icon: Crown,
    popular: true,
  },
  {
    id: 'alpha',
    name: 'Alpha',
    monthlyPrice: 497,
    yearlyPrice: 4997,
    maxSdrs: 5,
    rakePercentage: 1,
    features: [
      '5 SDR slots',
      'Full CRM access',
      'Dialer integration',
      'Contract e-signatures',
      'Training materials',
      '1% platform rake',
      'Priority support',
      'Dedicated account manager',
    ],
    icon: Rocket,
  },
];

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (userRole !== 'agency_owner') {
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);

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

      // Update workspace with subscription info
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .update({
          subscription_tier: plan.id,
          subscription_status: 'active', // Will be 'pending' until Stripe confirms
          max_sdrs: plan.maxSdrs,
          rake_percentage: plan.rakePercentage,
        })
        .eq('id', workspaceId);

      if (workspaceError) throw workspaceError;

      // Record coupon redemption if applicable
      if (appliedCoupon) {
        const { data: couponData } = await supabase
          .from('coupons')
          .select('id')
          .eq('code', appliedCoupon.code)
          .single();

        if (couponData) {
          await supabase.from('coupon_redemptions').insert({
            coupon_id: couponData.id,
            workspace_id: workspaceId,
            discount_applied: price - discountedPrice,
          });
        }
      }

      // TODO: Integrate with Stripe for actual payment processing
      // For now, we'll mark subscription as active
      // In production, this would redirect to Stripe Checkout

      toast({
        title: 'Subscription activated!',
        description: `You're now on the ${plan.name} plan.`,
      });

      // Mark onboarding as complete
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to process subscription.',
      });
    } finally {
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  const yearlySavings = (plan: Plan) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const yearlyCost = plan.yearlyPrice;
    return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-10">
          <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto object-contain mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Select the plan that fits your agency's needs. All plans include full access to the platform.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as BillingPeriod)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly
                <Badge variant="secondary" className="ml-2 bg-success/20 text-success text-xs">
                  Save up to 16%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Coupon Input */}
        <div className="max-w-md mx-auto mb-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={!!appliedCoupon}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>
            {appliedCoupon ? (
              <Button variant="outline" onClick={removeCoupon}>
                Remove
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={validateCoupon}
                disabled={isValidatingCoupon || !couponCode.trim()}
              >
                {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
            )}
          </div>
          {appliedCoupon && (
            <p className="text-sm text-success mt-2 flex items-center gap-1">
              <Check className="w-4 h-4" />
              {appliedCoupon.discount}% discount applied with code {appliedCoupon.code}
            </p>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const discountedPrice = getDiscountedPrice(price);
            const hasDiscount = appliedCoupon && discountedPrice < price;

            return (
              <Card
                key={plan.id}
                className={`relative glass transition-all duration-300 hover:scale-[1.02] ${
                  plan.popular ? 'ring-2 ring-primary glow' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    Up to {plan.maxSdrs} SDR{plan.maxSdrs > 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    {hasDiscount && (
                      <p className="text-lg text-muted-foreground line-through">
                        ${price}
                      </p>
                    )}
                    <p className="text-4xl font-bold">
                      ${discountedPrice}
                      <span className="text-lg font-normal text-muted-foreground">
                        /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </p>
                    {billingPeriod === 'yearly' && (
                      <p className="text-sm text-success mt-1">
                        Save {yearlySavings(plan)}% vs monthly
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing && selectedPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Get ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a 14-day money-back guarantee. Cancel anytime.
        </p>
      </div>
    </div>
  );
}