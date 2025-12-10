import { useEffect, useState } from 'react';
import { HelpCircle, Sparkles, X } from 'lucide-react';
import { useTour } from './TourProvider';
import { useAuth } from '@/hooks/useAuth';
import { platformAdminTourSteps, agencyOwnerTourSteps, sdrTourSteps } from './tourSteps';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function TourTrigger() {
  const { userRole } = useAuth();
  const { startTour, hasCompletedTour, markTourComplete } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Show welcome dialog for first-time users
  useEffect(() => {
    if (!hasCompletedTour && userRole) {
      const timer = setTimeout(() => setShowWelcome(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour, userRole]);

  const getTourSteps = () => {
    switch (userRole) {
      case 'platform_admin':
        return platformAdminTourSteps;
      case 'agency_owner':
        return agencyOwnerTourSteps;
      case 'sdr':
        return sdrTourSteps;
      default:
        return [];
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'platform_admin':
        return 'Platform Admin';
      case 'agency_owner':
        return 'Agency Owner';
      case 'sdr':
        return 'SDR';
      default:
        return 'User';
    }
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setShowHelp(false);
    const steps = getTourSteps();
    if (steps.length > 0) {
      startTour(steps);
    }
  };

  const handleSkipTour = () => {
    setShowWelcome(false);
    markTourComplete();
  };

  return (
    <>
      {/* Welcome Dialog for First-Time Users */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              Welcome to Closer Claus!
            </DialogTitle>
            <DialogDescription className="text-center">
              You're logged in as <span className="font-medium text-foreground">{getRoleLabel()}</span>. 
              Would you like a quick tour of the platform?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <span>Learn where everything is located</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <span>Discover key features for your role</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <span>Get started in under 2 minutes</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleSkipTour}
            >
              Skip for now
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleStartTour}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start Tour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Button (always visible) */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-6",
          "bg-card/95 backdrop-blur-lg border-border hover:border-primary hover:bg-primary/10",
          "transition-all duration-200"
        )}
        onClick={() => setShowHelp(true)}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Need Help?</DialogTitle>
            <DialogDescription>
              Take a guided tour or explore on your own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleStartTour}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Take the Tour</p>
                  <p className="text-xs text-muted-foreground">
                    Interactive walkthrough
                  </p>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
