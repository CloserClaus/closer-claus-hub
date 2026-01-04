import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';

export type CallPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface CallAnalyticsStats {
  totalCalls: number;
  connectedCalls: number;
  connectRate: number;
  callsOver2Min: number;
  callsOver6Min: number;
  totalMinutes: number;
  avgDuration: number;
}

interface UseCallAnalyticsOptions {
  workspaceId?: string;
  userId?: string;
  period: CallPeriod;
  customStartDate?: Date;
  customEndDate?: Date;
  isAgency?: boolean;
}

function getDateRange(period: CallPeriod, customStartDate?: Date, customEndDate?: Date): { start: Date; end: Date } {
  const now = new Date();
  const end = customEndDate || now;
  
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: now };
    case '7d':
      return { start: subDays(now, 7), end: now };
    case '30d':
      return { start: subDays(now, 30), end: now };
    case '90d':
      return { start: subDays(now, 90), end: now };
    case 'custom':
      return { 
        start: customStartDate || subDays(now, 30), 
        end: customEndDate || now 
      };
    default:
      return { start: subDays(now, 30), end: now };
  }
}

export function useCallAnalytics({
  workspaceId,
  userId,
  period,
  customStartDate,
  customEndDate,
  isAgency = false,
}: UseCallAnalyticsOptions) {
  return useQuery({
    queryKey: ['call-analytics', workspaceId, userId, period, customStartDate?.toISOString(), customEndDate?.toISOString(), isAgency],
    queryFn: async (): Promise<CallAnalyticsStats> => {
      const { start, end } = getDateRange(period, customStartDate, customEndDate);
      
      let query = supabase
        .from('call_logs')
        .select('duration_seconds, call_status')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      if (isAgency && workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      } else if (userId) {
        query = query.eq('caller_id', userId);
      }
      
      const { data: calls, error } = await query;
      
      if (error) throw error;
      
      const callList = calls || [];
      const totalCalls = callList.length;
      const connectedCalls = callList.filter(c => c.call_status === 'completed').length;
      const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
      const callsOver2Min = callList.filter(c => (c.duration_seconds || 0) >= 120).length;
      const callsOver6Min = callList.filter(c => (c.duration_seconds || 0) >= 360).length;
      const totalSeconds = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const totalMinutes = Math.round(totalSeconds / 60);
      const avgDuration = totalCalls > 0 ? Math.round(totalSeconds / totalCalls) : 0;
      
      return {
        totalCalls,
        connectedCalls,
        connectRate,
        callsOver2Min,
        callsOver6Min,
        totalMinutes,
        avgDuration,
      };
    },
    enabled: !!(workspaceId || userId),
  });
}
