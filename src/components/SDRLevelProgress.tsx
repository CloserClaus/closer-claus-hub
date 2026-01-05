import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import { SDRLevelBadge, getSDRLevelInfo, getNextLevelThreshold } from '@/components/ui/sdr-level-badge';
import { cn } from '@/lib/utils';

interface SDRLevelData {
  level: number;
  totalDeals: number;
  progressPercent: number;
  nextLevelThreshold: number | null;
  remaining: number | null;
}

export function useSDRLevel() {
  const { user, userRole } = useAuth();

  return useQuery({
    queryKey: ['sdr-level', user?.id],
    queryFn: async (): Promise<SDRLevelData | null> => {
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('sdr_level, total_deals_closed_value')
        .eq('id', user.id)
        .single();

      if (error || !profile) return null;

      const level = profile.sdr_level || 1;
      const totalDeals = profile.total_deals_closed_value || 0;

      let progressPercent = 0;
      if (level >= 3) {
        progressPercent = 100;
      } else if (level === 1) {
        progressPercent = (totalDeals / 30000) * 100;
      } else {
        progressPercent = ((totalDeals - 30000) / (100000 - 30000)) * 100;
      }

      const nextLevel = getNextLevelThreshold(level, totalDeals);

      return {
        level,
        totalDeals,
        progressPercent: Math.min(100, progressPercent),
        nextLevelThreshold: nextLevel?.nextLevel ? (nextLevel.nextLevel === 2 ? 30000 : 100000) : null,
        remaining: nextLevel?.remaining || null,
      };
    },
    enabled: !!user && userRole === 'sdr',
    staleTime: 30000,
  });
}

interface SDRLevelProgressProps {
  compact?: boolean;
  className?: string;
}

export function SDRLevelProgress({ compact = false, className }: SDRLevelProgressProps) {
  const { data: levelData, isLoading } = useSDRLevel();

  if (isLoading || !levelData) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <SDRLevelBadge level={levelData.level} size="sm" showLabel={false} />
        <div className="flex-1 min-w-0">
          <Progress value={levelData.progressPercent} className="h-1.5" />
        </div>
      </div>
    );
  }

  const levelInfo = getSDRLevelInfo(levelData.level);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <SDRLevelBadge level={levelData.level} size="sm" />
        <span className="text-xs text-muted-foreground">
          ${levelData.totalDeals.toLocaleString()} closed
        </span>
      </div>
      <Progress value={levelData.progressPercent} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        {levelData.level < 3 ? (
          <>
            <span>{levelInfo.platformCut}% platform fee</span>
            <span>${levelData.remaining?.toLocaleString() || 0} to Level {levelData.level + 1}</span>
          </>
        ) : (
          <>
            <span>2.5% platform fee</span>
            <span className="text-success">Max Level Achieved!</span>
          </>
        )}
      </div>
    </div>
  );
}
