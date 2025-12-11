import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, Sparkles, Play, RotateCcw, X } from 'lucide-react';
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

// Routes where the tour can be triggered
const TOUR_ROUTES = ['/dashboard', '/admin'];

export function TourTrigger() {
  const { userRole, profile } = useAuth();
  const location = useLocation();
  const { 
    startTour, 
    hasCompletedTour, 
    markTourComplete, 
    hasSavedProgress, 
    resumeTour,
    clearSavedProgress,
    isActive
  } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showResume, setShowResume] = useState(false);

  // Check if we're on a valid tour route
  const isOnTourRoute = TOUR_ROUTES.some(route => location.pathname.startsWith(route));
  
  // Check if user has completed onboarding
  const hasCompletedOnboarding = profile?.onboarding_completed === true;

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

  // Store steps for potential resume when component mounts
  useEffect(() => {
    const steps = getTourSteps();
    if (steps.length > 0 && hasSavedProgress) {
      // Trigger a re-render with saved steps available
    }
  }, [userRole, hasSavedProgress]);

  // Show welcome dialog for first-time users (only on valid routes and after onboarding)
  useEffect(() => {
    if (
      !hasCompletedTour && 
      userRole && 
      !hasSavedProgress && 
      isOnTourRoute && 
      hasCompletedOnboarding &&
      !isActive
    ) {
      const timer = setTimeout(() => setShowWelcome(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour, userRole, hasSavedProgress, isOnTourRoute, hasCompletedOnboarding, isActive]);

  // Show resume dialog if there's saved progress (only on valid routes)
  useEffect(() => {
    if (hasSavedProgress && userRole && !hasCompletedTour && isOnTourRoute && !isActive) {
      const timer = setTimeout(() => setShowResume(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSavedProgress, userRole, hasCompletedTour, isOnTourRoute, isActive]);

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
    setShowResume(false);
    const steps = getTourSteps();
    if (steps.length > 0) {
      startTour(steps, `${userRole}-tour`);
    }
  };

  const handleResumeTour = () => {
    setShowResume(false);
    setShowHelp(false);
    // First set the steps, then resume
    const steps = getTourSteps();
    if (steps.length > 0) {
      // Store steps and then resume
      startTour(steps, `${userRole}-tour`);
      // Actually resume from saved position
      setTimeout(() => resumeTour(), 50);
    }
  };

  const handleSkipTour = () => {
    setShowWelcome(false);
    setShowResume(false);
    markTourComplete();
  };

  const handleDismissResume = () => {
    setShowResume(false);
    clearSavedProgress();
    markTourComplete();
  };

  // Don't render anything if not on a valid route or onboarding not complete
  if (!isOnTourRoute || !hasCompletedOnboarding) {
    return null;
  }

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

      {/* Resume Tour Dialog */}
      <Dialog open={showResume} onOpenChange={setShowResume}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-amber-500" />
            </div>
            <DialogTitle className="text-center text-xl">
              Welcome Back!
            </DialogTitle>
            <DialogDescription className="text-center">
              You have an unfinished tour. Would you like to continue where you left off?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tour in Progress</p>
                  <p className="text-xs text-muted-foreground">
                    Your progress has been saved
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              className="w-full sm:w-auto text-muted-foreground"
              onClick={handleDismissResume}
            >
              <X className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleStartTour}
            >
              Start Over
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleResumeTour}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Tour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Button (always visible on tour routes) */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-6",
          "bg-card/95 backdrop-blur-lg border-border hover:border-primary hover:bg-primary/10",
          "transition-all duration-200",
          hasSavedProgress && "border-amber-500/50 animate-pulse"
        )}
        onClick={() => setShowHelp(true)}
      >
        <HelpCircle className="h-5 w-5" />
        {hasSavedProgress && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-background" />
        )}
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
            {hasSavedProgress && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3 border-amber-500/30 hover:border-amber-500/50"
                onClick={handleResumeTour}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Play className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Resume Tour</p>
                    <p className="text-xs text-muted-foreground">
                      Continue where you left off
                    </p>
                  </div>
                </div>
              </Button>
            )}
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
                  <p className="font-medium">{hasSavedProgress ? 'Start Over' : 'Take the Tour'}</p>
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
