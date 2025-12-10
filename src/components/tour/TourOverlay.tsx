import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles, MousePointer2, Hand, Target } from 'lucide-react';
import { useTour } from './TourProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
}

interface HotspotPosition {
  target: string;
  label: string;
  description: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [hotspotPositions, setHotspotPositions] = useState<HotspotPosition[]>([]);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [actionCompleted, setActionCompleted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  // Trigger haptic feedback
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = { light: 10, medium: 20, heavy: 40 };
      navigator.vibrate(patterns[intensity]);
    }
  }, []);

  // Handle spotlight click for interactive actions
  const handleSpotlightClick = useCallback(() => {
    if (step?.action === 'click' && !actionCompleted) {
      setActionCompleted(true);
      triggerHaptic('medium');
      
      // Auto-advance after action completion
      setTimeout(() => {
        nextStep();
        setActionCompleted(false);
      }, 800);
    }
  }, [step, actionCompleted, nextStep, triggerHaptic]);

  // Handle hotspot click
  const handleHotspotClick = useCallback((hotspotTarget: string) => {
    triggerHaptic('light');
    setActiveHotspot(activeHotspot === hotspotTarget ? null : hotspotTarget);
  }, [activeHotspot, triggerHaptic]);

  useEffect(() => {
    if (!isActive || !step) {
      setIsVisible(false);
      setActionCompleted(false);
      setActiveHotspot(null);
      return;
    }

    // Small delay for animation
    const showTimeout = setTimeout(() => setIsVisible(true), 50);

    const updatePosition = () => {
      const target = document.querySelector(step.target);
      if (!target) {
        setSpotlight(null);
        setTooltipPos({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 150,
        });
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = step.spotlightPadding ?? 8;

      setSpotlight({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate hotspot positions
      if (step.hotspots) {
        const positions: HotspotPosition[] = [];
        step.hotspots.forEach((hotspot) => {
          const hotspotEl = document.querySelector(hotspot.target);
          if (hotspotEl) {
            const hotspotRect = hotspotEl.getBoundingClientRect();
            positions.push({
              ...hotspot,
              top: hotspotRect.top,
              left: hotspotRect.left,
              width: hotspotRect.width,
              height: hotspotRect.height,
            });
          }
        });
        setHotspotPositions(positions);
      } else {
        setHotspotPositions([]);
      }

      // Calculate tooltip position
      const tooltipWidth = 320;
      const tooltipHeight = step.action ? 220 : 180;
      const margin = 16;
      
      let top = 0;
      let left = 0;

      const placement = step.placement || 'bottom';

      switch (placement) {
        case 'top':
          top = rect.top - tooltipHeight - margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - margin;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + margin;
          break;
      }

      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

      setTooltipPos({ top, left });

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearTimeout(showTimeout);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, step, currentStep]);

  if (!isActive || !step) return null;

  const hasAction = step.action && !actionCompleted;
  const actionIcon = step.action === 'click' ? MousePointer2 : step.action === 'hover' ? Hand : Target;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="12"
                fill="black"
                className="transition-all duration-300 ease-out"
              />
            )}
            {/* Cutouts for hotspots */}
            {hotspotPositions.map((hotspot, i) => (
              <circle
                key={i}
                cx={hotspot.left + hotspot.width / 2}
                cy={hotspot.top + hotspot.height / 2}
                r={Math.max(hotspot.width, hotspot.height) / 2 + 8}
                fill="black"
                className="transition-all duration-300 ease-out"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border glow with interactive click area */}
      {spotlight && (
        <div
          onClick={handleSpotlightClick}
          className={cn(
            "absolute rounded-xl border-2 transition-all duration-300 ease-out",
            hasAction 
              ? "border-primary cursor-pointer shadow-[0_0_40px_rgba(74,123,247,0.6)] animate-pulse" 
              : "border-primary shadow-[0_0_30px_rgba(74,123,247,0.5)] pointer-events-none"
          )}
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        >
          {/* Action indicator */}
          {hasAction && (
            <div className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-primary flex items-center justify-center animate-bounce shadow-lg">
              {actionIcon && <MousePointer2 className="h-4 w-4 text-primary-foreground" />}
            </div>
          )}
          
          {/* Ripple effect on action complete */}
          {actionCompleted && (
            <div className="absolute inset-0 rounded-xl">
              <div className="absolute inset-0 rounded-xl border-4 border-green-500 animate-ping opacity-75" />
              <div className="absolute inset-0 rounded-xl bg-green-500/20 animate-fade-in" />
            </div>
          )}
        </div>
      )}

      {/* Hotspots */}
      {hotspotPositions.map((hotspot, index) => (
        <div
          key={hotspot.target}
          className="absolute"
          style={{
            top: hotspot.top + hotspot.height / 2,
            left: hotspot.left + hotspot.width / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Pulsing hotspot indicator */}
          <button
            onClick={() => handleHotspotClick(hotspot.target)}
            className={cn(
              "relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200",
              "bg-accent/90 hover:bg-accent hover:scale-110 active:scale-95",
              "shadow-[0_0_20px_rgba(74,123,247,0.5)]"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
            
            {/* Hotspot number */}
            <span className="relative z-10 text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
          </button>

          {/* Hotspot tooltip */}
          {activeHotspot === hotspot.target && (
            <div 
              className={cn(
                "absolute z-10 w-56 p-3 rounded-lg bg-card border border-border shadow-xl",
                "animate-scale-in origin-top",
                index % 2 === 0 ? "left-full ml-3 top-0" : "right-full mr-3 top-0"
              )}
            >
              <h4 className="font-semibold text-sm text-foreground mb-1">
                {hotspot.label}
              </h4>
              <p className="text-xs text-muted-foreground">
                {hotspot.description}
              </p>
              <div 
                className={cn(
                  "absolute top-3 w-2 h-2 bg-card border-border rotate-45",
                  index % 2 === 0 
                    ? "-left-1 border-l border-b" 
                    : "-right-1 border-r border-t"
                )}
              />
            </div>
          )}
        </div>
      ))}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                <p className="text-[10px] text-muted-foreground">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={skipTour}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.content}
          </p>
          
          {/* Action prompt */}
          {hasAction && (
            <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MousePointer2 className="h-3 w-3 text-primary" />
              </div>
              <p className="text-xs text-primary font-medium">
                {step.actionLabel || 'Click the highlighted area to continue'}
              </p>
            </div>
          )}
          
          {/* Hotspot hint */}
          {hotspotPositions.length > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Target className="h-3 w-3 text-accent-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Click the numbered hotspots to learn more
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-2 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={skipTour}
            className="text-xs text-muted-foreground"
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={prevStep}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={nextStep}
              className="h-8"
              disabled={hasAction}
            >
              {currentStep === steps.length - 1 ? (
                'Finish'
              ) : hasAction ? (
                'Complete action'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
