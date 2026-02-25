import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LeadForm } from '@/components/crm/LeadForm';
import { DealForm } from '@/components/crm/DealForm';
import { DisputeForm } from '@/components/crm/DisputeForm';
import { TaskForm } from '@/components/crm/TaskForm';
import { CSVUpload } from '@/components/crm/CSVUpload';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';
import { Lead, Deal, Task } from '@/hooks/useCRMData';

interface CRMDialogsProps {
  workspaceId: string;
  userRole: string | null;
  userId?: string;
  leads: Lead[];
  deals: Deal[];

  showLeadForm: boolean;
  setShowLeadForm: (v: boolean) => void;
  editingLead: Lead | null;
  setEditingLead: (l: Lead | null) => void;

  showDealForm: boolean;
  setShowDealForm: (v: boolean) => void;
  editingDeal: Deal | null;
  setEditingDeal: (d: Deal | null) => void;

  showDisputeForm: boolean;
  setShowDisputeForm: (v: boolean) => void;
  disputeDeal: Deal | null;
  setDisputeDeal: (d: Deal | null) => void;

  showTaskForm: boolean;
  setShowTaskForm: (v: boolean) => void;
  editingTask: Task | null;
  setEditingTask: (t: Task | null) => void;

  showCSVUpload: boolean;
  setShowCSVUpload: (v: boolean) => void;

  deleteLeadConfirm: { open: boolean; leadId: string | null };
  setDeleteLeadConfirm: (v: { open: boolean; leadId: string | null }) => void;
  deleteDealConfirm: { open: boolean; dealId: string | null };
  setDeleteDealConfirm: (v: { open: boolean; dealId: string | null }) => void;

  bulkDeleteLeadsConfirm: boolean;
  setBulkDeleteLeadsConfirm: (v: boolean) => void;
  bulkDeleteDealsConfirm: boolean;
  setBulkDeleteDealsConfirm: (v: boolean) => void;

  selectedLeadIds: Set<string>;
  selectedDealIds: Set<string>;
  isBulkProcessing: boolean;

  onDeleteLead: (id: string) => void;
  onDeleteDeal: (id: string) => void;
  onBulkDeleteLeads: () => void;
  onBulkDeleteDeals: () => void;
  fetchData: () => void;
}

export function CRMDialogs({
  workspaceId, userRole, userId, leads, deals,
  showLeadForm, setShowLeadForm, editingLead, setEditingLead,
  showDealForm, setShowDealForm, editingDeal, setEditingDeal,
  showDisputeForm, setShowDisputeForm, disputeDeal, setDisputeDeal,
  showTaskForm, setShowTaskForm, editingTask, setEditingTask,
  showCSVUpload, setShowCSVUpload,
  deleteLeadConfirm, setDeleteLeadConfirm,
  deleteDealConfirm, setDeleteDealConfirm,
  bulkDeleteLeadsConfirm, setBulkDeleteLeadsConfirm,
  bulkDeleteDealsConfirm, setBulkDeleteDealsConfirm,
  selectedLeadIds, selectedDealIds, isBulkProcessing,
  onDeleteLead, onDeleteDeal, onBulkDeleteLeads, onBulkDeleteDeals,
  fetchData,
}: CRMDialogsProps) {
  return (
    <>
      {/* Lead Form Dialog */}
      <Dialog open={showLeadForm} onOpenChange={(open) => { setShowLeadForm(open); if (!open) setEditingLead(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            <DialogDescription>{editingLead ? 'Update lead information' : 'Enter lead details to add to your CRM'}</DialogDescription>
          </DialogHeader>
          <LeadForm
            lead={editingLead}
            workspaceId={workspaceId}
            defaultAssignee={userRole === 'sdr' ? userId : undefined}
            onSuccess={() => { setShowLeadForm(false); setEditingLead(null); fetchData(); }}
            onCancel={() => { setShowLeadForm(false); setEditingLead(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Deal Form Dialog */}
      <Dialog open={showDealForm} onOpenChange={(open) => { setShowDealForm(open); if (!open) setEditingDeal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
            <DialogDescription>{editingDeal ? 'Update deal information' : 'Enter deal details to track this opportunity'}</DialogDescription>
          </DialogHeader>
          <DealForm
            deal={editingDeal}
            workspaceId={workspaceId}
            leads={leads}
            onSuccess={() => { setShowDealForm(false); setEditingDeal(null); fetchData(); }}
            onCancel={() => { setShowDealForm(false); setEditingDeal(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Dispute Form Dialog */}
      <Dialog open={showDisputeForm} onOpenChange={(open) => { setShowDisputeForm(open); if (!open) setDisputeDeal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>File a Dispute</DialogTitle>
            <DialogDescription>Submit a dispute for review by a platform administrator</DialogDescription>
          </DialogHeader>
          {disputeDeal && (
            <DisputeForm
              deal={disputeDeal}
              onSuccess={() => { setShowDisputeForm(false); setDisputeDeal(null); }}
              onCancel={() => { setShowDisputeForm(false); setDisputeDeal(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={(open) => { setShowTaskForm(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>{editingTask ? 'Update task details' : 'Add a task or reminder for follow-up'}</DialogDescription>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            workspaceId={workspaceId}
            leads={leads}
            deals={deals}
            onSuccess={() => { setShowTaskForm(false); setEditingTask(null); fetchData(); }}
            onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Leads from CSV</DialogTitle>
            <DialogDescription>Upload a CSV file to bulk import leads into your CRM</DialogDescription>
          </DialogHeader>
          <CSVUpload
            workspaceId={workspaceId}
            onSuccess={() => { setShowCSVUpload(false); fetchData(); }}
            onCancel={() => setShowCSVUpload(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <DeleteConfirmDialog
        open={deleteLeadConfirm.open}
        onOpenChange={(open) => setDeleteLeadConfirm({ open, leadId: open ? deleteLeadConfirm.leadId : null })}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? This action cannot be undone."
        onConfirm={() => { if (deleteLeadConfirm.leadId) { onDeleteLead(deleteLeadConfirm.leadId); setDeleteLeadConfirm({ open: false, leadId: null }); } }}
      />

      <DeleteConfirmDialog
        open={deleteDealConfirm.open}
        onOpenChange={(open) => setDeleteDealConfirm({ open, dealId: open ? deleteDealConfirm.dealId : null })}
        title="Delete Deal"
        description="Are you sure you want to delete this deal? This action cannot be undone."
        onConfirm={() => { if (deleteDealConfirm.dealId) { onDeleteDeal(deleteDealConfirm.dealId); setDeleteDealConfirm({ open: false, dealId: null }); } }}
      />

      <DeleteConfirmDialog
        open={bulkDeleteLeadsConfirm}
        onOpenChange={setBulkDeleteLeadsConfirm}
        title="Delete Selected Leads"
        description={`Are you sure you want to delete ${selectedLeadIds.size} lead(s)? This action cannot be undone.`}
        onConfirm={() => { onBulkDeleteLeads(); setBulkDeleteLeadsConfirm(false); }}
        isProcessing={isBulkProcessing}
      />

      <DeleteConfirmDialog
        open={bulkDeleteDealsConfirm}
        onOpenChange={setBulkDeleteDealsConfirm}
        title="Delete Selected Deals"
        description={`Are you sure you want to delete ${selectedDealIds.size} deal(s)? This action cannot be undone.`}
        onConfirm={() => { onBulkDeleteDeals(); setBulkDeleteDealsConfirm(false); }}
        isProcessing={isBulkProcessing}
      />
    </>
  );
}
