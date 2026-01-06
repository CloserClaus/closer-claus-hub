import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, CheckCircle, CreditCard, Clock, AlertTriangle, Filter, RefreshCw, Wallet, BanknoteIcon } from 'lucide-react';
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
type PayoutFilter = 'all' | 'pending_payout' | 'processing' | 'paid_out' | 'held' | 'failed';

export function PayoutsTable() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('all');

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

      // Get SDR profiles with Stripe Connect status
      const sdrIds = data?.map(c => c.sdr_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, stripe_connect_status, stripe_connect_account_id')
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

  // Trigger payment via edge function (Stripe)
  const triggerPaymentMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const { data, error } = await supabase.functions.invoke('pay-commission', {
        body: { commission_id: commissionId, payment_method: 'stripe' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.stripe_enabled === false) {
        toast.info('Stripe not configured. Add STRIPE_SECRET_KEY to enable automatic payments.');
      } else if (data?.requires_action) {
        toast.info('Payment requires additional verification from the agency owner.');
      } else if (data?.success) {
        toast.success(`Payment of $${data.amount_charged?.toFixed(2)} processed successfully`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Payment failed: ${error.message}`);
    },
  });

  // Retry failed SDR payout
  const retryPayoutMutation = useMutation({
    mutationFn: async (commission: any) => {
      // Check if SDR has active Stripe Connect
      if (!commission.sdr?.stripe_connect_account_id || commission.sdr?.stripe_connect_status !== 'active') {
        throw new Error('SDR has not completed bank account setup');
      }

      // Update status to processing and trigger payout via webhook handling
      const { error } = await supabase
        .from('commissions')
        .update({ sdr_payout_status: 'processing' })
        .eq('id', commission.id);

      if (error) throw error;

      // Trigger a new transfer attempt via edge function
      const { data, error: payError } = await supabase.functions.invoke('pay-commission', {
        body: { 
          commission_id: commission.id, 
          payment_method: 'stripe',
          retry_sdr_payout: true 
        },
      });

      if (payError) throw payError;
      return data;
    },
    onSuccess: () => {
      toast.success('SDR payout retry initiated');
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
    },
    onError: (error: Error) => {
      toast.error(`Retry failed: ${error.message}`);
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

  // Mark SDR payout as paid manually
  const markSDRPaidMutation = useMutation({
    mutationFn: async (commission: any) => {
      const { error } = await supabase
        .from('commissions')
        .update({
          sdr_payout_status: 'paid',
          sdr_paid_at: new Date().toISOString(),
        })
        .eq('id', commission.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SDR payout marked as paid');
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
    },
    onError: () => {
      toast.error('Failed to update SDR payout');
    },
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/20 text-warning',
    paid: 'bg-success/20 text-success',
    overdue: 'bg-destructive/20 text-destructive',
  };

  const payoutStatusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    processing: 'bg-primary/20 text-primary',
    paid: 'bg-success/20 text-success',
    held: 'bg-warning/20 text-warning',
    failed: 'bg-destructive/20 text-destructive',
  };

  const getPayoutStatusLabel = (status: string | null) => {
    switch (status) {
      case 'processing': return 'Processing';
      case 'paid': return 'Paid';
      case 'held': return 'Held - No Bank';
      case 'failed': return 'Failed';
      default: return 'Awaiting Payment';
    }
  };

  const filteredCommissions = commissions?.filter(c => {
    // First filter by commission status
    let matchesStatus = true;
    if (statusFilter === 'overdue') matchesStatus = c.isOverdue;
    else if (statusFilter === 'pending') matchesStatus = c.status === 'pending' && !c.isOverdue;
    else if (statusFilter !== 'all') matchesStatus = c.status === statusFilter;

    // Then filter by SDR payout status
    let matchesPayout = true;
    if (payoutFilter === 'pending_payout') matchesPayout = !c.sdr_payout_status || c.sdr_payout_status === 'pending';
    else if (payoutFilter !== 'all') matchesPayout = c.sdr_payout_status === payoutFilter;

    return matchesStatus && matchesPayout;
  });

  const counts = {
    all: commissions?.length || 0,
    pending: commissions?.filter(c => c.status === 'pending' && !c.isOverdue).length || 0,
    overdue: commissions?.filter(c => c.isOverdue).length || 0,
    paid: commissions?.filter(c => c.status === 'paid').length || 0,
  };

  const payoutCounts = {
    all: commissions?.length || 0,
    pending_payout: commissions?.filter(c => !c.sdr_payout_status || c.sdr_payout_status === 'pending').length || 0,
    processing: commissions?.filter(c => c.sdr_payout_status === 'processing').length || 0,
    paid_out: commissions?.filter(c => c.sdr_payout_status === 'paid').length || 0,
    held: commissions?.filter(c => c.sdr_payout_status === 'held').length || 0,
    failed: commissions?.filter(c => c.sdr_payout_status === 'failed').length || 0,
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
        <div className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Commissions & Payouts
          </CardTitle>
          
          {/* Agency Payment Status Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              Agency:
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

          {/* SDR Payout Status Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              SDR Payout:
            </div>
            <Tabs value={payoutFilter} onValueChange={(v) => setPayoutFilter(v as PayoutFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">
                  All
                </TabsTrigger>
                <TabsTrigger value="pending_payout" className="text-xs px-3">
                  Awaiting ({payoutCounts.pending_payout})
                </TabsTrigger>
                <TabsTrigger value="processing" className="text-xs px-3">
                  Processing ({payoutCounts.processing})
                </TabsTrigger>
                <TabsTrigger value="paid_out" className="text-xs px-3">
                  Paid ({payoutCounts.paid_out})
                </TabsTrigger>
                <TabsTrigger value="held" className="text-xs px-3">
                  <Clock className="h-3 w-3 mr-1" />
                  Held ({payoutCounts.held})
                </TabsTrigger>
                <TabsTrigger value="failed" className="text-xs px-3">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Failed ({payoutCounts.failed})
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
                <TableHead>Agency Status</TableHead>
                <TableHead>SDR Payout</TableHead>
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
                      {commission.sdr?.stripe_connect_status === 'active' ? (
                        <Badge variant="outline" className="text-xs mt-1 bg-success/10 text-success border-success/20">
                          <Wallet className="h-3 w-3 mr-1" />
                          Bank Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs mt-1 bg-warning/10 text-warning border-warning/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No Bank
                        </Badge>
                      )}
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
                    <Badge className={payoutStatusColors[commission.sdr_payout_status || 'pending']}>
                      {commission.sdr_payout_status === 'paid' && commission.sdr_paid_at ? (
                        <span>Paid {format(new Date(commission.sdr_paid_at), 'MMM d')}</span>
                      ) : (
                        <span>{getPayoutStatusLabel(commission.sdr_payout_status)}</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Agency Payment Actions */}
                      {commission.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerPaymentMutation.mutate(commission.id)}
                            disabled={triggerPaymentMutation.isPending}
                            title="Charge via Stripe"
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Charge
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markPaidMutation.mutate(commission)}
                            disabled={markPaidMutation.isPending}
                            title="Mark as paid manually"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        </>
                      )}
                      
                      {/* SDR Payout Actions */}
                      {commission.status === 'paid' && (commission.sdr_payout_status === 'failed' || commission.sdr_payout_status === 'held') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryPayoutMutation.mutate(commission)}
                            disabled={retryPayoutMutation.isPending || commission.sdr?.stripe_connect_status !== 'active'}
                            title={commission.sdr?.stripe_connect_status !== 'active' ? 'SDR must connect bank first' : 'Retry SDR payout'}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry Payout
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markSDRPaidMutation.mutate(commission)}
                            disabled={markSDRPaidMutation.isPending}
                            title="Mark SDR payout as paid manually"
                          >
                            <BanknoteIcon className="h-4 w-4 mr-1" />
                            Mark SDR Paid
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {statusFilter === 'all' && payoutFilter === 'all' ? 'No commissions yet' : 'No matching commissions'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
