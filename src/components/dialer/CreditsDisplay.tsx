import { Clock, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CreditsDisplayProps {
  credits: number;
  freeMinutesRemaining?: number;
  isLoading?: boolean;
}

// Convert credits to minutes display
const creditsToMinutes = (credits: number): string => {
  const hours = Math.floor(credits / 60);
  const mins = credits % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export function CreditsDisplay({ credits, freeMinutesRemaining = 0, isLoading }: CreditsDisplayProps) {
  const freeMinutesPercentage = (freeMinutesRemaining / 1000) * 100;
  const hasFreeMinutes = freeMinutesRemaining > 0;
  const isLowOnFreeMinutes = freeMinutesRemaining <= 100 && freeMinutesRemaining > 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Call Time:</span>
        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Free Minutes Display */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <Gift className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Free Minutes:</span>
            <Badge 
              variant={isLowOnFreeMinutes ? "destructive" : "secondary"} 
              className="font-mono"
            >
              {creditsToMinutes(freeMinutesRemaining)}
            </Badge>
          </div>
          <Progress value={freeMinutesPercentage} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">
            {freeMinutesRemaining} / 1,000 min remaining this month
          </p>
        </div>
      </div>

      {/* Purchased Credits Display */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border flex-wrap">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Purchased:</span>
        <Badge variant="outline" className="font-mono">
          {creditsToMinutes(credits)}
        </Badge>
        <span className="text-xs text-muted-foreground">• Never expires</span>
        {!hasFreeMinutes && credits === 0 && (
          <span className="text-xs text-destructive ml-1">— Add minutes to continue calling</span>
        )}
      </div>
    </div>
  );
}
