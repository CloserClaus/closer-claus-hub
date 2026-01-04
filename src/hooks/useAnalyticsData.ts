import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, eachDayOfInterval, startOfDay } from "date-fns";

type Period = '7d' | '30d' | '90d';

const getPeriodDays = (period: Period): number => {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
};

// Platform Admin Analytics
export function usePlatformAnalytics(period: Period) {
  const days = getPeriodDays(period);
  const startDate = subDays(new Date(), days);

  return useQuery({
    queryKey: ['platform-analytics', period],
    queryFn: async () => {
      // Get user growth over time
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      const { data: members } = await supabase
        .from('workspace_members')
        .select('joined_at')
        .gte('joined_at', startDate.toISOString());

      // Get deals for revenue calculation
      const { data: deals } = await supabase
        .from('deals')
        .select('value, stage, closed_at, created_at')
        .gte('created_at', startDate.toISOString());

      // Get commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('rake_amount, created_at, status')
        .gte('created_at', startDate.toISOString());

      // Generate date range
      const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
      
      // Aggregate user growth by day
      const userGrowthData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const agencies = workspaces?.filter(w => {
          const d = new Date(w.created_at);
          return d >= dayStart && d < dayEnd;
        }).length || 0;

        const sdrs = members?.filter(m => {
          const d = new Date(m.joined_at);
          return d >= dayStart && d < dayEnd;
        }).length || 0;

        return { name: dateStr, value: agencies, value2: sdrs };
      });

      // Aggregate revenue by day
      const revenueData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const revenue = commissions?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd && c.status === 'paid';
        }).reduce((sum, c) => sum + Number(c.rake_amount), 0) || 0;

        return { name: dateStr, value: revenue };
      });

      // Deal funnel
      const dealFunnel = [
        { name: 'New', value: deals?.filter(d => d.stage === 'new').length || 0 },
        { name: 'Contacted', value: deals?.filter(d => d.stage === 'contacted').length || 0 },
        { name: 'Discovery', value: deals?.filter(d => d.stage === 'discovery').length || 0 },
        { name: 'Meeting', value: deals?.filter(d => d.stage === 'meeting').length || 0 },
        { name: 'Proposal', value: deals?.filter(d => d.stage === 'proposal').length || 0 },
        { name: 'Won', value: deals?.filter(d => d.stage === 'closed_won').length || 0 },
      ];

      return {
        userGrowth: userGrowthData,
        revenue: revenueData,
        dealFunnel,
        totalAgencies: workspaces?.length || 0,
        totalSDRs: members?.length || 0,
        totalRevenue: commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.rake_amount), 0) || 0,
      };
    }
  });
}

// Agency Owner Analytics
export function useAgencyAnalytics(workspaceId: string | undefined, period: Period) {
  const days = getPeriodDays(period);
  const startDate = subDays(new Date(), days);

  return useQuery({
    queryKey: ['agency-analytics', workspaceId, period],
    enabled: !!workspaceId,
    queryFn: async () => {
      // Get deals
      const { data: deals } = await supabase
        .from('deals')
        .select('value, stage, closed_at, created_at, assigned_to')
        .eq('workspace_id', workspaceId!)
        .gte('created_at', startDate.toISOString());

      // Get commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, rake_amount, created_at, status, sdr_id')
        .eq('workspace_id', workspaceId!)
        .gte('created_at', startDate.toISOString());

      // Get call logs
      const { data: calls } = await supabase
        .from('call_logs')
        .select('created_at, duration_seconds, caller_id, call_status')
        .eq('workspace_id', workspaceId!)
        .gte('created_at', startDate.toISOString());

      // Get team members
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(full_name)')
        .eq('workspace_id', workspaceId!)
        .is('removed_at', null);

      // Generate date range
      const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });

      // Pipeline value over time
      const pipelineData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        
        const value = deals?.filter(d => {
          const created = new Date(d.created_at);
          return created <= dayStart && d.stage !== 'closed_lost';
        }).reduce((sum, d) => sum + Number(d.value), 0) || 0;

        return { name: dateStr, value };
      });

      // Deals by stage
      const dealsByStage = [
        { name: 'New', value: deals?.filter(d => d.stage === 'new').length || 0 },
        { name: 'Contacted', value: deals?.filter(d => d.stage === 'contacted').length || 0 },
        { name: 'Discovery', value: deals?.filter(d => d.stage === 'discovery').length || 0 },
        { name: 'Meeting', value: deals?.filter(d => d.stage === 'meeting').length || 0 },
        { name: 'Proposal', value: deals?.filter(d => d.stage === 'proposal').length || 0 },
        { name: 'Won', value: deals?.filter(d => d.stage === 'closed_won').length || 0 },
      ];

      // SDR performance (deals closed per SDR)
      const sdrPerformance = members?.map(m => {
        const sdrDeals = deals?.filter(d => d.assigned_to === m.user_id && d.stage === 'closed_won').length || 0;
        const sdrCalls = calls?.filter(c => c.caller_id === m.user_id).length || 0;
        return {
          name: (m.profiles as any)?.full_name?.split(' ')[0] || 'Unknown',
          value: sdrDeals,
          value2: sdrCalls,
        };
      }) || [];

      // Commission payouts over time
      const commissionData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const paid = commissions?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd && c.status === 'paid';
        }).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

        return { name: dateStr, value: paid };
      });

      // Call volume over time
      const callVolumeData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const callCount = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd;
        }).length || 0;

        const connectedCount = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd && c.call_status === 'completed';
        }).length || 0;

        return { name: dateStr, value: callCount, value2: connectedCount };
      });

      // Call duration over time (in minutes)
      const callDurationData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const totalSeconds = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd;
        }).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;

        return { name: dateStr, value: Math.round(totalSeconds / 60) };
      });

      // Call status breakdown
      const callStatusBreakdown = [
        { name: 'Completed', value: calls?.filter(c => c.call_status === 'completed').length || 0 },
        { name: 'No Answer', value: calls?.filter(c => c.call_status === 'no-answer').length || 0 },
        { name: 'Busy', value: calls?.filter(c => c.call_status === 'busy').length || 0 },
        { name: 'Failed', value: calls?.filter(c => c.call_status === 'failed').length || 0 },
        { name: 'Other', value: calls?.filter(c => !['completed', 'no-answer', 'busy', 'failed'].includes(c.call_status)).length || 0 },
      ].filter(item => item.value > 0);

      return {
        pipelineValue: pipelineData,
        dealsByStage,
        sdrPerformance,
        commissionPayouts: commissionData,
        callVolume: callVolumeData,
        callDuration: callDurationData,
        callStatusBreakdown,
        totalPipelineValue: deals?.filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won').reduce((sum, d) => sum + Number(d.value), 0) || 0,
        totalCalls: calls?.length || 0,
        totalDealsWon: deals?.filter(d => d.stage === 'closed_won').length || 0,
        totalCallMinutes: Math.round((calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60),
        connectedCallRate: calls?.length ? Math.round((calls.filter(c => c.call_status === 'completed').length / calls.length) * 100) : 0,
      };
    }
  });
}

// SDR Analytics
export function useSDRAnalytics(userId: string | undefined, workspaceId: string | undefined, period: Period) {
  const days = getPeriodDays(period);
  const startDate = subDays(new Date(), days);

  return useQuery({
    queryKey: ['sdr-analytics', userId, workspaceId, period],
    enabled: !!userId && !!workspaceId,
    queryFn: async () => {
      // Get deals assigned to this SDR
      const { data: deals } = await supabase
        .from('deals')
        .select('value, stage, closed_at, created_at')
        .eq('workspace_id', workspaceId!)
        .eq('assigned_to', userId!)
        .gte('created_at', startDate.toISOString());

      // Get commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, created_at, status, paid_at')
        .eq('sdr_id', userId!)
        .gte('created_at', startDate.toISOString());

      // Get call logs
      const { data: calls } = await supabase
        .from('call_logs')
        .select('created_at, duration_seconds, call_status')
        .eq('workspace_id', workspaceId!)
        .eq('caller_id', userId!)
        .gte('created_at', startDate.toISOString());

      // Generate date range
      const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });

      // Earnings over time
      const earningsData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const earned = commissions?.filter(c => {
          const d = new Date(c.paid_at || c.created_at);
          return d >= dayStart && d < dayEnd && c.status === 'paid';
        }).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

        return { name: dateStr, value: earned };
      });

      // Deals closed over time
      const dealsClosedData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const closed = deals?.filter(d => {
          const closedAt = d.closed_at ? new Date(d.closed_at) : null;
          return closedAt && closedAt >= dayStart && closedAt < dayEnd && d.stage === 'closed_won';
        }).length || 0;

        return { name: dateStr, value: closed };
      });

      // Commission status breakdown
      const commissionStatus = [
        { name: 'Paid', value: commissions?.filter(c => c.status === 'paid').length || 0 },
        { name: 'Pending', value: commissions?.filter(c => c.status === 'pending').length || 0 },
        { name: 'Overdue', value: commissions?.filter(c => c.status === 'overdue').length || 0 },
      ];

      // Call volume over time
      const callVolumeData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const callCount = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd;
        }).length || 0;

        const connectedCount = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd && c.call_status === 'completed';
        }).length || 0;

        return { name: dateStr, value: callCount, value2: connectedCount };
      });

      // Call duration over time (in minutes)
      const callDurationData = dateRange.map(date => {
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));
        
        const totalSeconds = calls?.filter(c => {
          const d = new Date(c.created_at);
          return d >= dayStart && d < dayEnd;
        }).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;

        return { name: dateStr, value: Math.round(totalSeconds / 60) };
      });

      // Call status breakdown
      const callStatusBreakdown = [
        { name: 'Completed', value: calls?.filter(c => c.call_status === 'completed').length || 0 },
        { name: 'No Answer', value: calls?.filter(c => c.call_status === 'no-answer').length || 0 },
        { name: 'Busy', value: calls?.filter(c => c.call_status === 'busy').length || 0 },
        { name: 'Failed', value: calls?.filter(c => c.call_status === 'failed').length || 0 },
        { name: 'Other', value: calls?.filter(c => !['completed', 'no-answer', 'busy', 'failed'].includes(c.call_status)).length || 0 },
      ].filter(item => item.value > 0);

      // Calculate call conversion (calls leading to deals)
      const totalCalls = calls?.length || 0;
      const connectedCalls = calls?.filter(c => c.call_status === 'completed').length || 0;
      const conversionRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;

      return {
        earnings: earningsData,
        dealsClosed: dealsClosedData,
        commissionStatus,
        callVolume: callVolumeData,
        callDuration: callDurationData,
        callStatusBreakdown,
        totalEarnings: commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0) || 0,
        pendingEarnings: commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0) || 0,
        callConversionRate: conversionRate,
        totalDeals: deals?.filter(d => d.stage === 'closed_won').length || 0,
        totalCalls,
        totalCallMinutes: Math.round((calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60),
      };
    }
  });
}

// Recent Activity
export function useRecentActivity(workspaceId: string | undefined, userId: string | undefined, role: string | undefined) {
  return useQuery({
    queryKey: ['recent-activity', workspaceId, userId, role],
    enabled: !!userId,
    queryFn: async () => {
      const activities: any[] = [];
      
      // Get recent deals
      let dealsQuery = supabase
        .from('deals')
        .select('id, title, stage, created_at, value')
        .order('created_at', { ascending: false })
        .limit(5);

      if (workspaceId && role !== 'platform_admin') {
        dealsQuery = dealsQuery.eq('workspace_id', workspaceId);
      }

      const { data: deals } = await dealsQuery;

      deals?.forEach(deal => {
        activities.push({
          id: `deal-${deal.id}`,
          type: 'deal',
          title: deal.title,
          description: `Deal worth $${Number(deal.value).toLocaleString()} - ${deal.stage.replace('_', ' ')}`,
          timestamp: deal.created_at,
        });
      });

      // Get recent commissions
      let commissionsQuery = supabase
        .from('commissions')
        .select('id, amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (role === 'sdr') {
        commissionsQuery = commissionsQuery.eq('sdr_id', userId!);
      } else if (workspaceId && role !== 'platform_admin') {
        commissionsQuery = commissionsQuery.eq('workspace_id', workspaceId);
      }

      const { data: commissions } = await commissionsQuery;

      commissions?.forEach(commission => {
        activities.push({
          id: `commission-${commission.id}`,
          type: 'commission',
          title: `Commission ${commission.status}`,
          description: `$${Number(commission.amount).toLocaleString()} commission`,
          timestamp: commission.created_at,
        });
      });

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, 8);
    }
  });
}
