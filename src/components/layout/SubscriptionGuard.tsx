import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  feature?: 'jobs' | 'team';
}

export function SubscriptionGuard({ children, feature = 'jobs' }: SubscriptionGuardProps) {
  const { userRole } = useAuth();
  const { currentWorkspace, hasActiveSubscription, loading } = useWorkspace();
  const navigate = useNavigate();

  // Only agency owners need subscription for these features
  if (userRole !== 'agency_owner') {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return null;
  }

  // If agency owner has workspace but no active subscription, show paywall
  if (currentWorkspace && !hasActiveSubscription) {
    const featureText = feature === 'jobs' 
      ? { title: 'Post Jobs', description: 'post job listings and hire SDRs' }
      : { title: 'Manage Team', description: 'manage your team and SDRs' };

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md glass">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              You need an active subscription to {featureText.description}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Subscribe to unlock:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Post unlimited job listings</li>
                <li>Hire and manage SDRs</li>
                <li>Track team performance</li>
                <li>Pay commissions seamlessly</li>
              </ul>
            </div>
            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => navigate(`/subscription?workspace=${currentWorkspace.id}`)}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Choose a Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}