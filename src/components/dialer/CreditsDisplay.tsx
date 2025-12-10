import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreditsDisplayProps {
  credits: number;
  isLoading?: boolean;
}

// Convert credits to minutes (assuming 1 credit = 1 minute for simplicity)
const creditsToMinutes = (credits: number): string => {
  const hours = Math.floor(credits / 60);
  const mins = credits % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export function CreditsDisplay({ credits, isLoading }: CreditsDisplayProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Call Time:</span>
      {isLoading ? (
        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
      ) : (
        <Badge variant="secondary" className="font-mono">
          {creditsToMinutes(credits)}
        </Badge>
      )}
    </div>
  );
}
