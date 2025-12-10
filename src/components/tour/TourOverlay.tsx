import { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
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

export function TourOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive || !step) {
      setIsVisible(false);
      return;
    }

    // Small delay for animation
    const showTimeout = setTimeout(() => setIsVisible(true), 50);

    const updatePosition = () => {
      const target = document.querySelector(step.target);
      if (!target) {
        // If target not found, center the tooltip
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

      // Calculate tooltip position
      const tooltipWidth = 320;
      const tooltipHeight = 180;
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

      // Keep tooltip in viewport
      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

      setTooltipPos({ top, left });

      // Scroll target into view if needed
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

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full">
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

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="absolute rounded-xl border-2 border-primary shadow-[0_0_30px_rgba(74,123,247,0.5)] transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

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
            >
              {currentStep === steps.length - 1 ? (
                'Finish'
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
