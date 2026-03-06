import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubscriptionGuardProps {
  children: ReactNode;
  feature?: string;
}

export function SubscriptionGuard({ children, feature = 'this feature' }: SubscriptionGuardProps) {
  const { userRole } = useAuth();
  const { currentWorkspace, hasActiveSubscription, loading } = useWorkspace();
  const navigate = useNavigate();

  // Platform admins bypass all guards
  if (userRole === 'platform_admin') return <>{children}</>;

  if (loading) return null;

  const isPastDue = currentWorkspace?.subscription_status === 'past_due';
  const needsSubscription = !hasActiveSubscription && !isPastDue;

  // Calculate days remaining in grace period
  const graceDaysRemaining = isPastDue && currentWorkspace?.grace_period_end
    ? Math.max(0, Math.ceil((new Date(currentWorkspace.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (needsSubscription) {
    return (
      <>
        <div className="pointer-events-none opacity-50 select-none" aria-hidden="true">
          {children}
        </div>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md [&>button.absolute]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-warning" />
              </div>
              <DialogTitle>Subscription Required</DialogTitle>
              <DialogDescription>
                To use {feature}, you need an active subscription plan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Subscribe to unlock:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Leads marketplace & signal scraper</li>
                  <li>Power dialer with call recording</li>
                  <li>Email campaigns & sequences</li>
                  <li>Job posting & SDR hiring</li>
                  <li>Team management & training</li>
                  <li>Contract generation</li>
                </ul>
              </div>
              {currentWorkspace && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/subscription?workspace=${currentWorkspace.id}`)}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Choose a Plan
                </Button>
              )}
              {!currentWorkspace && userRole === 'agency_owner' && (
                <Button
                  className="w-full"
                  onClick={() => navigate('/onboarding')}
                >
                  Complete Setup First
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {isPastDue && (
        <div className="mx-4 mt-4 p-4 rounded-lg border border-warning/50 bg-warning/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">Payment Failed — Action Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your subscription payment failed. Please update your payment method
                {graceDaysRemaining > 0 ? ` within ${graceDaysRemaining} day${graceDaysRemaining !== 1 ? 's' : ''}` : ' immediately'}
                {currentWorkspace?.grace_period_end ? ` (by ${new Date(currentWorkspace.grace_period_end).toLocaleDateString()})` : ''}
                {' '}or your account will be restricted.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-warning/50 text-warning hover:bg-warning/10"
                onClick={() => navigate('/billing')}
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Update Payment Method
              </Button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
