import { useQuery } from '@tanstack/react-query';
import { FileSignature, Building2 } from 'lucide-react';
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

export function ContractsTable() {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          workspaces(name),
          deals(title, value)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-300',
    sent: 'bg-blue-500/20 text-blue-300',
    signed: 'bg-green-500/20 text-green-300',
    expired: 'bg-red-500/20 text-red-300',
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading contracts...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          All Contracts ({contracts?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contracts && contracts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(contract.workspaces as any)?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>{(contract.deals as any)?.title || 'Unknown'}</TableCell>
                  <TableCell className="font-medium text-success">
                    ${((contract.deals as any)?.value || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[contract.status] || ''}>
                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(contract.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No contracts yet</p>
        )}
      </CardContent>
    </Card>
  );
}