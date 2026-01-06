import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, User, Phone, Banknote, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import logoFull from '@/assets/logo-full.png';

const agencyOnboardingSchema = z.object({
  workspaceName: z.string().min(2, 'Agency name must be at least 2 characters'),
  phone: z.string().optional(),
});

const sdrOnboardingSchema = z.object({
  phone: z.string().optional(),
});

type AgencyFormData = z.infer<typeof agencyOnboardingSchema>;
type SDRFormData = z.infer<typeof sdrOnboardingSchema>;

export default function Onboarding() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, userRole, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAgencyOwner = userRole === 'agency_owner';
  const isPlatformAdmin = userRole === 'platform_admin';

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!userRole) {
      navigate('/role-select');
      return;
    }

    if (profile?.onboarding_completed) {
      navigate('/dashboard');
    }
  }, [user, userRole, profile, navigate]);

  const agencyForm = useForm<AgencyFormData>({
    resolver: zodResolver(agencyOnboardingSchema),
    defaultValues: {
      workspaceName: '',
      phone: '',
    },
  });

  const sdrForm = useForm<SDRFormData>({
    resolver: zodResolver(sdrOnboardingSchema),
    defaultValues: {
      phone: '',
    },
  });

  const handleAgencyOnboarding = async (data: AgencyFormData) => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Create workspace for agency owner
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: data.workspaceName,
          owner_id: user.id,
          subscription_status: 'inactive',
        });

      if (workspaceError) throw workspaceError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: data.phone || null,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();

      toast({
        title: 'Welcome to Closer Claus!',
        description: 'Your agency has been set up successfully.',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete onboarding.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSDROnboarding = async (data: SDRFormData) => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Update profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: data.phone || null,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();

      toast({
        title: 'Welcome to Closer Claus!',
        description: 'Setting up your payout account...',
      });

      // Create Stripe Connect account and redirect to onboarding
      try {
        const { data: connectData, error: connectError } = await supabase.functions.invoke('create-connect-account', {
          body: { return_url: `${window.location.origin}/dashboard?connect_success=true` },
        });

        if (connectError) {
          console.error('Stripe Connect error:', connectError);
          // Don't block onboarding if Connect fails, they can set it up later
          navigate('/dashboard');
          return;
        }

        if (connectData?.onboarding_url) {
          // Redirect to Stripe onboarding
          window.location.href = connectData.onboarding_url;
        } else {
          navigate('/dashboard');
        }
      } catch (connectErr) {
        console.error('Error creating Connect account:', connectErr);
        // Don't block onboarding, redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete onboarding.',
      });
      setIsLoading(false);
    }
  };

  const handleAdminOnboarding = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();

      toast({
        title: 'Welcome, Platform Admin!',
        description: 'You have full access to manage the platform.',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete onboarding.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg animate-fade-in relative">
        <div className="text-center mb-8">
          <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto object-contain mb-6" />
          <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
          <p className="text-muted-foreground">
            {isPlatformAdmin && "You're all set as Platform Admin!"}
            {isAgencyOwner && "Set up your agency to get started"}
            {userRole === 'sdr' && "Add a few details to complete your profile"}
          </p>
        </div>

        {isPlatformAdmin ? (
          <Card className="glass">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Platform Admin Access</CardTitle>
              <CardDescription>
                You have full administrative access to the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  View and manage all agencies
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  Monitor all conversations
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  Resolve disputes
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  Manage SDR payouts
                </div>
              </div>
              <Button 
                onClick={handleAdminOnboarding}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isLoading ? 'Setting up...' : 'Go to Dashboard'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : isAgencyOwner ? (
          <Card className="glass">
            <CardHeader>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Agency Setup</CardTitle>
              <CardDescription>
                Create your agency workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...agencyForm}>
                <form onSubmit={agencyForm.handleSubmit(handleAgencyOnboarding)} className="space-y-6">
                  <FormField
                    control={agencyForm.control}
                    name="workspaceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agency Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Acme Sales Agency" 
                            {...field}
                            className="bg-muted border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={agencyForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="+1 (555) 000-0000" 
                              {...field}
                              className="bg-muted border-border pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? 'Creating agency...' : 'Create Agency'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass">
            <CardHeader>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>SDR Profile</CardTitle>
              <CardDescription>
                Complete your profile and connect your bank to receive payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...sdrForm}>
                <form onSubmit={sdrForm.handleSubmit(handleSDROnboarding)} className="space-y-6">
                  <FormField
                    control={sdrForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="+1 (555) 000-0000" 
                              {...field}
                              className="bg-muted border-border pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Bank Connection Info */}
                  <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Banknote className="w-4 h-4 text-primary" />
                      Bank Account Setup
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After completing your profile, you'll be guided through a secure bank account setup to receive commission payouts automatically.
                    </p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Complete Profile & Connect Bank
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
