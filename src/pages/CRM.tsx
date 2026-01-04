import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Users,
  DollarSign,
  Building2,
  Phone,
  Mail,
  MoreHorizontal,
  Trash2,
  Edit,
  AlertTriangle,
  Upload,
  CheckSquare,
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LeadForm } from '@/components/crm/LeadForm';
import { DealForm } from '@/components/crm/DealForm';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { DisputeForm } from '@/components/crm/DisputeForm';
import { CSVUpload } from '@/components/crm/CSVUpload';
import { LeadDetailSidebar } from '@/components/crm/LeadDetailSidebar';
import { DealDetailSidebar } from '@/components/crm/DealDetailSidebar';
import { CRMFilters, FilterState } from '@/components/crm/CRMFilters';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { TaskForm } from '@/components/crm/TaskForm';
import { TaskList } from '@/components/crm/TaskList';

interface Lead {
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
}

interface Deal {
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

interface Task {
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
};

export default function CRM() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [disputeDeal, setDisputeDeal] = useState<Deal | null>(null);

  // Detail sidebars
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [showDealDetail, setShowDealDetail] = useState(false);

  // Filters
  const [leadFilters, setLeadFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [dealFilters, setDealFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Bulk selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const isAgencyOwner = userRole === 'agency_owner';

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace]);

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (dealsError) throw dealsError;
      setDeals(dealsData || []);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('due_date', { ascending: true });

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

  // Filter logic
  const getDateThreshold = (dateRange: string): Date | null => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return startOfDay(now);
      case 'week':
        return startOfWeek(now);
      case 'month':
        return startOfMonth(now);
      case 'quarter':
        return startOfQuarter(now);
      default:
        return null;
    }
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead => {
        const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();
        return (
          fullName.includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.company?.toLowerCase().includes(query)
        );
      });
    }

    // Date range filter
    if (leadFilters.dateRange) {
      const threshold = getDateThreshold(leadFilters.dateRange);
      if (threshold) {
        result = result.filter(lead => new Date(lead.created_at) >= threshold);
      }
    }

    // Has email filter
    if (leadFilters.hasEmail === 'yes') {
      result = result.filter(lead => lead.email);
    } else if (leadFilters.hasEmail === 'no') {
      result = result.filter(lead => !lead.email);
    }

    // Has phone filter
    if (leadFilters.hasPhone === 'yes') {
      result = result.filter(lead => lead.phone);
    } else if (leadFilters.hasPhone === 'no') {
      result = result.filter(lead => !lead.phone);
    }

    return result;
  }, [leads, searchQuery, leadFilters]);

  const filteredDeals = useMemo(() => {
    let result = deals;

    // Stage filter
    if (dealFilters.stage) {
      result = result.filter(deal => deal.stage === dealFilters.stage);
    }

    // Date range filter
    if (dealFilters.dateRange) {
      const threshold = getDateThreshold(dealFilters.dateRange);
      if (threshold) {
        result = result.filter(deal => new Date(deal.created_at) >= threshold);
      }
    }

    // Value range filter
    if (dealFilters.minValue) {
      result = result.filter(deal => Number(deal.value) >= Number(dealFilters.minValue));
    }
    if (dealFilters.maxValue) {
      result = result.filter(deal => Number(deal.value) <= Number(dealFilters.maxValue));
    }

    return result;
  }, [deals, dealFilters]);

  // Selection handlers
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const selectAllDeals = () => {
    if (selectedDealIds.size === filteredDeals.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(filteredDeals.map(d => d.id)));
    }
  };

  // Bulk actions
  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    setIsBulkProcessing(true);

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeadIds));

      if (error) throw error;

      toast({ title: `Deleted ${selectedLeadIds.size} leads` });
      setSelectedLeadIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete leads',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteDeals = async () => {
    if (selectedDealIds.size === 0) return;
    setIsBulkProcessing(true);

    try {
      const { error } = await supabase
        .from('deals')
        .delete()
        .in('id', Array.from(selectedDealIds));

      if (error) throw error;

      toast({ title: `Deleted ${selectedDealIds.size} deals` });
      setSelectedDealIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete deals',
      });
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
          stage: stage as 'new' | 'contacted' | 'discovery' | 'meeting' | 'proposal' | 'closed_won' | 'closed_lost',
          closed_at: ['closed_won', 'closed_lost'].includes(stage)
            ? new Date().toISOString()
            : null,
        })
        .in('id', dealIds);

      if (error) throw error;

      // Create commissions for closed_won deals
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update deals',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Individual actions
  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;

      toast({ title: 'Lead deleted' });
      setShowLeadDetail(false);
      setSelectedLead(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete lead',
      });
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;

      toast({ title: 'Deal deleted' });
      setShowDealDetail(false);
      setSelectedDeal(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete deal',
      });
    }
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
  };

  const openDealDetail = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDealDetail(true);
  };

  const pipelineValue = deals
    .filter(d => d.stage !== 'closed_lost')
    .reduce((sum, d) => sum + Number(d.value), 0);

  const wonValue = deals
    .filter(d => d.stage === 'closed_won')
    .reduce((sum, d) => sum + Number(d.value), 0);

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="CRM" />
        <main className="flex-1 p-6">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
              <p className="text-muted-foreground">
                {userRole === 'sdr'
                  ? 'Join an agency to access CRM features'
                  : 'Create a workspace to get started'}
              </p>
            </CardContent>
          </Card>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="CRM" />
      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">{leads.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Active Deals</CardDescription>
              <CardTitle className="text-2xl">
                {deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Pipeline Value</CardDescription>
              <CardTitle className="text-2xl text-primary">
                ${pipelineValue.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Closed Won</CardDescription>
              <CardTitle className="text-2xl text-success">
                ${wonValue.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6">
          <div className="flex flex-col gap-3">
            <TabsList className="bg-muted w-full overflow-x-auto">
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
                {tasks.filter(t => t.status !== 'completed').length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {tasks.filter(t => t.status !== 'completed').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Actions: always visible, wrap instead of overflowing */}
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setShowCSVUpload(true)}>
                <Upload className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Import CSV</span>
              </Button>
              <Button variant="outline" onClick={() => setShowLeadForm(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Lead</span>
              </Button>
              <Button variant="outline" onClick={() => setShowDealForm(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Deal</span>
              </Button>
              <Button onClick={() => setShowTaskForm(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Task</span>
              </Button>

              {/* Extra small screens: optional dropdown duplicate for discoverability */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="z-50 w-48 border border-border bg-popover text-popover-foreground shadow-md"
                  >
                    <DropdownMenuItem onClick={() => setShowCSVUpload(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowLeadForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lead
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDealForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Deal
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowTaskForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <TabsContent value="pipeline">
            <PipelineBoard
              deals={deals}
              leads={leads}
              onDealClick={openDealDetail}
              onLeadClick={openLeadDetail}
              onConvertLead={(lead) => {
                setEditingLead(null);
                setEditingDeal({
                  id: '',
                  workspace_id: currentWorkspace.id,
                  lead_id: lead.id,
                  assigned_to: user?.id || '',
                  title: `${lead.first_name} ${lead.last_name}${lead.company ? ` - ${lead.company}` : ''}`,
                  value: 0,
                  stage: 'new',
                  expected_close_date: null,
                  notes: null,
                  created_at: new Date().toISOString(),
                });
                setShowDealForm(true);
              }}
              onStageChange={fetchData}
            />
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-muted border-border"
                  />
                </div>
                <CRMFilters
                  type="leads"
                  filters={leadFilters}
                  onFiltersChange={setLeadFilters}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredLeads.length} of {leads.length} leads
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No leads yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first lead to start building your pipeline
                  </p>
                  <Button onClick={() => setShowLeadForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                    onCheckedChange={selectAllLeads}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({filteredLeads.length})
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredLeads.map(lead => (
                    <Card
                      key={lead.id}
                      className={`glass hover:glow-sm transition-all cursor-pointer ${
                        selectedLeadIds.has(lead.id) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => openLeadDetail(lead)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedLeadIds.has(lead.id)}
                              onCheckedChange={() => toggleLeadSelection(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <CardTitle className="text-base">
                                {lead.first_name} {lead.last_name}
                              </CardTitle>
                              {lead.company && (
                                <CardDescription className="flex items-center gap-1 mt-1">
                                  <Building2 className="h-3 w-3" />
                                  {lead.company}
                                  {lead.title && ` • ${lead.title}`}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLead(lead);
                                  setShowLeadForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {isAgencyOwner && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLead(lead.id);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {lead.email}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {lead.phone}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CRMFilters
                type="deals"
                filters={dealFilters}
                onFiltersChange={setDealFilters}
              />
              <div className="text-sm text-muted-foreground">
                {filteredDeals.length} of {deals.length} deals
              </div>
            </div>

            {filteredDeals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No deals yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first deal to track opportunities
                  </p>
                  <Button onClick={() => setShowDealForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
                    onCheckedChange={selectAllDeals}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({filteredDeals.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {filteredDeals.map(deal => (
                    <Card
                      key={deal.id}
                      className={`glass hover:glow-sm transition-all cursor-pointer ${
                        selectedDealIds.has(deal.id) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => openDealDetail(deal)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedDealIds.has(deal.id)}
                              onCheckedChange={() => toggleDealSelection(deal.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <h3 className="font-medium">{deal.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                Created {new Date(deal.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="capitalize">
                              {deal.stage.replace('_', ' ')}
                            </Badge>
                            <span className="font-semibold text-success">
                              ${Number(deal.value).toLocaleString()}
                            </span>
                            {!isAgencyOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisputeDeal(deal);
                                  setShowDisputeForm(true);
                                }}
                                title="File a dispute"
                              >
                                <AlertTriangle className="h-4 w-4 text-warning" />
                              </Button>
                            )}
                            {isAgencyOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDeal(deal.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Tasks & Follow-ups</h3>
                <p className="text-sm text-muted-foreground">
                  {tasks.filter(t => t.status !== 'completed').length} pending tasks
                </p>
              </div>
              <Button onClick={() => setShowTaskForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
            <TaskList
              tasks={tasks}
              leads={leads}
              deals={deals}
              onEdit={(task) => {
                setEditingTask(task);
                setShowTaskForm(true);
              }}
              onRefresh={fetchData}
              isAgencyOwner={isAgencyOwner}
            />
          </TabsContent>
        </Tabs>

        {/* Bulk Actions */}
        <BulkActionsBar
          selectedCount={selectedLeadIds.size}
          type="leads"
          onClearSelection={() => setSelectedLeadIds(new Set())}
          onBulkDelete={handleBulkDeleteLeads}
          isAgencyOwner={isAgencyOwner}
          isProcessing={isBulkProcessing}
        />

        <BulkActionsBar
          selectedCount={selectedDealIds.size}
          type="deals"
          onClearSelection={() => setSelectedDealIds(new Set())}
          onBulkDelete={handleBulkDeleteDeals}
          onBulkStageChange={handleBulkStageChange}
          isAgencyOwner={isAgencyOwner}
          isProcessing={isBulkProcessing}
        />

        {/* Lead Detail Sidebar */}
        <LeadDetailSidebar
          lead={selectedLead}
          open={showLeadDetail}
          onClose={() => {
            setShowLeadDetail(false);
            setSelectedLead(null);
          }}
          onEdit={(lead) => {
            setShowLeadDetail(false);
            setEditingLead(lead);
            setShowLeadForm(true);
          }}
          onDelete={handleDeleteLead}
          isAgencyOwner={isAgencyOwner}
        />

        {/* Deal Detail Sidebar */}
        <DealDetailSidebar
          deal={selectedDeal}
          open={showDealDetail}
          onClose={() => {
            setShowDealDetail(false);
            setSelectedDeal(null);
          }}
          onEdit={(deal) => {
            setShowDealDetail(false);
            setEditingDeal(deal);
            setShowDealForm(true);
          }}
          onDelete={handleDeleteDeal}
          onDispute={(deal) => {
            setShowDealDetail(false);
            setDisputeDeal(deal);
            setShowDisputeForm(true);
          }}
          isAgencyOwner={isAgencyOwner}
        />

        {/* Lead Form Dialog */}
        <Dialog
          open={showLeadForm}
          onOpenChange={(open) => {
            setShowLeadForm(open);
            if (!open) setEditingLead(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
              <DialogDescription>
                {editingLead ? 'Update lead information' : 'Enter lead details to add to your CRM'}
              </DialogDescription>
            </DialogHeader>
            <LeadForm
              lead={editingLead}
              workspaceId={currentWorkspace.id}
              onSuccess={() => {
                setShowLeadForm(false);
                setEditingLead(null);
                fetchData();
              }}
              onCancel={() => {
                setShowLeadForm(false);
                setEditingLead(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Deal Form Dialog */}
        <Dialog
          open={showDealForm}
          onOpenChange={(open) => {
            setShowDealForm(open);
            if (!open) setEditingDeal(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDeal ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
              <DialogDescription>
                {editingDeal ? 'Update deal information' : 'Enter deal details to track this opportunity'}
              </DialogDescription>
            </DialogHeader>
            <DealForm
              deal={editingDeal}
              workspaceId={currentWorkspace.id}
              leads={leads}
              onSuccess={() => {
                setShowDealForm(false);
                setEditingDeal(null);
                fetchData();
              }}
              onCancel={() => {
                setShowDealForm(false);
                setEditingDeal(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Dispute Form Dialog */}
        <Dialog
          open={showDisputeForm}
          onOpenChange={(open) => {
            setShowDisputeForm(open);
            if (!open) setDisputeDeal(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>File a Dispute</DialogTitle>
              <DialogDescription>
                Submit a dispute for review by a platform administrator
              </DialogDescription>
            </DialogHeader>
            {disputeDeal && (
              <DisputeForm
                deal={disputeDeal}
                onSuccess={() => {
                  setShowDisputeForm(false);
                  setDisputeDeal(null);
                }}
                onCancel={() => {
                  setShowDisputeForm(false);
                  setDisputeDeal(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Task Form Dialog */}
        <Dialog
          open={showTaskForm}
          onOpenChange={(open) => {
            setShowTaskForm(open);
            if (!open) setEditingTask(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
              <DialogDescription>
                {editingTask ? 'Update task details' : 'Add a task or reminder for follow-up'}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              task={editingTask}
              workspaceId={currentWorkspace.id}
              leads={leads}
              deals={deals}
              onSuccess={() => {
                setShowTaskForm(false);
                setEditingTask(null);
                fetchData();
              }}
              onCancel={() => {
                setShowTaskForm(false);
                setEditingTask(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* CSV Upload Dialog */}
        <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Leads from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to bulk import leads into your CRM
              </DialogDescription>
            </DialogHeader>
            <CSVUpload
              workspaceId={currentWorkspace.id}
              onSuccess={() => {
                setShowCSVUpload(false);
                fetchData();
              }}
              onCancel={() => setShowCSVUpload(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </DashboardLayout>
  );
}
