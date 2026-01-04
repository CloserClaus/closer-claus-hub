import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  X,
  DollarSign,
  Calendar,
  Edit,
  Trash2,
  Clock,
  User,
  TrendingUp,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';

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
  lead?: {
    id?: string;
    workspace_id?: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    title?: string | null;
    notes?: string | null;
    last_contacted_at?: string | null;
    created_at?: string;
  };
}

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_name?: string;
}

interface DealDetailSidebarProps {
  deal: Deal | null;
  open: boolean;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onDelete: (dealId: string) => void;
  onDispute: (deal: Deal) => void;
  isAgencyOwner: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  contacted: 'bg-blue-500/20 text-blue-400',
  discovery: 'bg-purple-500/20 text-purple-400',
  meeting: 'bg-yellow-500/20 text-yellow-400',
  proposal: 'bg-orange-500/20 text-orange-400',
  closed_won: 'bg-success/20 text-success',
  closed_lost: 'bg-destructive/20 text-destructive',
};

export function DealDetailSidebar({
  deal,
  open,
  onClose,
  onEdit,
  onDelete,
  onDispute,
  isAgencyOwner,
}: DealDetailSidebarProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadInfo, setLeadInfo] = useState<{ first_name: string; last_name: string; company: string | null } | null>(null);
  const [assigneeName, setAssigneeName] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (deal && open) {
      fetchRelatedData();
    }
  }, [deal, open]);

  const fetchRelatedData = async () => {
    if (!deal) return;

    // Fetch activities
    const { data: activityData } = await supabase
      .from('deal_activities')
      .select('id, activity_type, description, created_at, user_id')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setActivities(activityData || []);

    // Fetch lead info
    if (deal.lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('first_name, last_name, company')
        .eq('id', deal.lead_id)
        .maybeSingle();

      setLeadInfo(lead);
    } else {
      setLeadInfo(null);
    }

    // Fetch assignee name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', deal.assigned_to)
      .maybeSingle();

    setAssigneeName(profile?.full_name || profile?.email || 'Unknown');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stage_change':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case 'create':
        return <FileText className="h-4 w-4 text-success" />;
      case 'update':
        return <Edit className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!deal) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg p-0 bg-background border-l border-border">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl">{deal.title}</SheetTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={STAGE_COLORS[deal.stage] || 'bg-muted'}>
                      {deal.stage.replace('_', ' ')}
                    </Badge>
                    <span className="text-lg font-semibold text-success">
                      ${Number(deal.value).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(deal)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!isAgencyOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDispute(deal)}
                      className="text-warning hover:text-warning"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  )}
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
                {/* Deal Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Deal Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <User className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Assigned To</p>
                        <p className="text-sm">{assigneeName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <DollarSign className="h-4 w-4 text-success" />
                      <div>
                        <p className="text-xs text-muted-foreground">Deal Value</p>
                        <p className="text-sm font-medium">${Number(deal.value).toLocaleString()}</p>
                      </div>
                    </div>
                    {deal.expected_close_date && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Close</p>
                          <p className="text-sm">
                            {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Associated Lead */}
                {leadInfo && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Associated Lead
                      </h3>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium">
                          {leadInfo.first_name} {leadInfo.last_name}
                        </p>
                        {leadInfo.company && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {leadInfo.company}
                          </p>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Notes */}
                {deal.notes && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                        {deal.notes}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

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
                              {getActivityIcon(activity.activity_type)}
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
                    Created {format(new Date(deal.created_at), 'MMM d, yyyy')}
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
        title="Delete Deal"
        description={`Are you sure you want to delete "${deal.title}"? This action cannot be undone.`}
        onConfirm={() => {
          onDelete(deal.id);
          setShowDeleteConfirm(false);
        }}
      />
    </>
  );
}
