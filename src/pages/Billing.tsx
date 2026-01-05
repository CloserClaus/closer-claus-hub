import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Zap, Crown, Rocket, ArrowUpRight, Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { format } from 'date-fns';

interface PlanInfo {
  id: 'omega' | 'beta' | 'alpha';
  name: string;
  monthlyPrice: number;
  maxSdrs: number;
  rakePercentage: number;
  icon: React.ComponentType<{ className?: string }>;
}

const plans: PlanInfo[] = [
  { id: 'omega', name: 'Omega', monthlyPrice: 247, maxSdrs: 1, rakePercentage: 2, icon: Zap },
  { id: 'beta', name: 'Beta', monthlyPrice: 347, maxSdrs: 2, rakePercentage: 1.5, icon: Crown },
  { id: 'alpha', name: 'Alpha', monthlyPrice: 497, maxSdrs: 5, rakePercentage: 1, icon: Rocket },
];

interface BillingEvent {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
}

export default function Billing() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [billingHistory, setBillingHistory] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sdrCount, setSdrCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (userRole !== 'agency_owner') {
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);

  useEffect(() => {
    if (currentWorkspace) {
      fetchBillingData();
      fetchPaymentMethod();
    }
  }, [currentWorkspace]);

  const fetchPaymentMethod = async () => {
    if (!currentWorkspace) return;
    setPaymentMethodLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-payment-method', {
        body: { workspace_id: currentWorkspace.id },
      });

      if (error) throw error;
      setPaymentMethod(data?.payment_method || null);
    } catch (error) {
      console.error('Error fetching payment method:', error);
    } finally {
      setPaymentMethodLoading(false);
    }
  };

  const fetchBillingData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      // Fetch SDR count
      const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .is('removed_at', null);

      setSdrCount(count || 0);

      // Fetch coupon redemptions as billing history
      const { data: redemptions } = await supabase
        .from('coupon_redemptions')
        .select('*, coupons(code)')
        .eq('workspace_id', currentWorkspace.id)
        .order('redeemed_at', { ascending: false });

      const history: BillingEvent[] = [];

      // Add subscription activation as first event
      if (currentWorkspace.subscription_status === 'active' && currentWorkspace.subscription_tier) {
        const plan = plans.find(p => p.id === currentWorkspace.subscription_tier);
        history.push({
          id: 'subscription-active',
          type: 'Subscription',
          description: `${plan?.name || 'Plan'} subscription activated`,
          amount: plan?.monthlyPrice || 0,
          date: new Date().toISOString(),
          status: 'completed',
        });
      }

      // Add coupon redemptions
      if (redemptions) {
        redemptions.forEach((r: any) => {
          history.push({
            id: r.id,
            type: 'Discount',
            description: `Coupon ${r.coupons?.code || 'applied'}`,
            amount: -r.discount_applied,
            date: r.redeemed_at,
            status: 'completed',
          });
        });
      }

      setBillingHistory(history);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = plans.find(p => p.id === currentWorkspace?.subscription_tier);
  const CurrentPlanIcon = currentPlan?.icon || Zap;

  const handleChangePlan = () => {
    navigate(`/subscription?workspace=${currentWorkspace?.id}`);
  };

  const canDowngrade = (targetPlan: PlanInfo) => {
    return sdrCount <= targetPlan.maxSdrs;
  };

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Billing" />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
            <p className="text-muted-foreground mt-1">
              Manage your subscription plan and billing information
            </p>
          </div>

        {/* Current Plan */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CurrentPlanIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Current Plan</CardTitle>
                  <CardDescription>
                    {currentWorkspace.subscription_status === 'active' ? 'Active subscription' : 'No active subscription'}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant={currentWorkspace.subscription_status === 'active' ? 'default' : 'secondary'}
                className={currentWorkspace.subscription_status === 'active' ? 'bg-success/20 text-success border-0' : ''}
              >
                {currentWorkspace.subscription_status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentPlan ? (
              <>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="text-xl font-semibold text-foreground">{currentPlan.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Monthly Price</p>
                    <p className="text-xl font-semibold text-foreground">${currentPlan.monthlyPrice}/mo</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Platform Fee</p>
                    <p className="text-xl font-semibold text-foreground">{currentPlan.rakePercentage}% per deal</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Capacity</p>
                    <p className="text-foreground">
                      <span className="font-semibold">{sdrCount}</span> of{' '}
                      <span className="font-semibold">{currentPlan.maxSdrs}</span> SDR slots used
                    </p>
                  </div>
                  <Button onClick={handleChangePlan} variant="outline" className="gap-2">
                    Change Plan
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">You don't have an active subscription</p>
                <Button onClick={handleChangePlan}>
                  Choose a Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Available Plans</CardTitle>
            <CardDescription>Compare plans and upgrade or downgrade anytime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isCurrent = plan.id === currentWorkspace.subscription_tier;
                const canSwitch = canDowngrade(plan);

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isCurrent 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{plan.name}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="ml-auto text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">
                      ${plan.monthlyPrice}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {plan.maxSdrs} SDR{plan.maxSdrs > 1 ? 's' : ''} • {plan.rakePercentage}% fee
                    </p>
                    {!isCurrent && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={handleChangePlan}
                        disabled={!canSwitch}
                      >
                        {!canSwitch ? `Need ${plan.maxSdrs} SDR max` : plan.monthlyPrice > (currentPlan?.monthlyPrice || 0) ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Billing History</CardTitle>
            </div>
            <CardDescription>Your recent billing events and transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : billingHistory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No billing history yet
              </div>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {event.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-medium ${event.amount < 0 ? 'text-success' : 'text-foreground'}`}>
                      {event.amount < 0 ? '-' : ''}${Math.abs(event.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </div>
            <CardDescription>Your saved payment method for automatic charges</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethodLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : paymentMethod ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 rounded bg-background flex items-center justify-center">
                    <span className="text-xs font-medium uppercase text-foreground">
                      {paymentMethod.brand}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      •••• •••• •••• {paymentMethod.last4}
                    </p>
                    {paymentMethod.exp_month && paymentMethod.exp_year && (
                      <p className="text-xs text-muted-foreground">
                        Expires {paymentMethod.exp_month.toString().padStart(2, '0')}/{paymentMethod.exp_year.toString().slice(-2)}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-success/20 text-success border-0">
                  Default
                </Badge>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 rounded bg-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
                    ••••
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No payment method saved. Complete a payment to save your card.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </main>
    </DashboardLayout>
  );
}