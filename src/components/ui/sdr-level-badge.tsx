import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SDRLevelBadgeProps {
  level: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const levelConfig = {
  1: {
    label: "Bronze",
    icon: Star,
    className: "bg-amber-600/20 text-amber-400 border-amber-600/30",
    iconClassName: "text-amber-400",
    platformCut: 15,
    threshold: 0,
  },
  2: {
    label: "Silver",
    icon: Trophy,
    className: "bg-slate-400/20 text-slate-300 border-slate-400/30",
    iconClassName: "text-slate-300",
    platformCut: 10,
    threshold: 30000,
  },
  3: {
    label: "Gold",
    icon: Crown,
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    iconClassName: "text-yellow-400",
    platformCut: 5,
    threshold: 100000,
  },
};

export function SDRLevelBadge({ level, showLabel = true, size = "md", className }: SDRLevelBadgeProps) {
  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig[1];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, sizeClasses[size], "gap-1", className)}
    >
      <Icon className={cn(iconSizes[size], config.iconClassName)} />
      {showLabel && (
        <span>Level {level} ({config.label})</span>
      )}
    </Badge>
  );
}

export function getSDRLevelInfo(level: number) {
  return levelConfig[level as keyof typeof levelConfig] || levelConfig[1];
}

export function getNextLevelThreshold(level: number, currentTotal: number): { nextLevel: number; remaining: number } | null {
  if (level >= 3) return null;
  
  const nextLevel = level + 1;
  const threshold = levelConfig[nextLevel as keyof typeof levelConfig].threshold;
  const remaining = threshold - currentTotal;
  
  return { nextLevel, remaining: Math.max(0, remaining) };
}
