import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Flame, Thermometer, Snowflake, HelpCircle } from 'lucide-react';

interface ReadinessBadgeProps {
  verdict: string | null;
  score: number | null;
  signals?: string[] | null;
  compact?: boolean;
}

export function ReadinessBadge({ verdict, score, signals, compact = false }: ReadinessBadgeProps) {
  if (!verdict) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
        <HelpCircle className="h-2.5 w-2.5" />
        {!compact && 'Not evaluated'}
      </Badge>
    );
  }

  const getVerdictStyles = () => {
    switch (verdict) {
      case 'HOT':
        return {
          className: 'bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20',
          icon: <Flame className="h-2.5 w-2.5" />,
        };
      case 'WARM':
        return {
          className: 'bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20',
          icon: <Thermometer className="h-2.5 w-2.5" />,
        };
      case 'COOL':
        return {
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20',
          icon: <Thermometer className="h-2.5 w-2.5" />,
        };
      case 'COLD':
        return {
          className: 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20',
          icon: <Snowflake className="h-2.5 w-2.5" />,
        };
      default:
        return {
          className: 'bg-muted text-muted-foreground',
          icon: <HelpCircle className="h-2.5 w-2.5" />,
        };
    }
  };

  const styles = getVerdictStyles();

  const badgeContent = (
    <Badge variant="outline" className={`text-[10px] gap-1 ${styles.className}`}>
      {styles.icon}
      {verdict}
      {score !== null && !compact && (
        <span className="opacity-70">({score})</span>
      )}
    </Badge>
  );

  if (signals && signals.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[280px]">
            <div className="space-y-1">
              <div className="font-medium text-xs">Signals ({score}/100)</div>
              <ul className="text-xs space-y-0.5">
                {signals.map((signal, i) => (
                  <li key={i} className="text-muted-foreground">• {signal}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}
