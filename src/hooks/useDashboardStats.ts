import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

interface PlatformAdminStats {
  agencies: number;
  sdrs: number;
  pendingDisputes: number;
  revenue: number;
  pendingPayouts: number;
  closedDeals: number;
}

interface AgencyOwnerStats {
  teamSize: number;
  pipelineValue: number;
  pendingCommissions: number;
  callsLast7Days: number;
  activeDeals: number;
  closeRate: number;
  // Call analytics
  totalCallMinutes: number;
  avgCallDuration: number;
  callsToday: number;
  connectedCallRate: number;
}

interface SDRStats {
  workspaces: number;
  totalEarnings: number;
  pendingPayouts: number;
  callsLast7Days: number;
  closedDealsLast30Days: number;
  openJobs: number;
  // Call analytics
  totalCallMinutes: number;
  avgCallDuration: number;
  callsToday: number;
  connectedCallRate: number;
}

export function usePlatformAdminStats() {
  return useQuery({
    queryKey: ['platform-admin-stats'],
    queryFn: async (): Promise<PlatformAdminStats> => {
      const [
        agenciesResult,
        sdrsResult,
        disputesResult,
        revenueResult,
        payoutsResult,
        dealsResult,
      ] = await Promise.all([
        // Count agencies (workspaces)
        supabase.from('workspaces').select('id', { count: 'exact', head: true }),
        // Count SDRs
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'sdr'),
        // Count pending disputes
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        // Sum platform revenue (rake_amount from paid commissions)
        supabase.from('commissions').select('rake_amount').eq('status', 'paid'),
        // Sum pending payouts
        supabase.from('commissions').select('amount').eq('status', 'pending'),
        // Count closed won deals in last 30 days
        supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('stage', 'closed_won')
          .gte('closed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const revenue = revenueResult.data?.reduce((sum, c) => sum + (c.rake_amount || 0), 0) || 0;
      const pendingPayouts = payoutsResult.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      return {
        agencies: agenciesResult.count || 0,
        sdrs: sdrsResult.count || 0,
        pendingDisputes: disputesResult.count || 0,
        revenue,
        pendingPayouts,
        closedDeals: dealsResult.count || 0,
      };
    },
  });
}

export function useAgencyOwnerStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['agency-owner-stats', currentWorkspace?.id],
    queryFn: async (): Promise<AgencyOwnerStats> => {
      if (!currentWorkspace) {
        return { 
          teamSize: 0, pipelineValue: 0, pendingCommissions: 0, callsLast7Days: 0, 
          activeDeals: 0, closeRate: 0, totalCallMinutes: 0, avgCallDuration: 0,
          callsToday: 0, connectedCallRate: 0
        };
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        teamResult,
        pipelineResult,
        commissionsResult,
        callsLast7DaysResult,
        closedWonResult,
        totalDealsResult,
        allCallsResult,
        callsTodayResult,
        activeDealsResult,
      ] = await Promise.all([
        // Team size
        supabase.from('workspace_members').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .is('removed_at', null),
        // Pipeline value (all active deals)
        supabase.from('deals').select('value')
          .eq('workspace_id', currentWorkspace.id)
          .not('stage', 'in', '("closed_won","closed_lost")'),
        // Pending commissions
        supabase.from('commissions').select('amount')
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'pending'),
        // Calls last 7 days (count)
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', sevenDaysAgo),
        // Closed won last 30 days
        supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('stage', 'closed_won')
          .gte('closed_at', thirtyDaysAgo),
        // Total closed deals last 30 days (for close rate)
        supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .in('stage', ['closed_won', 'closed_lost'])
          .gte('closed_at', thirtyDaysAgo),
        // All calls with duration for analytics (last 30 days)
        supabase.from('call_logs').select('duration_seconds, call_status')
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', thirtyDaysAgo),
        // Calls today
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', todayStart.toISOString()),
        // Active deals count (not closed)
        supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .not('stage', 'in', '("closed_won","closed_lost")'),
      ]);

      const pipelineValue = pipelineResult.data?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const pendingCommissions = commissionsResult.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const closedWon = closedWonResult.count || 0;
      const totalClosed = totalDealsResult.count || 0;
      const closeRate = totalClosed > 0 ? Math.round((closedWon / totalClosed) * 100) : 0;

      // Call analytics
      const allCalls = allCallsResult.data || [];
      const totalCallSeconds = allCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const totalCallMinutes = Math.round(totalCallSeconds / 60);
      const avgCallDuration = allCalls.length > 0 ? Math.round(totalCallSeconds / allCalls.length) : 0;
      const connectedCalls = allCalls.filter(c => c.call_status === 'completed').length;
      const connectedCallRate = allCalls.length > 0 ? Math.round((connectedCalls / allCalls.length) * 100) : 0;

      return {
        teamSize: teamResult.count || 0,
        pipelineValue,
        pendingCommissions,
        callsLast7Days: callsLast7DaysResult.count || 0,
        activeDeals: activeDealsResult.count || 0,
        closeRate,
        totalCallMinutes,
        avgCallDuration,
        callsToday: callsTodayResult.count || 0,
        connectedCallRate,
      };
    },
    enabled: !!currentWorkspace,
  });
}

export function useSDRStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sdr-stats', user?.id],
    queryFn: async (): Promise<SDRStats> => {
      if (!user) {
        return { 
          workspaces: 0, totalEarnings: 0, pendingPayouts: 0, callsLast7Days: 0, 
          closedDealsLast30Days: 0, openJobs: 0, totalCallMinutes: 0, avgCallDuration: 0,
          callsToday: 0, connectedCallRate: 0
        };
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        workspacesResult,
        paidCommissionsResult,
        pendingCommissionsResult,
        callsLast7DaysResult,
        dealsResult,
        jobsResult,
        allCallsResult,
        callsTodayResult,
      ] = await Promise.all([
        // Active workspaces
        supabase.from('workspace_members').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('removed_at', null),
        // Total paid earnings
        supabase.from('commissions').select('amount').eq('sdr_id', user.id).eq('status', 'paid'),
        // Pending payouts
        supabase.from('commissions').select('amount').eq('sdr_id', user.id).eq('status', 'pending'),
        // Calls last 7 days (count)
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .eq('caller_id', user.id)
          .gte('created_at', sevenDaysAgo),
        // Closed deals last 30 days
        supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .eq('stage', 'closed_won')
          .gte('closed_at', thirtyDaysAgo),
        // Open jobs
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true),
        // All calls with duration for analytics (last 30 days)
        supabase.from('call_logs').select('duration_seconds, call_status')
          .eq('caller_id', user.id)
          .gte('created_at', thirtyDaysAgo),
        // Calls today
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .eq('caller_id', user.id)
          .gte('created_at', todayStart.toISOString()),
      ]);

      const totalEarnings = paidCommissionsResult.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const pendingPayouts = pendingCommissionsResult.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // Call analytics
      const allCalls = allCallsResult.data || [];
      const totalCallSeconds = allCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const totalCallMinutes = Math.round(totalCallSeconds / 60);
      const avgCallDuration = allCalls.length > 0 ? Math.round(totalCallSeconds / allCalls.length) : 0;
      const connectedCalls = allCalls.filter(c => c.call_status === 'completed').length;
      const connectedCallRate = allCalls.length > 0 ? Math.round((connectedCalls / allCalls.length) * 100) : 0;

      return {
        workspaces: workspacesResult.count || 0,
        totalEarnings,
        pendingPayouts,
        callsLast7Days: callsLast7DaysResult.count || 0,
        closedDealsLast30Days: dealsResult.count || 0,
        openJobs: jobsResult.count || 0,
        totalCallMinutes,
        avgCallDuration,
        callsToday: callsTodayResult.count || 0,
        connectedCallRate,
      };
    },
    enabled: !!user,
  });
}
