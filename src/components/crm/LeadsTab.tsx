import { useState } from 'react';
import {
  Plus, Search, Users, Phone, Mail, MoreHorizontal, Trash2, Edit, Building2, Clock, Send,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CRMFilters, FilterState } from '@/components/crm/CRMFilters';
import { CRMPagination } from '@/components/crm/Pagination';
import { LeadAssignmentDropdown } from '@/components/crm/LeadAssignmentDropdown';
import { EmailComposerModal } from '@/components/email/EmailComposerModal';
import { Lead, TeamMember } from '@/hooks/useCRMData';

interface LeadsTabProps {
  leads: Lead[];
  filteredLeads: Lead[];
  paginatedLeads: Lead[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  leadFilters: FilterState;
  setLeadFilters: (f: FilterState) => void;
  teamMembers: TeamMember[];
  isAgencyOwner: boolean;
  loading: boolean;
  selectedLeadIds: Set<string>;
  toggleLeadSelection: (id: string) => void;
  selectAllLeads: () => void;
  leadsPage: number;
  setLeadsPage: (p: number) => void;
  totalLeadsPages: number;
  onOpenLeadDetail: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onAddLead: () => void;
  workspaceId: string;
  userId?: string;
  fetchData: () => void;
}

export function LeadsTab({
  leads, filteredLeads, paginatedLeads, searchQuery, setSearchQuery,
  leadFilters, setLeadFilters, teamMembers, isAgencyOwner, loading,
  selectedLeadIds, toggleLeadSelection, selectAllLeads,
  leadsPage, setLeadsPage, totalLeadsPages,
  onOpenLeadDetail, onEditLead, onDeleteLead, onAddLead,
  workspaceId, userId, fetchData,
}: LeadsTabProps) {
  const [emailLead, setEmailLead] = useState<Lead | null>(null);

  return (
    <div className="space-y-4">
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
            teamMembers={teamMembers}
            isAgencyOwner={isAgencyOwner}
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
            <Button onClick={onAddLead}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
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
            {paginatedLeads.map(lead => (
              <Card
                key={lead.id}
                className={`glass hover:glow-sm transition-all cursor-pointer ${
                  selectedLeadIds.has(lead.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onOpenLeadDetail(lead)}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditLead(lead); }}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        {lead.email && !(lead as any).opted_out && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEmailLead(lead); }}>
                            <Send className="h-4 w-4 mr-2" /> Send Email
                          </DropdownMenuItem>
                        )}
                        {lead.email && (lead as any).opted_out && (
                          <DropdownMenuItem disabled className="text-muted-foreground">
                            <Send className="h-4 w-4 mr-2" /> Opted Out
                          </DropdownMenuItem>
                        )}
                        {isAgencyOwner && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteLead(lead.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
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
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {lead.last_contacted_at ? (
                      <span className="text-muted-foreground">
                        Contacted {formatDistanceToNow(new Date(lead.last_contacted_at), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-warning">Never contacted</span>
                    )}
                  </div>
                  {isAgencyOwner && (
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      <LeadAssignmentDropdown
                        leadId={lead.id}
                        currentAssignee={lead.assigned_to || null}
                        teamMembers={teamMembers}
                        workspaceId={workspaceId}
                        assignerId={userId}
                        onAssignmentChange={fetchData}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <CRMPagination
            currentPage={leadsPage}
            totalPages={totalLeadsPages}
            onPageChange={setLeadsPage}
          />
        </>
      )}

      {/* Email Composer Modal */}
      {emailLead && (
        <EmailComposerModal
          open={!!emailLead}
          onClose={() => setEmailLead(null)}
          lead={emailLead}
          onEmailSent={fetchData}
        />
      )}
    </div>
  );
}
