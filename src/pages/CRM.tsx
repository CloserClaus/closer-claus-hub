import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LeadForm } from '@/components/crm/LeadForm';
import { DealForm } from '@/components/crm/DealForm';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { DisputeForm } from '@/components/crm/DisputeForm';

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
  lead?: Lead;
}

export default function CRM() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [disputeDeal, setDisputeDeal] = useState<Deal | null>(null);

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
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      // Fetch deals
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (dealsError) throw dealsError;
      setDeals(dealsData || []);
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

  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;
      
      toast({ title: 'Lead deleted' });
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
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete deal',
      });
    }
  };

  const filteredLeads = leads.filter(lead => {
    const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query)
    );
  });

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-muted">
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowLeadForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              <Button onClick={() => setShowDealForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Deal
              </Button>
            </div>
          </div>

          <TabsContent value="pipeline">
            <PipelineBoard
              deals={deals}
              onDealClick={(deal) => {
                setEditingDeal(deal);
                setShowDealForm(true);
              }}
              onStageChange={fetchData}
            />
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted border-border"
              />
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLeads.map(lead => (
                  <Card key={lead.id} className="glass hover:glow-sm transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingLead(lead);
                                setShowLeadForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {isAgencyOwner && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteLead(lead.id)}
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
            )}
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            {deals.length === 0 ? (
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
              <div className="space-y-3">
                {deals.map(deal => (
                  <Card
                    key={deal.id}
                    className="glass hover:glow-sm transition-all cursor-pointer"
                    onClick={() => {
                      setEditingDeal(deal);
                      setShowDealForm(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{deal.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(deal.created_at).toLocaleDateString()}
                          </p>
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
            )}
          </TabsContent>
        </Tabs>

        {/* Lead Form Dialog */}
        <Dialog open={showLeadForm} onOpenChange={(open) => {
          setShowLeadForm(open);
          if (!open) setEditingLead(null);
        }}>
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
        <Dialog open={showDealForm} onOpenChange={(open) => {
          setShowDealForm(open);
          if (!open) setEditingDeal(null);
        }}>
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
        <Dialog open={showDisputeForm} onOpenChange={(open) => {
          setShowDisputeForm(open);
          if (!open) setDisputeDeal(null);
        }}>
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
      </main>
    </DashboardLayout>
  );
}
