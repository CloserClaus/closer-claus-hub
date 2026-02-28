import { useState, useEffect, useMemo } from 'react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { FilterState } from '@/components/crm/CRMFilters';
import { trackEvent } from '@/lib/eventBus';

export interface Lead {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  assigned_to?: string | null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

export interface Deal {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  assigned_to: string;
  title: string;
  value: number;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  lead_id: string | null;
  deal_id: string | null;
  created_at: string;
}

const DEFAULT_FILTERS: FilterState = {
  stage: '',
  dateRange: '',
  minValue: '',
  maxValue: '',
  hasEmail: '',
  hasPhone: '',
  assignedTo: '',
};

const ITEMS_PER_PAGE = 12;

export function useCRMData() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [leadFilters, setLeadFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [dealFilters, setDealFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Bulk selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Pagination
  const [leadsPage, setLeadsPage] = useState(1);
  const [dealsPage, setDealsPage] = useState(1);

  const isAgencyOwner = userRole === 'agency_owner';

  const fetchTeamMembers = async () => {
    if (!currentWorkspace) return;

    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('id, user_id')
      .eq('workspace_id', currentWorkspace.id)
      .is('removed_at', null);

    if (error || !members || members.length === 0) {
      setTeamMembers([]);
      return;
    }

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    setTeamMembers(
      members.map(m => ({
        id: m.id,
        user_id: m.user_id,
        profile: profileMap.get(m.user_id) || { full_name: null, email: '' },
      }))
    );
  };

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      let leadsQuery = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      
      if (userRole === 'sdr' && user?.id) {
        leadsQuery = leadsQuery.eq('assigned_to', user.id);
      }

      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      let dealsQuery = supabase
        .from('deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (userRole === 'sdr' && user?.id) {
        dealsQuery = dealsQuery.eq('assigned_to', user.id);
      }

      const { data: dealsData, error: dealsError } = await dealsQuery;
      if (dealsError) throw dealsError;
      setDeals(dealsData || []);

      let tasksQuery = supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('due_date', { ascending: true });

      if (userRole === 'sdr' && user?.id) {
        tasksQuery = tasksQuery.eq('assigned_to', user.id);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load CRM data',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch data and set up real-time subscriptions
  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
      if (isAgencyOwner) {
        fetchTeamMembers();
      }

      const dealsChannel = supabase
        .channel('crm-deals-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deals',
            filter: `workspace_id=eq.${currentWorkspace.id}`,
          },
          () => fetchData()
        )
        .subscribe();

      const tasksChannel = supabase
        .channel('crm-tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `workspace_id=eq.${currentWorkspace.id}`,
          },
          () => fetchData()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(dealsChannel);
        supabase.removeChannel(tasksChannel);
      };
    }
  }, [currentWorkspace, isAgencyOwner, userRole, user?.id]);

  // Filter logic
  const getDateThreshold = (dateRange: string): Date | null => {
    const now = new Date();
    switch (dateRange) {
      case 'today': return startOfDay(now);
      case 'week': return startOfWeek(now);
      case 'month': return startOfMonth(now);
      case 'quarter': return startOfQuarter(now);
      default: return null;
    }
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead => {
        const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();
        return fullName.includes(query) || lead.email?.toLowerCase().includes(query) || lead.company?.toLowerCase().includes(query);
      });
    }

    if (leadFilters.dateRange) {
      const threshold = getDateThreshold(leadFilters.dateRange);
      if (threshold) result = result.filter(lead => new Date(lead.created_at) >= threshold);
    }

    if (leadFilters.hasEmail === 'yes') result = result.filter(lead => lead.email);
    else if (leadFilters.hasEmail === 'no') result = result.filter(lead => !lead.email);

    if (leadFilters.hasPhone === 'yes') result = result.filter(lead => lead.phone);
    else if (leadFilters.hasPhone === 'no') result = result.filter(lead => !lead.phone);

    if (leadFilters.assignedTo) {
      if (leadFilters.assignedTo === 'unassigned') result = result.filter(lead => !lead.assigned_to);
      else result = result.filter(lead => lead.assigned_to === leadFilters.assignedTo);
    }

    return result;
  }, [leads, searchQuery, leadFilters]);

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (dealFilters.stage) result = result.filter(deal => deal.stage === dealFilters.stage);

    if (dealFilters.dateRange) {
      const threshold = getDateThreshold(dealFilters.dateRange);
      if (threshold) result = result.filter(deal => new Date(deal.created_at) >= threshold);
    }

    if (dealFilters.minValue) result = result.filter(deal => Number(deal.value) >= Number(dealFilters.minValue));
    if (dealFilters.maxValue) result = result.filter(deal => Number(deal.value) <= Number(dealFilters.maxValue));

    return result;
  }, [deals, dealFilters]);

  // Pagination
  const totalLeadsPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const totalDealsPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);

  const paginatedLeads = useMemo(() => {
    const start = (leadsPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLeads, leadsPage]);

  const paginatedDeals = useMemo(() => {
    const start = (dealsPage - 1) * ITEMS_PER_PAGE;
    return filteredDeals.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDeals, dealsPage]);

  // Reset page when filters change
  useEffect(() => { setLeadsPage(1); }, [searchQuery, leadFilters]);
  useEffect(() => { setDealsPage(1); }, [dealFilters]);

  // Selection helpers
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.size === filteredLeads.length) setSelectedLeadIds(new Set());
    else setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
  };

  const selectAllDeals = () => {
    if (selectedDealIds.size === filteredDeals.length) setSelectedDealIds(new Set());
    else setSelectedDealIds(new Set(filteredDeals.map(d => d.id)));
  };

  // Bulk actions
  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedLeadIds);
      const { error } = await supabase.from('leads').delete().in('id', ids);
      if (error) throw error;
      ids.forEach(id => trackEvent({ event_type: 'lead_deleted', actor_type: 'owner', actor_id: user?.id, organization_id: currentWorkspace?.id, object_type: 'lead', object_id: id }));
      toast({ title: `Deleted ${selectedLeadIds.size} leads` });
      setSelectedLeadIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete leads' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteDeals = async () => {
    if (selectedDealIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase.from('deals').delete().in('id', Array.from(selectedDealIds));
      if (error) throw error;
      toast({ title: `Deleted ${selectedDealIds.size} deals` });
      setSelectedDealIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete deals' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkStageChange = async (stage: string) => {
    if (selectedDealIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const dealIds = Array.from(selectedDealIds);
      const { error } = await supabase
        .from('deals')
        .update({
          stage: stage as any,
          closed_at: ['closed_won', 'closed_lost'].includes(stage) ? new Date().toISOString() : null,
        })
        .in('id', dealIds);

      if (error) throw error;

      dealIds.forEach(id => trackEvent({ event_type: 'deal_stage_changed', actor_type: 'owner', actor_id: user?.id, organization_id: currentWorkspace?.id, object_type: 'deal', object_id: id, metadata: { new_stage: stage } }));

      if (stage === 'closed_won' && currentWorkspace) {
        for (const dealId of dealIds) {
          try {
            await supabase.functions.invoke('create-commission', {
              body: { dealId, workspaceId: currentWorkspace.id },
            });
          } catch (commErr) {
            console.error(`Failed to create commission for deal ${dealId}:`, commErr);
          }
        }
      }

      toast({ title: `Updated ${selectedDealIds.size} deals to ${stage.replace('_', ' ')}` });
      setSelectedDealIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update deals' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssignLeads = async (assignToUserId: string | null) => {
    if (selectedLeadIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const leadIdsArray = Array.from(selectedLeadIds);
      const { error } = await supabase.from('leads').update({ assigned_to: assignToUserId }).in('id', leadIdsArray);
      if (error) throw error;

      leadIdsArray.forEach(id => trackEvent({ event_type: 'lead_assigned', actor_type: 'owner', actor_id: user?.id, organization_id: currentWorkspace?.id, object_type: 'lead', object_id: id, metadata: { assigned_to: assignToUserId } }));

      if (assignToUserId && currentWorkspace) {
        try {
          await supabase.functions.invoke('send-lead-assignment-email', {
            body: { sdrId: assignToUserId, leadIds: leadIdsArray, workspaceId: currentWorkspace.id, assignedBy: user?.id },
          });
        } catch (emailError) {
          console.error('Failed to send lead assignment email:', emailError);
        }
      }

      toast({
        title: `Assigned ${selectedLeadIds.size} leads`,
        description: assignToUserId ? 'Leads assigned to team member (email notification sent)' : 'Leads returned to agency pool',
      });
      setSelectedLeadIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to assign leads' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;
      toast({ title: 'Lead deleted' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete lead' });
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;
      toast({ title: 'Deal deleted' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete deal' });
    }
  };

  const pipelineValue = deals
    .filter(d => d.stage !== 'closed_lost')
    .reduce((sum, d) => sum + Number(d.value), 0);

  const wonValue = deals
    .filter(d => d.stage === 'closed_won')
    .reduce((sum, d) => sum + Number(d.value), 0);

  return {
    user,
    userRole,
    currentWorkspace,
    leads,
    deals,
    tasks,
    teamMembers,
    loading,
    searchQuery,
    setSearchQuery,
    leadFilters,
    setLeadFilters,
    dealFilters,
    setDealFilters,
    selectedLeadIds,
    setSelectedLeadIds,
    selectedDealIds,
    setSelectedDealIds,
    isBulkProcessing,
    leadsPage,
    setLeadsPage,
    dealsPage,
    setDealsPage,
    isAgencyOwner,
    filteredLeads,
    filteredDeals,
    totalLeadsPages,
    totalDealsPages,
    paginatedLeads,
    paginatedDeals,
    pipelineValue,
    wonValue,
    toggleLeadSelection,
    toggleDealSelection,
    selectAllLeads,
    selectAllDeals,
    handleBulkDeleteLeads,
    handleBulkDeleteDeals,
    handleBulkStageChange,
    handleBulkAssignLeads,
    handleDeleteLead,
    handleDeleteDeal,
    fetchData,
  };
}
