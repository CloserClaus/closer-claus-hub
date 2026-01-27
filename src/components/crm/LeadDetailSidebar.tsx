import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  X,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Edit,
  Trash2,
  Clock,
  MessageSquare,
  PhoneCall,
  FileText,
  Globe,
  Linkedin,
  MapPin,
  Users,
  Layers,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';

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
  assigned_to?: string | null;
  // Apollo enrichment fields
  linkedin_url?: string | null;
  company_domain?: string | null;
  company_linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  industry?: string | null;
  department?: string | null;
  seniority?: string | null;
  employee_count?: string | null;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

interface LeadDetailSidebarProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  isAgencyOwner: boolean;
}

export function LeadDetailSidebar({
  lead,
  open,
  onClose,
  onEdit,
  onDelete,
  isAgencyOwner,
}: LeadDetailSidebarProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [relatedDeals, setRelatedDeals] = useState<{ id: string; title: string; value: number; stage: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (lead && open) {
      fetchRelatedData();
    }
  }, [lead, open]);

  const fetchRelatedData = async () => {
    if (!lead) return;

    // Fetch related deals
    const { data: deals } = await supabase
      .from('deals')
      .select('id, title, value, stage')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    setRelatedDeals(deals || []);

    // Create activity timeline from various sources
    const activityList: Activity[] = [];

    // Add lead creation
    activityList.push({
      id: 'created',
      type: 'created',
      description: 'Lead created',
      created_at: lead.created_at,
    });

    // Add last contacted
    if (lead.last_contacted_at) {
      activityList.push({
        id: 'contacted',
        type: 'contact',
        description: 'Lead contacted',
        created_at: lead.last_contacted_at,
      });
    }

    // Fetch call logs for this lead
    const { data: calls } = await supabase
      .from('call_logs')
      .select('id, call_status, created_at, duration_seconds')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (calls) {
      calls.forEach(call => {
        activityList.push({
          id: call.id,
          type: 'call',
          description: `Call ${call.call_status}${call.duration_seconds ? ` (${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s)` : ''}`,
          created_at: call.created_at,
        });
      });
    }

    // Sort by date descending
    activityList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivities(activityList);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <PhoneCall className="h-4 w-4 text-primary" />;
      case 'contact':
        return <MessageSquare className="h-4 w-4 text-success" />;
      case 'created':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatLocation = () => {
    const parts = [lead?.city, lead?.state, lead?.country].filter(Boolean);
    return parts.join(', ');
  };

  if (!lead) return null;

  const hasEnrichmentData = lead.linkedin_url || lead.company_domain || lead.industry || 
    lead.department || lead.seniority || lead.employee_count || formatLocation();

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg p-0 bg-background border-l border-border">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl">
                    {lead.first_name} {lead.last_name}
                  </SheetTitle>
                  {lead.company && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {lead.company}
                      {lead.title && ` • ${lead.title}`}
                    </p>
                  )}
                  {lead.seniority && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {lead.seniority}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(lead)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {isAgencyOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Contact Information
                  </h3>
                  <div className="space-y-2">
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-sm">{lead.email}</span>
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="text-sm">{lead.phone}</span>
                      </a>
                    )}
                    {lead.linkedin_url && (
                      <a
                        href={lead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Linkedin className="h-4 w-4 text-primary" />
                        <span className="text-sm">LinkedIn Profile</span>
                      </a>
                    )}
                    {!lead.email && !lead.phone && !lead.linkedin_url && (
                      <p className="text-sm text-muted-foreground italic">
                        No contact information
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Company & Professional Info */}
                {hasEnrichmentData && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Professional Details
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {lead.department && (
                          <div className="flex items-center gap-2 text-sm">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.department}</span>
                          </div>
                        )}
                        {lead.industry && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.industry}</span>
                          </div>
                        )}
                        {lead.employee_count && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.employee_count} employees</span>
                          </div>
                        )}
                        {formatLocation() && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{formatLocation()}</span>
                          </div>
                        )}
                        {lead.company_domain && (
                          <a
                            href={`https://${lead.company_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Globe className="h-4 w-4" />
                            <span>{lead.company_domain}</span>
                          </a>
                        )}
                        {lead.company_linkedin_url && (
                          <a
                            href={lead.company_linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Linkedin className="h-4 w-4" />
                            <span>Company LinkedIn</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Notes */}
                {lead.notes && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                        {lead.notes}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Related Deals */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Related Deals ({relatedDeals.length})
                  </h3>
                  {relatedDeals.length > 0 ? (
                    <div className="space-y-2">
                      {relatedDeals.map(deal => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{deal.title}</p>
                            <Badge variant="outline" className="text-xs capitalize mt-1">
                              {deal.stage.replace('_', ' ')}
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold text-success">
                            ${Number(deal.value).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No deals associated with this lead
                    </p>
                  )}
                </div>

                <Separator />

                {/* Activity Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Activity Timeline
                  </h3>
                  {activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              {getActivityIcon(activity.type)}
                            </div>
                            {index < activities.length - 1 && (
                              <div className="w-px h-full bg-border mt-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(activity.created_at), 'MMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No activity recorded
                    </p>
                  )}
                </div>

                {/* Metadata */}
                <Separator />
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Created {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Lead"
        description={`Are you sure you want to delete "${lead.first_name} ${lead.last_name}"? This action cannot be undone.`}
        onConfirm={() => {
          onDelete(lead.id);
          setShowDeleteConfirm(false);
        }}
      />
    </>
  );
}
