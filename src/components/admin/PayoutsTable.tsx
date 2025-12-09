import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, CheckCircle, CreditCard, Clock, AlertTriangle, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue';

export function PayoutsTable() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['admin-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          deals(title),
          workspaces(name, is_locked)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get SDR profiles
      const sdrIds = data?.map(c => c.sdr_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sdrIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(c => {
        const daysSinceCreated = differenceInDays(new Date(), new Date(c.created_at));
        const isOverdue = c.status === 'pending' && daysSinceCreated >= 7;
        
        return {
          ...c,
          sdr: profileMap.get(c.sdr_id),
          daysSinceCreated,
          isOverdue,
          displayStatus: isOverdue ? 'overdue' : c.status,
        };
      }) || [];
    },
  });

  // Trigger payment via edge function (Stripe placeholder)
  const triggerPaymentMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const { data, error } = await supabase.functions.invoke('pay-commission', {
        body: { commission_id: commissionId, payment_method: 'stripe' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.stripe_pending) {
        toast.info('Stripe integration pending - commission ready for payment when configured');
      } else {
        toast.success('Payment processed successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Payment failed: ${error.message}`);
    },
  });

  // Mark as paid manually (for PayPal payouts to SDRs)
  const markPaidMutation = useMutation({
    mutationFn: async (commission: any) => {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', commission.id);

      if (error) throw error;

      // Send notification to the SDR about the payout
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'commission_paid',
            commission_id: commission.id,
            sdr_user_id: commission.sdr_id,
            workspace_id: commission.workspace_id,
            amount: Number(commission.amount),
          },
        });
      } catch (notifError) {
        console.error('Failed to send payout notification:', notifError);
      }
    },
    onSuccess: () => {
      toast.success('Commission marked as paid');
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payouts'] });
    },
    onError: () => {
      toast.error('Failed to update commission');
    },
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/20 text-warning',
    paid: 'bg-success/20 text-success',
    overdue: 'bg-destructive/20 text-destructive',
  };

  const filteredCommissions = commissions?.filter(c => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'overdue') return c.isOverdue;
    if (statusFilter === 'pending') return c.status === 'pending' && !c.isOverdue;
    return c.status === statusFilter;
  });

  const counts = {
    all: commissions?.length || 0,
    pending: commissions?.filter(c => c.status === 'pending' && !c.isOverdue).length || 0,
    overdue: commissions?.filter(c => c.isOverdue).length || 0,
    paid: commissions?.filter(c => c.status === 'paid').length || 0,
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading commissions...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Commissions & Payouts
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filter:
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">
                  All ({counts.all})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs px-3">
                  Pending ({counts.pending})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="text-xs px-3">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue ({counts.overdue})
                </TabsTrigger>
                <TabsTrigger value="paid" className="text-xs px-3">
                  Paid ({counts.paid})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCommissions && filteredCommissions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Platform Rake</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommissions.map((commission) => (
                <TableRow key={commission.id} className={commission.isOverdue ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-medium">
                    {(commission.deals as any)?.title}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {(commission.workspaces as any)?.name}
                      {(commission.workspaces as any)?.is_locked && (
                        <Badge variant="destructive" className="text-xs">Locked</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{commission.sdr?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{commission.sdr?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-success font-medium">
                    ${Number(commission.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-primary font-medium">
                    ${Number(commission.rake_amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={commission.isOverdue ? 'text-destructive font-medium' : ''}>
                        {commission.daysSinceCreated}d
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[commission.displayStatus]}>
                      {commission.status === 'paid' && commission.paid_at ? (
                        <span>Paid {format(new Date(commission.paid_at), 'MMM d')}</span>
                      ) : commission.isOverdue ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      ) : (
                        <span className="capitalize">{commission.status}</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {commission.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerPaymentMutation.mutate(commission.id)}
                          disabled={triggerPaymentMutation.isPending}
                          title="Charge via Stripe (placeholder)"
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Charge
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markPaidMutation.mutate(commission)}
                          disabled={markPaidMutation.isPending}
                          title="Mark as paid manually (PayPal payout completed)"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {statusFilter === 'all' ? 'No commissions yet' : `No ${statusFilter} commissions`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
