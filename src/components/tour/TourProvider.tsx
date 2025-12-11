import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
  action?: 'click' | 'hover' | 'focus'; // Interactive action type
  actionLabel?: string; // Label for the action button
  route?: string; // Route to navigate to for this step
  hotspots?: Array<{
    target: string;
    label: string;
    description: string;
  }>;
}

interface TourProgress {
  stepIndex: number;
  tourId: string;
  lastUpdated: number;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: (steps: TourStep[], tourId?: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  hasCompletedTour: boolean;
  markTourComplete: () => void;
  hasSavedProgress: boolean;
  resumeTour: () => void;
  clearSavedProgress: () => void;
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const TOUR_STORAGE_KEY = 'platform-tour-completed';
const TOUR_PROGRESS_KEY = 'platform-tour-progress';
const PROGRESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function TourProvider({ children }: { children: ReactNode }) {
  const { userRole, user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);
  const [currentTourId, setCurrentTourId] = useState<string>('');
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [savedSteps, setSavedSteps] = useState<TourStep[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  // Get storage keys for current user
  const getStorageKeys = useCallback(() => {
    if (!user || !userRole) return null;
    return {
      completed: `${TOUR_STORAGE_KEY}-${user.id}-${userRole}`,
      progress: `${TOUR_PROGRESS_KEY}-${user.id}-${userRole}`,
    };
  }, [user, userRole]);

  // Check if user has completed tour or has saved progress
  useEffect(() => {
    const keys = getStorageKeys();
    if (!keys) return;

    const completed = localStorage.getItem(keys.completed) === 'true';
    setHasCompletedTour(completed);

    // Check for saved progress
    const savedProgressStr = localStorage.getItem(keys.progress);
    if (savedProgressStr && !completed) {
      try {
        const progress: TourProgress = JSON.parse(savedProgressStr);
        const isExpired = Date.now() - progress.lastUpdated > PROGRESS_EXPIRY_MS;
        
        if (!isExpired && progress.stepIndex > 0) {
          setHasSavedProgress(true);
        } else {
          // Clear expired progress
          localStorage.removeItem(keys.progress);
          setHasSavedProgress(false);
        }
      } catch {
        localStorage.removeItem(keys.progress);
        setHasSavedProgress(false);
      }
    } else {
      setHasSavedProgress(false);
    }
  }, [user, userRole, getStorageKeys]);

  // Save progress when step changes
  const saveProgress = useCallback((stepIndex: number, tourId: string) => {
    const keys = getStorageKeys();
    if (!keys || stepIndex === 0) return;

    const progress: TourProgress = {
      stepIndex,
      tourId,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(keys.progress, JSON.stringify(progress));
  }, [getStorageKeys]);

  // Clear saved progress
  const clearSavedProgress = useCallback(() => {
    const keys = getStorageKeys();
    if (keys) {
      localStorage.removeItem(keys.progress);
    }
    setHasSavedProgress(false);
    setSavedSteps([]);
  }, [getStorageKeys]);

  const startTour = useCallback((tourSteps: TourStep[], tourId?: string) => {
    const id = tourId || `tour-${Date.now()}`;
    setSteps(tourSteps);
    setSavedSteps(tourSteps);
    setCurrentStep(0);
    setCurrentTourId(id);
    setIsActive(true);
    clearSavedProgress();
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, [clearSavedProgress]);

  // Resume tour from saved progress
  const resumeTour = useCallback(() => {
    const keys = getStorageKeys();
    if (!keys) return;

    const savedProgressStr = localStorage.getItem(keys.progress);
    if (!savedProgressStr) return;

    try {
      const progress: TourProgress = JSON.parse(savedProgressStr);
      
      // We need the steps to be passed in by the TourTrigger
      if (savedSteps.length > 0) {
        setSteps(savedSteps);
        setCurrentStep(progress.stepIndex);
        setCurrentTourId(progress.tourId);
        setIsActive(true);
        
        if ('vibrate' in navigator) {
          navigator.vibrate(20);
        }
      }
    } catch {
      clearSavedProgress();
    }
  }, [getStorageKeys, savedSteps, clearSavedProgress]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      saveProgress(newStep, currentTourId);
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } else {
      endTour();
    }
  }, [currentStep, steps.length, currentTourId, saveProgress]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      saveProgress(newStep, currentTourId);
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  }, [currentStep, currentTourId, saveProgress]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    setIsNavigating(false);
    // Save progress when skipping so user can resume later
    if (currentStep > 0) {
      saveProgress(currentStep, currentTourId);
      setHasSavedProgress(true);
    }
  }, [currentStep, currentTourId, saveProgress]);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    setIsNavigating(false);
    clearSavedProgress();
    markTourComplete();
  }, [clearSavedProgress]);

  const markTourComplete = useCallback(() => {
    const keys = getStorageKeys();
    if (keys) {
      localStorage.setItem(keys.completed, 'true');
      localStorage.removeItem(keys.progress);
      setHasCompletedTour(true);
      setHasSavedProgress(false);
    }
  }, [getStorageKeys]);

  // Effect to store steps when they're loaded by TourTrigger
  useEffect(() => {
    if (savedSteps.length === 0 && steps.length > 0) {
      setSavedSteps(steps);
    }
  }, [steps, savedSteps.length]);

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
      hasSavedProgress,
      resumeTour,
      clearSavedProgress,
      isNavigating,
      setIsNavigating,
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
