import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  hasCompletedTour: boolean;
  markTourComplete: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const TOUR_STORAGE_KEY = 'platform-tour-completed';

export function TourProvider({ children }: { children: ReactNode }) {
  const { userRole, user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);

  // Check if user has completed tour
  useEffect(() => {
    if (user && userRole) {
      const storageKey = `${TOUR_STORAGE_KEY}-${user.id}-${userRole}`;
      const completed = localStorage.getItem(storageKey) === 'true';
      setHasCompletedTour(completed);
    }
  }, [user, userRole]);

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } else {
      endTour();
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    markTourComplete();
  }, []);

  const markTourComplete = useCallback(() => {
    if (user && userRole) {
      const storageKey = `${TOUR_STORAGE_KEY}-${user.id}-${userRole}`;
      localStorage.setItem(storageKey, 'true');
      setHasCompletedTour(true);
    }
  }, [user, userRole]);

  return (
    <TourContext.Provider value={{
      isActive,
      currentStep,
      steps,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      endTour,
      hasCompletedTour,
      markTourComplete,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
