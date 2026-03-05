import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

interface SubscriptionGuardProps {
  children: ReactNode;
  feature?: string;
}

export function SubscriptionGuard({ children, feature = 'this feature' }: SubscriptionGuardProps) {
  const { userRole } = useAuth();
  const { currentWorkspace, hasActiveSubscription, loading } = useWorkspace();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Platform admins bypass all guards
  if (userRole === 'platform_admin') return <>{children}</>;

  if (loading) return null;

  // SDRs inherit subscription from their workspace
  // Agency owners need their own subscription
  const needsSubscription = !hasActiveSubscription;

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

  return <>{children}</>;
}
