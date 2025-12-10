import { useQuery } from '@tanstack/react-query';
import { Briefcase, Building2 } from 'lucide-react';
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

export function JobsTable() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          *,
          workspaces(name),
          job_applications(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return jobsData || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading jobs...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          All Job Posts ({jobs?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs && jobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Compensation</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(job.workspaces as any)?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.employment_type === 'salary' ? 'default' : 'secondary'}>
                      {job.employment_type === 'salary' ? 'Salary' : 'Commission'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.employment_type === 'salary' 
                      ? `$${job.salary_amount?.toLocaleString() || 0}/mo`
                      : `${job.commission_percentage || 0}%`
                    }
                  </TableCell>
                  <TableCell>{(job.job_applications as any)?.[0]?.count || 0}</TableCell>
                  <TableCell>
                    <Badge variant={job.is_active ? 'default' : 'secondary'}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(job.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No jobs posted yet</p>
        )}
      </CardContent>
    </Card>
  );
}