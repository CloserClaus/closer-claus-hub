import { useState, useRef, useCallback, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

// Haptic feedback utility
const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 25,
      heavy: 40,
    };
    navigator.vibrate(patterns[style]);
  }
};

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
      setHasTriggeredHaptic(false);
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance to the pull
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);

      // Trigger haptic when crossing threshold
      if (distance >= threshold && !hasTriggeredHaptic) {
        triggerHaptic('medium');
        setHasTriggeredHaptic(true);
      } else if (distance < threshold && hasTriggeredHaptic) {
        setHasTriggeredHaptic(false);
      }
    }
  }, [isRefreshing, hasTriggeredHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      triggerHaptic('heavy');
      setIsRefreshing(true);
      setPullDistance(60);
      
      try {
        await onRefresh();
      } finally {
        triggerHaptic('light');
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    setHasTriggeredHaptic(false);
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const scale = 0.5 + (progress * 0.5);
  const opacity = Math.min(pullDistance / 40, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator - only visible on mobile */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center justify-center md:hidden pointer-events-none"
        style={{
          top: Math.max(pullDistance - 50, -50),
          opacity: opacity,
          transition: isPulling.current ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div 
          className={cn(
            "w-11 h-11 rounded-full bg-card/95 backdrop-blur-lg border border-border shadow-lg flex items-center justify-center",
            isRefreshing && "bg-primary/10 border-primary/30",
            progress >= 1 && !isRefreshing && "bg-primary/10 border-primary/30"
          )}
          style={{
            transform: `scale(${scale})`,
            transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5 transition-colors duration-200",
              isRefreshing ? "text-primary animate-spin" : progress >= 1 ? "text-primary" : "text-muted-foreground"
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
              transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Release to refresh text */}
      {progress >= 1 && !isRefreshing && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-10 md:hidden pointer-events-none"
          style={{
            top: pullDistance + 20,
            opacity: opacity,
          }}
        >
          <span className="text-xs font-medium text-primary animate-pulse">
            Release to refresh
          </span>
        </div>
      )}

      {/* Refreshing text */}
      {isRefreshing && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-10 md:hidden pointer-events-none animate-fade-in"
          style={{
            top: pullDistance + 20,
          }}
        >
          <span className="text-xs font-medium text-primary">
            Refreshing...
          </span>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
