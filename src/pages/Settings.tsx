import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, CreditCard, TrendingUp, Camera, Loader2, Zap, Crown, Rocket, ArrowUpRight, Calendar, CheckCircle, AlertCircle, ArrowUp, ArrowDown, Banknote } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SDRLevelBadge, getSDRLevelInfo, getNextLevelThreshold } from '@/components/ui/sdr-level-badge';
import { useSDRLevel } from '@/components/SDRLevelProgress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspace } from '@/hooks/useWorkspace';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StripeConnectSetup } from '@/components/settings/StripeConnectSetup';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

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

export default function Settings() {
  const { user, profile, userRole, refreshProfile } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [sdrCount, setSdrCount] = useState(0);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [confirmPlanChange, setConfirmPlanChange] = useState<PlanInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Fetch billing data when workspace changes
  useEffect(() => {
    if (currentWorkspace && userRole === 'agency_owner') {
      fetchBillingData();
      fetchPaymentMethod();
    }
  }, [currentWorkspace, userRole]);

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

  const handleManagePaymentMethod = async () => {
    if (!currentWorkspace) return;
    setOpeningPortal(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal', {
        body: {
          workspace_id: currentWorkspace.id,
          return_url: window.location.href,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to open payment settings',
        description: error.message || 'Please try again later.',
      });
      setOpeningPortal(false);
    }
  };

  const fetchBillingData = async () => {
    if (!currentWorkspace) return;
    setBillingLoading(true);

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
      setBillingLoading(false);
    }
  };

  const currentPlan = plans.find(p => p.id === currentWorkspace?.subscription_tier);
  const CurrentPlanIcon = currentPlan?.icon || Zap;

  const handleChangePlan = (plan?: PlanInfo) => {
    // If a specific plan is provided and we have an active subscription, show confirmation
    if (plan && currentWorkspace?.subscription_status === 'active') {
      setConfirmPlanChange(plan);
    } else {
      // Otherwise navigate to subscription page for new subscriptions
      navigate(`/subscription?workspace=${currentWorkspace?.id}`);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!confirmPlanChange || !currentWorkspace) return;
    
    setChangingPlan(confirmPlanChange.id);
    setConfirmPlanChange(null);

    try {
      const { data, error } = await supabase.functions.invoke('change-subscription', {
        body: {
          workspace_id: currentWorkspace.id,
          new_tier: confirmPlanChange.id,
          proration_behavior: 'create_prorations',
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Plan Changed Successfully',
        description: data.proration 
          ? `Your plan has been updated. ${data.proration.amount_due > 0 ? `$${data.proration.amount_due.toFixed(2)} will be charged on your next invoice.` : 'A credit will be applied to your next invoice.'}`
          : 'Your plan has been updated with prorated billing.',
      });

      // Refresh the page to show updated plan
      window.location.reload();
    } catch (error: any) {
      console.error('Error changing plan:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Change Plan',
        description: error.message || 'An error occurred while changing your plan.',
      });
    } finally {
      setChangingPlan(null);
    }
  };

  const canDowngrade = (targetPlan: PlanInfo) => {
    return sdrCount <= targetPlan.maxSdrs;
  };

  const getPlanChangeLabel = (targetPlan: PlanInfo) => {
    if (!currentPlan) return 'Select';
    if (targetPlan.monthlyPrice > currentPlan.monthlyPrice) return 'Upgrade';
    if (targetPlan.monthlyPrice < currentPlan.monthlyPrice) return 'Downgrade';
    return 'Current';
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload avatar.',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (data: PasswordFormData) => {
    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      passwordForm.reset();

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to change password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdateProfile = async (data: ProfileFormData) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          phone: data.phone || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update profile.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Settings" />
      <main className="flex-1 p-6">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-muted">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              {userRole === 'sdr' && (
                <TabsTrigger value="payouts" className="gap-2">
                  <Banknote className="h-4 w-4" />
                  Payouts
                </TabsTrigger>
              )}
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              {userRole === 'agency_owner' && (
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="space-y-6">
                {/* SDR Level Card */}
                {userRole === 'sdr' && <SDRLevelCard />}
                
                {/* Avatar Upload Card */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                    <CardDescription>
                      Upload a profile picture to personalize your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Avatar'} />
                          <AvatarFallback className="text-2xl">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Upload a new photo</p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or GIF. Max size 5MB.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                        >
                          {isUploadingAvatar ? 'Uploading...' : 'Choose File'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-4">
                        <div className="space-y-2">
                          <FormLabel>Email Address</FormLabel>
                          <Input 
                            value={profile?.email || user?.email || ''} 
                            disabled
                            className="bg-muted border-border max-w-md opacity-70"
                          />
                          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-muted border-border max-w-md"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="+1 (555) 000-0000"
                                  className="bg-muted border-border max-w-md"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="pt-4">
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* SDR Payouts Tab */}
            {userRole === 'sdr' && (
              <TabsContent value="payouts">
                <div className="space-y-6">
                  <StripeConnectSetup />
                  
                  {/* Payout Info Card */}
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>How Payouts Work</CardTitle>
                      <CardDescription>
                        Understanding your commission payouts
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <h4 className="font-medium text-sm">When do I get paid?</h4>
                          <p className="text-sm text-muted-foreground">
                            Your commission is transferred to your bank automatically after the agency pays the commission. This typically happens within 2-7 business days.
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <h4 className="font-medium text-sm">What fees apply?</h4>
                          <p className="text-sm text-muted-foreground">
                            Standard payment processing fees are deducted from your payout. You can view detailed fee breakdowns in your payout dashboard.
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <h4 className="font-medium text-sm">Can I update my bank?</h4>
                          <p className="text-sm text-muted-foreground">
                            Yes! Click "View Payout Dashboard" above to update your bank account details at any time.
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <h4 className="font-medium text-sm">Tax documents</h4>
                          <p className="text-sm text-muted-foreground">
                            1099 tax forms and other tax documents are available in your payout dashboard at the end of the year.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            <TabsContent value="notifications">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Manage how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Notification settings coming soon.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {userRole === 'agency_owner' && (
              <TabsContent value="billing">
                <div className="space-y-6">
                  {/* Current Plan */}
                  <Card className="glass">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <CurrentPlanIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Current Plan</CardTitle>
                            <CardDescription>
                              {currentWorkspace?.subscription_status === 'active' ? 'Active subscription' : 'No active subscription'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant={currentWorkspace?.subscription_status === 'active' ? 'default' : 'secondary'}
                          className={currentWorkspace?.subscription_status === 'active' ? 'bg-success/20 text-success border-0' : ''}
                        >
                          {currentWorkspace?.subscription_status === 'active' ? 'Active' : 'Inactive'}
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
                            <Button onClick={() => handleChangePlan()} variant="outline" className="gap-2">
                              Change Plan
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-muted-foreground mb-4">You don't have an active subscription</p>
                          <Button onClick={() => handleChangePlan()}>
                            Choose a Plan
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Plan Comparison */}
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle className="text-lg">Available Plans</CardTitle>
                      <CardDescription>Compare plans and upgrade or downgrade anytime</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        {plans.map((plan) => {
                          const Icon = plan.icon;
                          const isCurrent = plan.id === currentWorkspace?.subscription_tier;
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
                                  className="w-full gap-2"
                                  onClick={() => handleChangePlan(plan)}
                                  disabled={!canSwitch || changingPlan === plan.id}
                                >
                                  {changingPlan === plan.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      {getPlanChangeLabel(plan) === 'Upgrade' && <ArrowUp className="w-3 h-3" />}
                                      {getPlanChangeLabel(plan) === 'Downgrade' && <ArrowDown className="w-3 h-3" />}
                                      {!canSwitch ? `Need ${plan.maxSdrs} SDR max` : getPlanChangeLabel(plan)}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing History */}
                  <Card className="glass">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Billing History</CardTitle>
                      </div>
                      <CardDescription>Your recent billing events and transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {billingLoading ? (
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
                  <Card className="glass">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Payment Method</CardTitle>
                      </div>
                      <CardDescription>Your saved payment method for automatic charges</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                      
                      {currentWorkspace?.stripe_customer_id && (
                        <Button
                          variant="outline"
                          onClick={handleManagePaymentMethod}
                          disabled={openingPortal}
                          className="w-full sm:w-auto"
                        >
                          {openingPortal ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Opening...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Manage Payment Method
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            <TabsContent value="security">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password"
                                placeholder="Enter new password"
                                className="bg-muted border-border max-w-md"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password"
                                placeholder="Confirm new password"
                                className="bg-muted border-border max-w-md"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-4">
                        <Button type="submit" disabled={isChangingPassword}>
                          {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Plan Change Confirmation Dialog */}
      <AlertDialog open={!!confirmPlanChange} onOpenChange={(open) => !open && setConfirmPlanChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmPlanChange && currentPlan && confirmPlanChange.monthlyPrice > currentPlan.monthlyPrice 
                ? 'Upgrade' 
                : 'Downgrade'} to {confirmPlanChange?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You're about to change from <strong>{currentPlan?.name}</strong> (${currentPlan?.monthlyPrice}/mo) 
                to <strong>{confirmPlanChange?.name}</strong> (${confirmPlanChange?.monthlyPrice}/mo).
              </p>
              <p>
                {confirmPlanChange && currentPlan && confirmPlanChange.monthlyPrice > currentPlan.monthlyPrice ? (
                  <>
                    The price difference will be <strong>prorated</strong> and added to your next invoice.
                    You'll immediately get access to {confirmPlanChange.maxSdrs} SDR slots.
                  </>
                ) : (
                  <>
                    A <strong>prorated credit</strong> will be applied to your next invoice.
                    Your SDR limit will change to {confirmPlanChange?.maxSdrs}.
                  </>
                )}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPlanChange}>
              Confirm {confirmPlanChange && currentPlan && confirmPlanChange.monthlyPrice > currentPlan.monthlyPrice ? 'Upgrade' : 'Downgrade'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// SDR Level Card Component
function SDRLevelCard() {
  const { data: levelData, isLoading } = useSDRLevel();

  if (isLoading || !levelData) return null;

  const levelInfo = getSDRLevelInfo(levelData.level);
  const Icon = levelInfo.icon;

  return (
    <Card className="glass overflow-hidden">
      <div className={`h-1 ${levelData.level === 3 ? 'bg-yellow-500' : levelData.level === 2 ? 'bg-slate-400' : 'bg-amber-600'}`} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              SDR Level & Progress
            </CardTitle>
            <CardDescription>
              Your performance level and platform fee rate
            </CardDescription>
          </div>
          <SDRLevelBadge level={levelData.level} size="lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Total Deals Closed</p>
            <p className="text-2xl font-bold">${levelData.totalDeals.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Platform Fee Rate</p>
            <p className="text-2xl font-bold text-success">{levelInfo.platformCut}%</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {levelData.level < 3 ? 'To Next Level' : 'Status'}
            </p>
            <p className="text-2xl font-bold">
              {levelData.level < 3 ? `$${levelData.remaining?.toLocaleString() || 0}` : 'Max Level'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress to Level {Math.min(levelData.level + 1, 3)}</span>
            <span>{Math.round(levelData.progressPercent)}%</span>
          </div>
          <Progress value={levelData.progressPercent} className="h-3" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className={`p-2 rounded ${levelData.level >= 1 ? 'bg-amber-600/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 1</p>
            <p className="text-xs">5% fee</p>
          </div>
          <div className={`p-2 rounded ${levelData.level >= 2 ? 'bg-slate-400/20 text-slate-300' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 2</p>
            <p className="text-xs">4% fee • $30K+</p>
          </div>
          <div className={`p-2 rounded ${levelData.level >= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 3</p>
            <p className="text-xs">2.5% fee • $100K+</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
