import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Confetti } from '@/components/ui/confetti';
import { SDRLevelBadge, getSDRLevelInfo } from '@/components/ui/sdr-level-badge';
import { Crown, Trophy, Star, ArrowUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LevelUpCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  oldLevel: number;
  newLevel: number;
  totalDeals: number;
}

export function LevelUpCelebration({ 
  isOpen, 
  onClose, 
  oldLevel, 
  newLevel,
  totalDeals 
}: LevelUpCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const newLevelInfo = getSDRLevelInfo(newLevel);
  const Icon = newLevelInfo.icon;

  useEffect(() => {
    if (isOpen) {
      // Trigger confetti after a short delay
      const timer = setTimeout(() => setShowConfetti(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
    }
  }, [isOpen]);

  return (
    <>
      <Confetti isActive={showConfetti} duration={4000} pieceCount={80} />
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md border-0 bg-gradient-to-b from-background to-background/95 overflow-hidden">
          {/* Animated background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse",
                newLevel === 3 ? "bg-yellow-500" : "bg-slate-400"
              )} 
            />
          </div>

          <div className="relative flex flex-col items-center text-center py-6 space-y-6">
            {/* Celebration Icon */}
            <div className="relative">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center animate-scale-in",
                newLevel === 3 ? "bg-yellow-500/20" : "bg-slate-400/20"
              )}>
                <Icon className={cn(
                  "w-12 h-12",
                  newLevel === 3 ? "text-yellow-400" : "text-slate-300"
                )} />
              </div>
              <div className="absolute -top-2 -right-2 animate-bounce">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2 animate-fade-in">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Level Up!
              </h2>
              <p className="text-muted-foreground">
                You've reached a new milestone
              </p>
            </div>

            {/* Level Transition */}
            <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <SDRLevelBadge level={oldLevel} size="lg" />
              <ArrowUp className="w-6 h-6 text-success animate-bounce" />
              <SDRLevelBadge level={newLevel} size="lg" />
            </div>

            {/* Benefits */}
            <div 
              className="bg-muted/50 rounded-lg p-4 w-full space-y-3 animate-fade-in" 
              style={{ animationDelay: '0.4s' }}
            >
              <h3 className="font-semibold flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Your New Benefits
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span className="font-medium text-success">
                    {newLevel === 3 ? '2.5%' : newLevel === 2 ? '4%' : '5%'} 
                    <span className="text-muted-foreground ml-1">
                      (was {oldLevel === 2 ? '4%' : '5%'})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Deals Closed</span>
                  <span className="font-medium">${totalDeals.toLocaleString()}</span>
                </div>
                {newLevel < 3 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Level At</span>
                    <span className="font-medium">
                      ${(newLevel === 2 ? 100000 : 30000).toLocaleString()}
                    </span>
                  </div>
                )}
                {newLevel === 3 && (
                  <p className="text-center text-success font-medium pt-2">
                    🎉 You've reached the highest level!
                  </p>
                )}
              </div>
            </div>

            {/* CTA */}
            <Button 
              onClick={onClose} 
              size="lg" 
              className="w-full animate-fade-in"
              style={{ animationDelay: '0.6s' }}
            >
              Keep Closing Deals!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
