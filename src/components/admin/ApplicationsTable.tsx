import { useQuery } from '@tanstack/react-query';
import { FileCheck, Building2, User } from 'lucide-react';
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

export function ApplicationsTable() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          jobs(title, workspaces(name))
        `)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      // Get applicant profiles
      const userIds = data?.map(a => a.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(a => ({
        ...a,
        applicant: profileMap.get(a.user_id),
      })) || [];
    },
  });

  const statusColors: Record<string, string> = {
    applied: 'bg-blue-500/20 text-blue-300',
    shortlisted: 'bg-amber-500/20 text-amber-300',
    interviewing: 'bg-purple-500/20 text-purple-300',
    hired: 'bg-green-500/20 text-green-300',
    rejected: 'bg-red-500/20 text-red-300',
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading applications...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          All Job Applications ({applications?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {applications && applications.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{app.applicant?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{(app.jobs as any)?.title || 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(app.jobs as any)?.workspaces?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[app.status] || ''}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(app.applied_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No applications yet</p>
        )}
      </CardContent>
    </Card>
  );
}