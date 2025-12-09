import { useQuery } from '@tanstack/react-query';
import { Users, Building2, DollarSign } from 'lucide-react';
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

export function SDRsTable() {
  const { data: sdrs, isLoading } = useQuery({
    queryKey: ['admin-sdrs'],
    queryFn: async () => {
      // Get all SDR user roles
      const { data: sdrRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');

      if (rolesError) throw rolesError;

      const sdrIds = sdrRoles?.map(r => r.user_id) || [];
      if (sdrIds.length === 0) return [];

      // Get profiles for SDRs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', sdrIds);

      if (profilesError) throw profilesError;

      // Get workspace memberships
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('user_id, workspace_id, is_salary_exclusive, workspaces(name)')
        .in('user_id', sdrIds)
        .is('removed_at', null);

      // Get commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('sdr_id, amount, status')
        .in('sdr_id', sdrIds);

      // Aggregate data
      const membershipMap = new Map<string, any[]>();
      memberships?.forEach(m => {
        if (!membershipMap.has(m.user_id)) {
          membershipMap.set(m.user_id, []);
        }
        membershipMap.get(m.user_id)!.push(m);
      });

      const earningsMap = new Map<string, { total: number; pending: number }>();
      commissions?.forEach(c => {
        if (!earningsMap.has(c.sdr_id)) {
          earningsMap.set(c.sdr_id, { total: 0, pending: 0 });
        }
        const entry = earningsMap.get(c.sdr_id)!;
        entry.total += Number(c.amount);
        if (c.status === 'pending') {
          entry.pending += Number(c.amount);
        }
      });

      return profiles?.map(p => ({
        ...p,
        workspaces: membershipMap.get(p.id) || [],
        earnings: earningsMap.get(p.id) || { total: 0, pending: 0 },
      })) || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading SDRs...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          All SDRs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sdrs && sdrs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDR</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Employment</TableHead>
                <TableHead>Total Earned</TableHead>
                <TableHead>Pending Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sdrs.map((sdr) => (
                <TableRow key={sdr.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sdr.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{sdr.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sdr.workspaces.length > 0 ? (
                        sdr.workspaces.map((w: any) => (
                          <Badge key={w.workspace_id} variant="secondary" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {(w.workspaces as any)?.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No workspaces</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sdr.workspaces.some((w: any) => w.is_salary_exclusive) ? (
                      <Badge className="bg-amber-500/20 text-amber-300">Salary</Badge>
                    ) : sdr.workspaces.length > 0 ? (
                      <Badge className="bg-blue-500/20 text-blue-300">Commission</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-success">
                      <DollarSign className="h-4 w-4" />
                      {sdr.earnings.total.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-warning">
                      <DollarSign className="h-4 w-4" />
                      {sdr.earnings.pending.toLocaleString()}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No SDRs registered yet</p>
        )}
      </CardContent>
    </Card>
  );
}
