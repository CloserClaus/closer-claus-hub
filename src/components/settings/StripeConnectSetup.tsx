import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, CheckCircle, AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StripeConnectSetupProps {
  onStatusChange?: (status: string) => void;
}

export function StripeConnectSetup({ onStatusChange }: StripeConnectSetupProps) {
  const { profile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isGettingDashboard, setIsGettingDashboard] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const connectStatus = (profile as any)?.stripe_connect_status || 'not_connected';
  const connectAccountId = (profile as any)?.stripe_connect_account_id;

  // Handle return from Stripe onboarding
  useEffect(() => {
    const connectSuccess = searchParams.get('connect_success');
    const connectRefresh = searchParams.get('connect_refresh');

    if (connectSuccess === 'true') {
      toast({
        title: 'Bank Account Connected!',
        description: 'Your bank account has been successfully connected. You can now receive payouts.',
      });
      refreshProfile();
      // Clean up URL params
      searchParams.delete('connect_success');
      setSearchParams(searchParams);
    }

    if (connectRefresh === 'true') {
      toast({
        title: 'Complete Your Setup',
        description: 'Please complete the bank account setup to receive payouts.',
        variant: 'default',
      });
      // Clean up URL params
      searchParams.delete('connect_refresh');
      setSearchParams(searchParams);
    }
  }, [searchParams, refreshProfile, toast, setSearchParams]);

  const handleConnectBank = async () => {
    setIsCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: { return_url: `${window.location.origin}/settings?connect_success=true` },
      });

      if (error) throw error;

      if (data?.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else {
        throw new Error('No onboarding URL received');
      }
    } catch (error: any) {
      console.error('Error connecting bank:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error.message || 'Failed to start bank connection. Please try again.',
      });
      setIsCreatingAccount(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-onboarding-link', {
        body: { return_url: `${window.location.origin}/settings?connect_success=true` },
      });

      if (error) throw error;

      if (data?.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else {
        throw new Error('No onboarding URL received');
      }
    } catch (error: any) {
      console.error('Error getting onboarding link:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Resume Setup',
        description: error.message || 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDashboard = async () => {
    setIsGettingDashboard(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-connect-dashboard-link');

      if (error) throw error;

      if (data?.dashboard_url) {
        window.open(data.dashboard_url, '_blank');
      } else {
        throw new Error('No dashboard URL received');
      }
    } catch (error: any) {
      console.error('Error getting dashboard link:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Open Dashboard',
        description: error.message || 'Please try again later.',
      });
    } finally {
      setIsGettingDashboard(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectStatus) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Connected</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending Setup</Badge>;
      case 'restricted':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Action Required</Badge>;
      default:
        return <Badge variant="secondary">Not Connected</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (connectStatus) {
      case 'active':
        return <CheckCircle className="h-8 w-8 text-success" />;
      case 'pending':
      case 'restricted':
        return <AlertCircle className="h-8 w-8 text-warning" />;
      default:
        return <Banknote className="h-8 w-8 text-muted-foreground" />;
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              {getStatusIcon()}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Bank Account for Payouts
                {getStatusBadge()}
              </CardTitle>
              <CardDescription className="mt-1">
                {connectStatus === 'active' 
                  ? 'Your bank account is connected and ready to receive commission payouts.'
                  : connectStatus === 'pending'
                  ? 'Complete your bank account setup to start receiving payouts.'
                  : 'Connect your bank account to receive commission payouts automatically.'}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {connectStatus === 'not_connected' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h4 className="font-medium text-sm">Why connect your bank?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Receive commission payouts automatically
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Fast direct deposits to your bank
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  View payout history and tax documents
                </li>
              </ul>
            </div>
            <Button 
              onClick={handleConnectBank} 
              disabled={isCreatingAccount}
              className="w-full"
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Connect Bank Account
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Powered by Stripe. Your banking details are secure.
            </p>
          </div>
        )}

        {connectStatus === 'pending' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm text-warning">
                Your bank account setup is incomplete. Please complete it to receive payouts.
              </p>
            </div>
            <Button 
              onClick={handleContinueOnboarding} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        )}

        {connectStatus === 'restricted' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Your account requires attention. Please update your information to continue receiving payouts.
              </p>
            </div>
            <Button 
              onClick={handleContinueOnboarding} 
              disabled={isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Update Information
                </>
              )}
            </Button>
          </div>
        )}

        {connectStatus === 'active' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-success">
                ✓ Your bank account is connected and verified. Payouts will be deposited automatically.
              </p>
            </div>
            <Button 
              onClick={handleViewDashboard} 
              disabled={isGettingDashboard}
              variant="outline"
              className="w-full"
            >
              {isGettingDashboard ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Payout Dashboard
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              View your payout history, update bank details, or download tax forms.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
