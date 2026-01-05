import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Briefcase, DollarSign, Building2, Target, TrendingUp, Users } from 'lucide-react';
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
import { format } from 'date-fns';

interface Job {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  company_description: string | null;
  offer_description: string | null;
  dream_outcome: string | null;
  icp_job_titles: string[] | null;
  icp_industry: string | null;
  icp_company_type: string | null;
  average_ticket_size: number | null;
  payment_type: string | null;
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
  const [industryFilter, setIndustryFilter] = useState<string>('all');

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

  const industries = [...new Set(jobs.map((job) => job.icp_industry).filter(Boolean))];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      !searchQuery ||
      job.workspace?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.dream_outcome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.icp_industry?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEmployment = employmentFilter === 'all' || job.employment_type === employmentFilter;
    const matchesIndustry = industryFilter === 'all' || job.icp_industry === industryFilter;

    return matchesSearch && matchesEmployment && matchesIndustry;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Jobs" />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {isAgencyOwner ? 'My SDR Positions' : 'SDR Opportunities'}
            </h1>
            <p className="text-muted-foreground">
              {isAgencyOwner
                ? 'Create and manage SDR positions for your agency'
                : 'Browse available positions and apply'}
            </p>
          </div>
          {isAgencyOwner && (
            <Button onClick={() => navigate('/jobs/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Post Position
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, industry, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry!}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="commission_only">Commission Only</SelectItem>
              <SelectItem value="salary">Salary + Commission</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
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
                    ? 'No positions posted yet'
                    : 'No positions available'
                  : 'No matching positions found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {isAgencyOwner
                  ? 'Create your first SDR position to start hiring'
                  : 'Check back later for new opportunities'}
              </p>
              {isAgencyOwner && (
                <Button onClick={() => navigate('/jobs/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post Your First Position
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="glass hover:glow-sm transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Company & Role Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            SDR at {job.workspace?.name || 'Agency'}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant={job.is_active ? 'default' : 'secondary'}>
                              {job.is_active ? 'Hiring' : 'Closed'}
                            </Badge>
                            <Badge variant="outline">
                              {job.employment_type === 'salary' ? 'Salary + Commission' : 'Commission Only'}
                            </Badge>
                            {job.payment_type && (
                              <Badge variant="outline">
                                {job.payment_type === 'recurring' ? 'Recurring' : 'One-Time'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {job.dream_outcome && (
                        <p className="text-muted-foreground text-sm italic">
                          "{job.dream_outcome}"
                        </p>
                      )}

                      {/* ICP Summary */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {job.icp_industry && (
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            {job.icp_industry}
                          </span>
                        )}
                        {job.icp_company_type && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {job.icp_company_type}
                          </span>
                        )}
                        {job.icp_job_titles && job.icp_job_titles.length > 0 && (
                          <span className="flex items-center gap-1">
                            Targeting: {job.icp_job_titles.slice(0, 2).join(', ')}
                            {job.icp_job_titles.length > 2 && ` +${job.icp_job_titles.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Compensation & Stats */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        {job.average_ticket_size && job.commission_percentage && (
                          <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency((job.average_ticket_size * job.commission_percentage) / 100)}
                            <span className="text-xs font-normal text-muted-foreground">/deal</span>
                          </div>
                        )}
                        {job.employment_type === 'salary' && job.salary_amount && (
                          <div className="text-sm text-muted-foreground">
                            + {formatCurrency(job.salary_amount)}/mo salary
                          </div>
                        )}
                      </div>

                      {job.average_ticket_size && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {formatCurrency(job.average_ticket_size)} avg ticket
                        </div>
                      )}

                      {isAgencyOwner && (
                        <div className="text-sm text-muted-foreground">
                          {job.application_count || 0} applicant{job.application_count !== 1 ? 's' : ''}
                        </div>
                      )}

                      {isSDR && job.user_applied && (
                        <Badge variant="outline">Applied</Badge>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Posted {format(new Date(job.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
