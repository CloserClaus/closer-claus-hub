import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type DisputeStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info';

export function DisputesTable() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          deals(title, value, stage),
          workspaces(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get raiser profiles
      const raiserIds = data?.map(d => d.raised_by) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', raiserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(d => ({
        ...d,
        raiser: profileMap.get(d.raised_by),
      })) || [];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ disputeId, status, notes, dispute }: { disputeId: string; status: DisputeStatus; notes: string; dispute: any }) => {
      const { error } = await supabase
        .from('disputes')
        .update({
          status,
          admin_notes: notes,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (error) throw error;

      // Send notification to the SDR who raised the dispute
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'dispute_resolved',
            dispute_id: disputeId,
            workspace_id: dispute.workspace_id,
            deal_id: dispute.deal_id,
            raised_by: dispute.raised_by,
            resolution: status,
            admin_notes: notes,
          },
        });
      } catch (notifError) {
        console.error('Failed to send dispute notification:', notifError);
      }
    },
    onSuccess: () => {
      toast.success('Dispute resolved');
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setSelectedDispute(null);
      setAdminNotes('');
    },
    onError: () => {
      toast.error('Failed to resolve dispute');
    },
  });

  const handleResolve = (status: DisputeStatus) => {
    if (!selectedDispute) return;
    resolveMutation.mutate({
      disputeId: selectedDispute.id,
      status,
      notes: adminNotes,
      dispute: selectedDispute,
    });
  };

  const statusConfig: Record<DisputeStatus, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-warning/20 text-warning', icon: <AlertTriangle className="h-3 w-3" /> },
    approved: { color: 'bg-success/20 text-success', icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { color: 'bg-destructive/20 text-destructive', icon: <XCircle className="h-3 w-3" /> },
    needs_more_info: { color: 'bg-blue-500/20 text-blue-300', icon: <HelpCircle className="h-3 w-3" /> },
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading disputes...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Disputes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {disputes && disputes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Raised By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{(dispute.deals as any)?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          ${Number((dispute.deals as any)?.value || 0).toLocaleString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{(dispute.workspaces as any)?.name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{dispute.raiser?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{dispute.raiser?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{dispute.reason}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[dispute.status as DisputeStatus].color}>
                        {statusConfig[dispute.status as DisputeStatus].icon}
                        <span className="ml-1 capitalize">{dispute.status.replace('_', ' ')}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dispute.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDispute(dispute)}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No disputes yet</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Review the dispute for "{(selectedDispute?.deals as any)?.title}" and take action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Reason</p>
              <p className="text-sm text-muted-foreground">{selectedDispute?.reason}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Admin Notes</p>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about your decision..."
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve('needs_more_info')}
              disabled={resolveMutation.isPending}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Need Info
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleResolve('rejected')}
              disabled={resolveMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => handleResolve('approved')}
              disabled={resolveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
