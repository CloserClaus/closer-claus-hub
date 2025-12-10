import { useQuery } from '@tanstack/react-query';
import { Handshake, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export function DealsTable() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ['admin-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          workspaces(name),
          leads(first_name, last_name, company)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get assigned user profiles
      const userIds = data?.map(d => d.assigned_to) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(d => ({
        ...d,
        assignee: profileMap.get(d.assigned_to),
      })) || [];
    },
  });

  const stageColors: Record<string, string> = {
    new: 'bg-slate-500/20 text-slate-300',
    contacted: 'bg-blue-500/20 text-blue-300',
    discovery: 'bg-cyan-500/20 text-cyan-300',
    meeting: 'bg-purple-500/20 text-purple-300',
    proposal: 'bg-amber-500/20 text-amber-300',
    closed_won: 'bg-green-500/20 text-green-300',
    closed_lost: 'bg-red-500/20 text-red-300',
  };

  const formatStage = (stage: string) => {
    return stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading deals...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="h-5 w-5" />
          All Deals ({deals?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deals && deals.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium">{deal.title}</TableCell>
                  <TableCell>
                    {deal.leads ? (
                      <div>
                        <p>{(deal.leads as any).first_name} {(deal.leads as any).last_name}</p>
                        <p className="text-xs text-muted-foreground">{(deal.leads as any).company}</p>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(deal.workspaces as any)?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>{deal.assignee?.full_name || 'Unknown'}</TableCell>
                  <TableCell className="font-medium text-success">
                    ${deal.value.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={stageColors[deal.stage] || ''}>
                      {formatStage(deal.stage)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(deal.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No deals yet</p>
        )}
      </CardContent>
    </Card>
  );
}