import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Lock, Unlock } from 'lucide-react';
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

export function AgenciesTable() {
  const { data: agencies, isLoading, refetch } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async () => {
      const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get owner profiles
      const ownerIds = workspaces?.map(w => w.owner_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return workspaces?.map(w => ({
        ...w,
        owner: profileMap.get(w.owner_id),
        memberCount: (w.workspace_members as any)?.[0]?.count || 0,
      })) || [];
    },
  });

  const toggleLock = async (workspaceId: string, currentlyLocked: boolean) => {
    const { error } = await supabase
      .from('workspaces')
      .update({ is_locked: !currentlyLocked })
      .eq('id', workspaceId);

    if (error) {
      toast.error('Failed to update workspace');
      return;
    }

    toast.success(currentlyLocked ? 'Workspace unlocked' : 'Workspace locked');
    refetch();
  };

  const tierColors: Record<string, string> = {
    omega: 'bg-slate-500/20 text-slate-300',
    beta: 'bg-blue-500/20 text-blue-300',
    alpha: 'bg-amber-500/20 text-amber-300',
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading agencies...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          All Agencies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {agencies && agencies.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>SDRs</TableHead>
                <TableHead>Rake %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell className="font-medium">{agency.name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{agency.owner?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{agency.owner?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={tierColors[agency.subscription_tier || 'omega']}>
                      {agency.subscription_tier?.toUpperCase() || 'OMEGA'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {agency.memberCount} / {agency.max_sdrs}
                    </div>
                  </TableCell>
                  <TableCell>{agency.rake_percentage}%</TableCell>
                  <TableCell>
                    <Badge variant={agency.is_locked ? 'destructive' : 'default'}>
                      {agency.is_locked ? 'Locked' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLock(agency.id, agency.is_locked || false)}
                    >
                      {agency.is_locked ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No agencies registered yet</p>
        )}
      </CardContent>
    </Card>
  );
}
