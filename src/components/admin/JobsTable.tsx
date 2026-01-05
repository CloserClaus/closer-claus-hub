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

interface Job {
  id: string;
  workspace_id: string;
  title: string;
  company_description: string | null;
  icp_industry: string | null;
  icp_company_type: string | null;
  average_ticket_size: number | null;
  payment_type: string | null;
  employment_type: string;
  commission_percentage: number | null;
  salary_amount: number | null;
  is_active: boolean;
  created_at: string;
  workspaces: { name: string } | null;
  job_applications: { count: number }[];
}

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
      return (jobsData || []) as unknown as Job[];
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Company Type</TableHead>
                  <TableHead>Ticket Size</TableHead>
                  <TableHead>Compensation</TableHead>
                  <TableHead>Applicants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {job.workspaces?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>{job.icp_industry || '-'}</TableCell>
                    <TableCell>{job.icp_company_type || '-'}</TableCell>
                    <TableCell>
                      {job.average_ticket_size ? (
                        <div className="text-sm">
                          <div>{formatCurrency(job.average_ticket_size)}</div>
                          <div className="text-muted-foreground text-xs">
                            {job.payment_type === 'recurring' ? 'Recurring' : 'One-time'}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <Badge variant="outline" className="mb-1">
                          {job.employment_type === 'salary' ? 'Salary + Comm' : 'Commission'}
                        </Badge>
                        <div className="text-muted-foreground text-xs">
                          {job.commission_percentage}% commission
                          {job.employment_type === 'salary' && job.salary_amount && (
                            <> + {formatCurrency(job.salary_amount)}/mo</>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{job.job_applications?.[0]?.count || 0}</TableCell>
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
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No jobs posted yet</p>
        )}
      </CardContent>
    </Card>
  );
}
