import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Briefcase, DollarSign, Building2, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  employment_type: 'commission_only' | 'salary';
  commission_percentage: number | null;
  salary_amount: number | null;
  requirements: string[] | null;
  is_active: boolean;
  created_at: string;
  workspace?: {
    name: string;
  };
  application_count?: number;
  user_applied?: boolean;
}

export default function Jobs() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [employmentFilter, setEmploymentFilter] = useState<string>('all');

  const isAgencyOwner = userRole === 'agency_owner';
  const isSDR = userRole === 'sdr';

  useEffect(() => {
    fetchJobs();
  }, [user, userRole]);

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          workspace:workspaces(name)
        `)
        .order('created_at', { ascending: false });

      // Agency owners see only their jobs
      if (isAgencyOwner) {
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id);

        if (workspaces && workspaces.length > 0) {
          query = query.in('workspace_id', workspaces.map(w => w.id));
        } else {
          setJobs([]);
          setLoading(false);
          return;
        }
      }

      // SDRs should only see active jobs
      if (isSDR) {
        query = query.eq('is_active', true);
      }

      const { data: jobsData, error } = await query;

      if (error) throw error;

      // For SDRs, check which jobs they've applied to
      if (isSDR && jobsData) {
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id')
          .eq('user_id', user.id);

        const appliedJobIds = new Set(applications?.map(a => a.job_id) || []);

        setJobs(
          jobsData.map(job => ({
            ...job,
            user_applied: appliedJobIds.has(job.id),
          }))
        );
      } else {
        // For agency owners, get application counts
        if (isAgencyOwner && jobsData) {
          const jobIds = jobsData.map(j => j.id);
          const { data: appCounts } = await supabase
            .from('job_applications')
            .select('job_id')
            .in('job_id', jobIds);

          const countMap: Record<string, number> = {};
          appCounts?.forEach(a => {
            countMap[a.job_id] = (countMap[a.job_id] || 0) + 1;
          });

          setJobs(
            jobsData.map(job => ({
              ...job,
              application_count: countMap[job.id] || 0,
            }))
          );
        } else {
          setJobs(jobsData || []);
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load jobs',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.workspace?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = employmentFilter === 'all' || job.employment_type === employmentFilter;

    return matchesSearch && matchesFilter;
  });

  const formatCompensation = (job: Job) => {
    if (job.employment_type === 'salary' && job.salary_amount) {
      return `$${job.salary_amount.toLocaleString()}/month`;
    }
    if (job.commission_percentage) {
      return `${job.commission_percentage}% commission`;
    }
    return 'Compensation TBD';
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Jobs" />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {isAgencyOwner ? 'Manage Jobs' : 'Find Jobs'}
            </h1>
            <p className="text-muted-foreground">
              {isAgencyOwner
                ? 'Create and manage job postings for your agency'
                : 'Browse available positions and apply'}
            </p>
          </div>
          {isAgencyOwner && (
            <Button onClick={() => navigate('/jobs/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Post New Job
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="commission_only">Commission Only</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {jobs.length === 0
                  ? isAgencyOwner
                    ? 'No jobs posted yet'
                    : 'No jobs available'
                  : 'No matching jobs found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {isAgencyOwner
                  ? 'Create your first job posting to start hiring SDRs'
                  : 'Check back later for new opportunities'}
              </p>
              {isAgencyOwner && (
                <Button onClick={() => navigate('/jobs/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post Your First Job
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="glass hover:glow-sm transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {job.workspace?.name || 'Unknown Agency'}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={job.employment_type === 'salary' ? 'default' : 'secondary'}
                      className="shrink-0"
                    >
                      {job.employment_type === 'salary' ? 'Salary' : 'Commission'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {job.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-success">
                      <DollarSign className="h-4 w-4" />
                      {formatCompensation(job)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {isAgencyOwner && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        {job.application_count || 0} application{job.application_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {isSDR && job.user_applied && (
                    <Badge variant="outline" className="w-full justify-center">
                      Applied
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
