import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function PayoutsTable() {
  const queryClient = useQueryClient();

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['admin-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          deals(title),
          workspaces(name)
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

      return data?.map(c => ({
        ...c,
        sdr: profileMap.get(c.sdr_id),
      })) || [];
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', commissionId);

      if (error) throw error;
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
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Commissions & Payouts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {commissions && commissions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Platform Rake</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell className="font-medium">
                    {(commission.deals as any)?.title}
                  </TableCell>
                  <TableCell>{(commission.workspaces as any)?.name}</TableCell>
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
                    <Badge className={statusColors[commission.status]}>
                      {commission.status === 'paid' && commission.paid_at && (
                        <span className="capitalize">
                          Paid {format(new Date(commission.paid_at), 'MMM d')}
                        </span>
                      )}
                      {commission.status !== 'paid' && (
                        <span className="capitalize">{commission.status}</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {commission.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markPaidMutation.mutate(commission.id)}
                        disabled={markPaidMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No commissions yet</p>
        )}
      </CardContent>
    </Card>
  );
}
