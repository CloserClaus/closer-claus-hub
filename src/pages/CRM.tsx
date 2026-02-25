import { useState } from 'react';
import { Plus, Upload, CheckSquare, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { TaskList } from '@/components/crm/TaskList';
import { LeadDetailSidebar } from '@/components/crm/LeadDetailSidebar';
import { DealDetailSidebar } from '@/components/crm/DealDetailSidebar';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { BulkConvertDialog } from '@/components/crm/BulkConvertDialog';
import { BulkAssignDialog } from '@/components/crm/BulkAssignDialog';
import { DedupeLeadsDialog } from '@/components/crm/DedupeLeadsDialog';
import { CRMStatsCards } from '@/components/crm/CRMStatsCards';
import { LeadsTab } from '@/components/crm/LeadsTab';
import { DealsTab } from '@/components/crm/DealsTab';
import { CRMDialogs } from '@/components/crm/CRMDialogs';
import { useCRMData, Lead, Deal, Task } from '@/hooks/useCRMData';

export default function CRM() {
  const crm = useCRMData();

  // Dialog state
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

  // Delete confirmation
  const [deleteLeadConfirm, setDeleteLeadConfirm] = useState<{ open: boolean; leadId: string | null }>({ open: false, leadId: null });
  const [deleteDealConfirm, setDeleteDealConfirm] = useState<{ open: boolean; dealId: string | null }>({ open: false, dealId: null });
  const [bulkDeleteLeadsConfirm, setBulkDeleteLeadsConfirm] = useState(false);
  const [bulkDeleteDealsConfirm, setBulkDeleteDealsConfirm] = useState(false);

  // Bulk operation dialogs
  const [showBulkConvert, setShowBulkConvert] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showDedupe, setShowDedupe] = useState(false);

  const openLeadDetail = (lead: Lead) => { setSelectedLead(lead); setShowLeadDetail(true); };
  const openDealDetail = (deal: Deal) => { setSelectedDeal(deal); setShowDealDetail(true); };

  if (!crm.currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="CRM" />
        <main className="flex-1 p-6">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
              <p className="text-muted-foreground">
                {crm.userRole === 'sdr' ? 'Join an agency to access CRM features' : 'Create a workspace to get started'}
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
        <CRMStatsCards
          leads={crm.leads}
          deals={crm.deals}
          pipelineValue={crm.pipelineValue}
          wonValue={crm.wonValue}
          isAgencyOwner={crm.isAgencyOwner}
          leadFilters={crm.leadFilters}
          setLeadFilters={crm.setLeadFilters}
        />

        <Tabs defaultValue="pipeline" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <TabsList className="bg-muted w-full lg:w-auto overflow-x-auto">
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
                {crm.tasks.filter(t => t.status !== 'completed').length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {crm.tasks.filter(t => t.status !== 'completed').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Desktop buttons */}
            <div className="hidden lg:flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowCSVUpload(true)}><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
              <Button variant="outline" onClick={() => setShowLeadForm(true)}><Plus className="h-4 w-4 mr-2" />Add Lead</Button>
              <Button variant="outline" onClick={() => setShowDealForm(true)}><Plus className="h-4 w-4 mr-2" />Add Deal</Button>
              <Button onClick={() => setShowTaskForm(true)}><Plus className="h-4 w-4 mr-2" />Add Task</Button>
            </div>

            {/* Mobile dropdown */}
            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Actions</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowCSVUpload(true)}><Upload className="h-4 w-4 mr-2" />Import CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowLeadForm(true)}><Plus className="h-4 w-4 mr-2" />Add Lead</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDealForm(true)}><Plus className="h-4 w-4 mr-2" />Add Deal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTaskForm(true)}><Plus className="h-4 w-4 mr-2" />Add Task</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TabsContent value="pipeline">
            <PipelineBoard
              deals={crm.deals}
              leads={crm.leads}
              onDealClick={openDealDetail}
              onLeadClick={openLeadDetail}
              onConvertLead={(lead) => {
                setEditingLead(null);
                setEditingDeal({
                  id: '',
                  workspace_id: crm.currentWorkspace!.id,
                  lead_id: lead.id,
                  assigned_to: crm.user?.id || '',
                  title: `${lead.first_name} ${lead.last_name}${lead.company ? ` - ${lead.company}` : ''}`,
                  value: 0,
                  stage: 'new',
                  expected_close_date: null,
                  notes: null,
                  created_at: new Date().toISOString(),
                });
                setShowDealForm(true);
              }}
              onStageChange={crm.fetchData}
            />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsTab
              leads={crm.leads}
              filteredLeads={crm.filteredLeads}
              paginatedLeads={crm.paginatedLeads}
              searchQuery={crm.searchQuery}
              setSearchQuery={crm.setSearchQuery}
              leadFilters={crm.leadFilters}
              setLeadFilters={crm.setLeadFilters}
              teamMembers={crm.teamMembers}
              isAgencyOwner={crm.isAgencyOwner}
              loading={crm.loading}
              selectedLeadIds={crm.selectedLeadIds}
              toggleLeadSelection={crm.toggleLeadSelection}
              selectAllLeads={crm.selectAllLeads}
              leadsPage={crm.leadsPage}
              setLeadsPage={crm.setLeadsPage}
              totalLeadsPages={crm.totalLeadsPages}
              onOpenLeadDetail={openLeadDetail}
              onEditLead={(lead) => { setEditingLead(lead); setShowLeadForm(true); }}
              onDeleteLead={(id) => setDeleteLeadConfirm({ open: true, leadId: id })}
              onAddLead={() => setShowLeadForm(true)}
              workspaceId={crm.currentWorkspace!.id}
              userId={crm.user?.id}
              fetchData={crm.fetchData}
            />
          </TabsContent>

          <TabsContent value="deals">
            <DealsTab
              deals={crm.deals}
              filteredDeals={crm.filteredDeals}
              paginatedDeals={crm.paginatedDeals}
              dealFilters={crm.dealFilters}
              setDealFilters={crm.setDealFilters}
              isAgencyOwner={crm.isAgencyOwner}
              selectedDealIds={crm.selectedDealIds}
              toggleDealSelection={crm.toggleDealSelection}
              selectAllDeals={crm.selectAllDeals}
              dealsPage={crm.dealsPage}
              setDealsPage={crm.setDealsPage}
              totalDealsPages={crm.totalDealsPages}
              onOpenDealDetail={openDealDetail}
              onAddDeal={() => setShowDealForm(true)}
              onDispute={(deal) => { setDisputeDeal(deal); setShowDisputeForm(true); }}
              onDeleteDeal={(id) => setDeleteDealConfirm({ open: true, dealId: id })}
            />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Tasks & Follow-ups</h3>
                <p className="text-sm text-muted-foreground">
                  {crm.tasks.filter(t => t.status !== 'completed').length} pending tasks
                </p>
              </div>
              <Button onClick={() => setShowTaskForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
            <TaskList
              tasks={crm.tasks}
              leads={crm.leads}
              deals={crm.deals}
              onEdit={(task) => { setEditingTask(task); setShowTaskForm(true); }}
              onRefresh={crm.fetchData}
              isAgencyOwner={crm.isAgencyOwner}
            />
          </TabsContent>
        </Tabs>

        {/* Bulk Actions */}
        <BulkActionsBar
          selectedCount={crm.selectedLeadIds.size}
          type="leads"
          onClearSelection={() => crm.setSelectedLeadIds(new Set())}
          onBulkDelete={() => setBulkDeleteLeadsConfirm(true)}
          onBulkAssign={crm.handleBulkAssignLeads}
          onBulkConvert={() => setShowBulkConvert(true)}
          onAdvancedAssign={() => setShowBulkAssign(true)}
          onDedupe={() => setShowDedupe(true)}
          isAgencyOwner={crm.isAgencyOwner}
          isProcessing={crm.isBulkProcessing}
          teamMembers={crm.teamMembers}
        />

        <BulkActionsBar
          selectedCount={crm.selectedDealIds.size}
          type="deals"
          onClearSelection={() => crm.setSelectedDealIds(new Set())}
          onBulkDelete={() => setBulkDeleteDealsConfirm(true)}
          onBulkStageChange={crm.handleBulkStageChange}
          isAgencyOwner={crm.isAgencyOwner}
          isProcessing={crm.isBulkProcessing}
        />

        <BulkConvertDialog
          open={showBulkConvert}
          onOpenChange={setShowBulkConvert}
          selectedLeads={crm.leads.filter(l => crm.selectedLeadIds.has(l.id))}
          workspaceId={crm.currentWorkspace!.id}
          onSuccess={() => { crm.setSelectedLeadIds(new Set()); crm.fetchData(); }}
        />

        <BulkAssignDialog
          open={showBulkAssign}
          onOpenChange={setShowBulkAssign}
          leads={crm.leads}
          teamMembers={crm.teamMembers}
          workspaceId={crm.currentWorkspace!.id}
          onSuccess={() => { crm.setSelectedLeadIds(new Set()); crm.fetchData(); }}
        />

        <DedupeLeadsDialog
          open={showDedupe}
          onOpenChange={setShowDedupe}
          leads={crm.leads}
          workspaceId={crm.currentWorkspace!.id}
          onSuccess={crm.fetchData}
        />

        <LeadDetailSidebar
          lead={selectedLead}
          open={showLeadDetail}
          onClose={() => { setShowLeadDetail(false); setSelectedLead(null); }}
          onEdit={(lead) => { setShowLeadDetail(false); setEditingLead(lead); setShowLeadForm(true); }}
          onDelete={(id) => { crm.handleDeleteLead(id); setShowLeadDetail(false); setSelectedLead(null); }}
          isAgencyOwner={crm.isAgencyOwner}
        />

        <DealDetailSidebar
          deal={selectedDeal}
          open={showDealDetail}
          onClose={() => { setShowDealDetail(false); setSelectedDeal(null); }}
          onEdit={(deal) => { setShowDealDetail(false); setEditingDeal(deal); setShowDealForm(true); }}
          onDelete={(id) => { crm.handleDeleteDeal(id); setShowDealDetail(false); setSelectedDeal(null); }}
          onDispute={(deal) => { setShowDealDetail(false); setDisputeDeal(deal); setShowDisputeForm(true); }}
          onEditLead={(lead) => { setShowDealDetail(false); setEditingLead(lead as Lead); setShowLeadForm(true); }}
          isAgencyOwner={crm.isAgencyOwner}
        />

        <CRMDialogs
          workspaceId={crm.currentWorkspace!.id}
          userRole={crm.userRole}
          userId={crm.user?.id}
          leads={crm.leads}
          deals={crm.deals}
          showLeadForm={showLeadForm}
          setShowLeadForm={setShowLeadForm}
          editingLead={editingLead}
          setEditingLead={setEditingLead}
          showDealForm={showDealForm}
          setShowDealForm={setShowDealForm}
          editingDeal={editingDeal}
          setEditingDeal={setEditingDeal}
          showDisputeForm={showDisputeForm}
          setShowDisputeForm={setShowDisputeForm}
          disputeDeal={disputeDeal}
          setDisputeDeal={setDisputeDeal}
          showTaskForm={showTaskForm}
          setShowTaskForm={setShowTaskForm}
          editingTask={editingTask}
          setEditingTask={setEditingTask}
          showCSVUpload={showCSVUpload}
          setShowCSVUpload={setShowCSVUpload}
          deleteLeadConfirm={deleteLeadConfirm}
          setDeleteLeadConfirm={setDeleteLeadConfirm}
          deleteDealConfirm={deleteDealConfirm}
          setDeleteDealConfirm={setDeleteDealConfirm}
          bulkDeleteLeadsConfirm={bulkDeleteLeadsConfirm}
          setBulkDeleteLeadsConfirm={setBulkDeleteLeadsConfirm}
          bulkDeleteDealsConfirm={bulkDeleteDealsConfirm}
          setBulkDeleteDealsConfirm={setBulkDeleteDealsConfirm}
          selectedLeadIds={crm.selectedLeadIds}
          selectedDealIds={crm.selectedDealIds}
          isBulkProcessing={crm.isBulkProcessing}
          onDeleteLead={crm.handleDeleteLead}
          onDeleteDeal={crm.handleDeleteDeal}
          onBulkDeleteLeads={crm.handleBulkDeleteLeads}
          onBulkDeleteDeals={crm.handleBulkDeleteDeals}
          fetchData={crm.fetchData}
        />
      </main>
    </DashboardLayout>
  );
}
