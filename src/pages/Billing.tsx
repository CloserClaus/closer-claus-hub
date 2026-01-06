import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Zap, Crown, Rocket, ArrowUpRight, Calendar, CheckCircle, AlertCircle, Loader2, Download, ExternalLink, Clock, FileText, RefreshCw, XCircle } from 'lucide-react';
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
import { format, addDays } from 'date-fns';

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

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  status: string;
  created: number;
  paid_at: number | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string;
  type: 'subscription' | 'commission';
}

interface UpcomingCharge {
  id: string;
  deal_title: string;
  amount: number;
  auto_charge_date: string;
  sdr_name: string | null;
  status: string;
}

interface FailedPayment {
  id: string;
  deal_title: string;
  amount: number;
  sdr_name: string | null;
  created_at: string;
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [upcomingCharges, setUpcomingCharges] = useState<UpcomingCharge[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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
      fetchInvoices();
      fetchUpcomingCharges();
      fetchFailedPayments();
    }
  }, [currentWorkspace]);

  const fetchInvoices = async () => {
    if (!currentWorkspace) return;
    setInvoicesLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-invoices', {
        body: { workspace_id: currentWorkspace.id, limit: 20 },
      });

      if (error) throw error;
      setInvoices(data?.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchUpcomingCharges = async () => {
    if (!currentWorkspace) return;
    setUpcomingLoading(true);

    try {
      // Fetch pending commissions that will be auto-charged
      const { data: pendingCommissions, error } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          rake_amount,
          agency_rake_amount,
          created_at,
          deal:deals(title),
          sdr_id
        `)
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['pending', 'overdue'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get SDR names
      const sdrIds = [...new Set(pendingCommissions?.map(c => c.sdr_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sdrIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const charges: UpcomingCharge[] = (pendingCommissions || []).map(c => ({
        id: c.id,
        deal_title: c.deal?.title || 'Deal',
        amount: Number(c.amount) + Number(c.agency_rake_amount ?? c.rake_amount ?? 0),
        auto_charge_date: addDays(new Date(c.created_at), 7).toISOString(),
        sdr_name: profileMap.get(c.sdr_id) || null,
        status: 'pending',
      }));

      setUpcomingCharges(charges);
    } catch (error) {
      console.error('Error fetching upcoming charges:', error);
    } finally {
      setUpcomingLoading(false);
    }
  };

  const fetchFailedPayments = async () => {
    if (!currentWorkspace) return;
    setFailedLoading(true);

    try {
      // Check notifications for payment_failed type to identify failed commissions
      const { data: failedNotifications } = await supabase
        .from('notifications')
        .select('data')
        .eq('workspace_id', currentWorkspace.id)
        .eq('type', 'payment_failed')
        .order('created_at', { ascending: false })
        .limit(10);

      const failedCommissionIds = failedNotifications
        ?.map(n => (n.data as any)?.commission_id)
        .filter(Boolean) || [];

      if (failedCommissionIds.length === 0) {
        setFailedPayments([]);
        setFailedLoading(false);
        return;
      }

      // Fetch commission details for failed ones that are still unpaid
      const { data: failedCommissions, error } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          rake_amount,
          agency_rake_amount,
          created_at,
          status,
          deal:deals(title),
          sdr_id
        `)
        .in('id', failedCommissionIds)
        .in('status', ['pending', 'overdue']);

      if (error) throw error;

      // Get SDR names
      const sdrIds = [...new Set(failedCommissions?.map(c => c.sdr_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sdrIds.length > 0 ? sdrIds : ['none']);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const failed: FailedPayment[] = (failedCommissions || []).map(c => ({
        id: c.id,
        deal_title: c.deal?.title || 'Deal',
        amount: Number(c.amount) + Number(c.agency_rake_amount ?? c.rake_amount ?? 0),
        sdr_name: profileMap.get(c.sdr_id) || null,
        created_at: c.created_at,
      }));

      setFailedPayments(failed);
    } catch (error) {
      console.error('Error fetching failed payments:', error);
    } finally {
      setFailedLoading(false);
    }
  };

  const handleRetryPayment = async (commissionId: string) => {
    if (!paymentMethod) {
      toast({
        title: "No payment method",
        description: "Please add a payment method first to retry the payment.",
        variant: "destructive",
      });
      return;
    }

    setRetryingId(commissionId);

    try {
      const { data, error } = await supabase.functions.invoke('pay-commission', {
        body: { commission_id: commissionId, auto_charge: true },
      });

      if (error) throw error;

      if (data?.success && data?.auto_charged) {
        toast({
          title: "Payment successful",
          description: `$${data.amount.toFixed(2)} was charged to your saved card.`,
        });
        // Refresh the lists
        fetchUpcomingCharges();
        fetchFailedPayments();
        fetchInvoices();
      } else if (data?.checkout_url) {
        // Redirect to checkout if auto-charge wasn't possible
        window.location.href = data.checkout_url;
      } else if (data?.requires_action) {
        toast({
          title: "Additional authentication required",
          description: "Your card requires 3D Secure. Redirecting to payment page...",
        });
        // Fall back to manual checkout
        const { data: checkoutData } = await supabase.functions.invoke('pay-commission', {
          body: { commission_id: commissionId },
        });
        if (checkoutData?.checkout_url) {
          window.location.href = checkoutData.checkout_url;
        }
      } else if (data?.error === 'card_declined') {
        toast({
          title: "Card declined",
          description: "Please update your payment method and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment failed",
          description: data?.message || "Please try again or use a different payment method.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Retry payment error:', error);
      toast({
        title: "Payment failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

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

        {/* Failed Payments */}
        {failedPayments.length > 0 && (
          <Card className="bg-card border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <CardTitle className="text-lg">Failed Payments</CardTitle>
              </div>
              <CardDescription>These payments failed and need to be retried</CardDescription>
            </CardHeader>
            <CardContent>
              {failedLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {failedPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                          <XCircle className="w-4 h-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{payment.deal_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.sdr_name && `${payment.sdr_name} • `}
                            Failed on {format(new Date(payment.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">${payment.amount.toFixed(2)}</p>
                          <Badge variant="destructive" className="text-xs">Failed</Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleRetryPayment(payment.id)}
                          disabled={retryingId === payment.id}
                          className="gap-1"
                        >
                          {retryingId === payment.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upcoming Auto-Charges */}
        {upcomingCharges.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-lg">Upcoming Auto-Charges</CardTitle>
              </div>
              <CardDescription>Pending commission payments that will be auto-charged</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{charge.deal_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {charge.sdr_name && `${charge.sdr_name} • `}
                            Auto-charges on {format(new Date(charge.auto_charge_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">${charge.amount.toFixed(2)}</p>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Invoice History</CardTitle>
            </div>
            <CardDescription>Download invoices and receipts for your payments</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No invoices yet
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{invoice.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.number && `#${invoice.number} • `}
                          {format(new Date(invoice.created), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">${invoice.amount.toFixed(2)}</p>
                        <Badge variant="secondary" className={`text-xs ${invoice.type === 'subscription' ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}`}>
                          {invoice.type === 'subscription' ? 'Subscription' : 'Commission'}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {invoice.invoice_pdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {invoice.hosted_invoice_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Events */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Billing Events</CardTitle>
            </div>
            <CardDescription>Discounts and other billing events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : billingHistory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No billing events yet
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