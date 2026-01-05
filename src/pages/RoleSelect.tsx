import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoFull from '@/assets/logo-full.png';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export default function RoleSelect() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const { user, userRole, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (userRole) {
      navigate('/dashboard');
      return;
    }

    const assignRole = async () => {
      // First check if user already has a role (handles page refresh/duplicate attempts)
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRole) {
        // User already has a role, refresh and navigate
        await refreshProfile();
        navigate('/onboarding');
        return;
      }

      // Check if this is the first user (becomes platform admin)
      const { data: isFirst } = await supabase.rpc('is_first_user');
      
      if (isFirst === true) {
        setIsFirstUser(true);
        setIsLoading(false);
        return; // Show confirmation for first user
      }

      // Get the signup role from user metadata
      const signupRole = user.user_metadata?.signup_role as 'agency_owner' | 'sdr' | undefined;

      if (signupRole) {
        // Use server-side edge function for secure role assignment
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            throw new Error('No active session');
          }

          const response = await supabase.functions.invoke('assign-role', {
            body: { requestedRole: signupRole },
          });

          // Handle edge function errors - check both error object and data for error responses
          if (response.error) {
            const errorMessage = response.error.message || '';
            const dataError = (response.data as any)?.error || '';
            
            // If role already assigned (409), just continue to onboarding
            if (errorMessage.includes('already has a role') || dataError.includes('already has a role')) {
              await refreshProfile();
              navigate('/onboarding');
              return;
            }
            throw new Error(errorMessage || dataError || 'Failed to assign role');
          }
          
          // Also check if the response data itself indicates an error (edge function returned error in body)
          if (response.data?.error) {
            if (response.data.error.includes('already has a role')) {
              await refreshProfile();
              navigate('/onboarding');
              return;
            }
            throw new Error(response.data.error);
          }

          await refreshProfile();

          toast({
            title: 'Welcome to Closer Claus!',
            description: signupRole === 'agency_owner' 
              ? 'Complete your agency setup.'
              : 'Start browsing jobs!',
          });

          navigate('/onboarding');
        } catch (error: any) {
          console.error('Role assignment error:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Failed to set up your account.',
          });
          setIsLoading(false);
        }
      } else {
        // Fallback: if no signup role in metadata, show loading briefly then redirect to onboarding
        // This handles legacy signups or edge cases
        setIsLoading(false);
        toast({
          variant: 'destructive',
          title: 'Setup Error',
          description: 'Please sign up again to complete registration.',
        });
        navigate('/auth');
      }
    };

    assignRole();
  }, [user, userRole, navigate, refreshProfile, toast]);

  const handleFirstUserSetup = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Check for existing role first
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRole) {
        await refreshProfile();
        navigate('/onboarding');
        return;
      }

      // Use server-side edge function for secure role assignment
      const response = await supabase.functions.invoke('assign-role', {
        body: { requestedRole: 'platform_admin' },
      });

      // Handle edge function errors
      if (response.error) {
        const errorMessage = response.error.message || '';
        const dataError = (response.data as any)?.error || '';
        
        // Check if first user was already assigned
        if (errorMessage.includes('already has a role') || dataError.includes('already has a role')) {
          await refreshProfile();
          navigate('/onboarding');
          return;
        }
        throw new Error(errorMessage || dataError || 'Failed to assign role');
      }
      
      // Also check if the response data itself indicates an error
      if (response.data?.error) {
        if (response.data.error.includes('already has a role')) {
          await refreshProfile();
          navigate('/onboarding');
          return;
        }
        throw new Error(response.data.error);
      }

      await refreshProfile();

      toast({
        title: 'Welcome, Platform Admin!',
        description: 'You have full access to manage the platform.',
      });

      navigate('/onboarding');
    } catch (error: any) {
      console.error('First user setup error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to set up admin account.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isFirstUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto mb-6 object-contain" />
          <p className="text-muted-foreground animate-pulse">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // First user confirmation screen
  if (isFirstUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md animate-fade-in relative">
          <div className="text-center mb-8">
            <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto object-contain mb-6" />
          </div>

          <Card className="glass border-primary/50">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold mb-2">You're the First User!</h1>
                <p className="text-muted-foreground">
                  You'll be assigned as the Platform Admin with full system access.
                </p>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground text-left">
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
                onClick={handleFirstUserSetup}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
              >
                {isLoading ? 'Setting up...' : 'Continue as Platform Admin'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}