import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreditsDisplayProps {
  credits: number;
  isLoading?: boolean;
}

export function CreditsDisplay({ credits, isLoading }: CreditsDisplayProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
      <Coins className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Credits:</span>
      {isLoading ? (
        <div className="h-5 w-12 bg-muted animate-pulse rounded" />
      ) : (
        <Badge variant="secondary" className="font-mono">
          {credits.toLocaleString()}
        </Badge>
      )}
    </div>
  );
}
