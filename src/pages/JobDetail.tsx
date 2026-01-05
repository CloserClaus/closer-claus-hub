import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Users,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SDRLevelBadge } from '@/components/ui/sdr-level-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

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
  icp_company_size_min: number | null;
  icp_company_size_max: number | null;
  icp_revenue_min: number | null;
  icp_revenue_max: number | null;
  icp_founding_year_min: number | null;
  icp_founding_year_max: number | null;
  icp_intent_signal: string | null;
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
}

interface Application {
  id: string;
  job_id: string;
  user_id: string;
  status: 'applied' | 'shortlisted' | 'interviewing' | 'hired' | 'rejected';
  cover_letter: string | null;
  applied_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    sdr_level?: number;
    total_deals_closed_value?: number;
  };
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [userApplication, setUserApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showExclusivityWarning, setShowExclusivityWarning] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [currentWorkspaceCount, setCurrentWorkspaceCount] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);

  const isAgencyOwner = userRole === 'agency_owner';
  const isSDR = userRole === 'sdr';

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id, user]);

  const fetchJobDetails = async () => {
    if (!id || !user) return;
    setLoading(true);

    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          workspace:workspaces(name)
        `)
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // For agency owners, fetch all applications
      if (isAgencyOwner) {
        const { data: appData } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', id)
          .order('applied_at', { ascending: false });

        // Fetch profiles for each applicant
        if (appData && appData.length > 0) {
          const userIds = appData.map(a => a.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, sdr_level, total_deals_closed_value')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          
          setApplications(
            appData.map(app => ({
              ...app,
              profile: profileMap.get(app.user_id) || { full_name: null, email: '' },
            }))
          );
        } else {
          setApplications([]);
        }
      }

      // For SDRs, check if they've applied and get workspace count
      if (isSDR) {
        const { data: appData } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        setUserApplication(appData);

        // Get current workspace count and check cooldown
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('id, cooldown_until')
          .eq('user_id', user.id);

        const activeMemberships = memberships?.filter(m => !m.cooldown_until || new Date(m.cooldown_until) < new Date()) || [];
        setCurrentWorkspaceCount(activeMemberships.length);

        // Check if any membership has an active cooldown
        const activeCooldown = memberships?.find(m => m.cooldown_until && new Date(m.cooldown_until) > new Date());
        if (activeCooldown) {
          setCooldownUntil(new Date(activeCooldown.cooldown_until));
        } else {
          setCooldownUntil(null);
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load job details',
      });
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!job || !user) return;

    // Check cooldown
    if (cooldownUntil) {
      const hoursLeft = Math.ceil((cooldownUntil.getTime() - Date.now()) / (1000 * 60 * 60));
      toast({
        variant: 'destructive',
        title: 'Cooldown Active',
        description: `You must wait ${hoursLeft} more hours before applying to new jobs.`,
      });
      return;
    }

    // Check employment rules
    if (job.employment_type === 'salary' && currentWorkspaceCount > 0) {
      setShowExclusivityWarning(true);
      return;
    }

    if (job.employment_type === 'commission_only' && currentWorkspaceCount >= 3) {
      toast({
        variant: 'destructive',
        title: 'Maximum workspaces reached',
        description: 'You can only work with up to 3 agencies on commission-only basis.',
      });
      return;
    }

    setShowApplyDialog(true);
  };

  const submitApplication = async () => {
    if (!job || !user) return;
    setApplying(true);

    try {
      const { error } = await supabase.from('job_applications').insert({
        job_id: job.id,
        user_id: user.id,
        cover_letter: coverLetter || null,
      });

      if (error) throw error;

      toast({
        title: 'Application submitted!',
        description: 'The agency will review your application.',
      });

      setShowApplyDialog(false);
      fetchJobDetails();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to submit application',
      });
    } finally {
      setApplying(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, status: Application['status']) => {
    try {
      // If hiring, check SDR limit first
      if (status === 'hired' && job) {
        // Get workspace info to check SDR limit
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('subscription_tier, max_sdrs')
          .eq('id', job.workspace_id)
          .single();

        if (workspace) {
          // Get current team count
          const { count: currentTeamCount } = await supabase
            .from('workspace_members')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', job.workspace_id)
            .is('removed_at', null);

          if ((currentTeamCount || 0) >= (workspace.max_sdrs || 1)) {
            toast({
              variant: 'destructive',
              title: 'SDR Limit Reached',
              description: `Your ${workspace.subscription_tier?.toUpperCase() || 'current'} plan allows up to ${workspace.max_sdrs} SDR(s). Please upgrade to hire more.`,
            });
            return;
          }
        }
      }

      const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', applicationId);

      if (error) throw error;

      // If hired, add to workspace members and send notification
      if (status === 'hired') {
        const application = applications.find(a => a.id === applicationId);
        if (application && job) {
          // For salary jobs, remove from all other workspaces first
          if (job.employment_type === 'salary') {
            const cooldownTime = new Date();
            cooldownTime.setHours(cooldownTime.getHours() + 48);

            // Remove from all other workspaces
            await supabase
              .from('workspace_members')
              .update({
                removed_at: new Date().toISOString(),
                cooldown_until: cooldownTime.toISOString(),
              })
              .eq('user_id', application.user_id)
              .neq('workspace_id', job.workspace_id)
              .is('removed_at', null);
          }

          // Add to this workspace with is_salary_exclusive flag
          await supabase.from('workspace_members').insert({
            workspace_id: job.workspace_id,
            user_id: application.user_id,
            is_salary_exclusive: job.employment_type === 'salary',
          });

          // Send notification about the SDR joining the team
          try {
            await supabase.functions.invoke('create-notification', {
              body: {
                action: 'sdr_joined',
                workspace_id: job.workspace_id,
                sdr_user_id: application.user_id,
              },
            });
          } catch (notifError) {
            console.error('Failed to send join notification:', notifError);
          }
        }
      }

      toast({
        title: 'Status updated',
        description: `Application status changed to ${status}`,
      });

      fetchJobDetails();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update status',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}M`;
    }
    return `$${amount}K`;
  };

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'applied':
        return 'bg-muted text-muted-foreground';
      case 'shortlisted':
        return 'bg-primary/20 text-primary';
      case 'interviewing':
        return 'bg-warning/20 text-warning';
      case 'hired':
        return 'bg-success/20 text-success';
      case 'rejected':
        return 'bg-destructive/20 text-destructive';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Job Details" />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Job Not Found" />
        <main className="flex-1 p-6">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Job not found</h3>
              <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
            </CardContent>
          </Card>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Job Details" />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/jobs')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>
          {isAgencyOwner && (
            <Button onClick={() => navigate(`/jobs/edit/${job.id}`)}>
              Edit Position
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Job Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">SDR at {job.workspace?.name || 'Agency'}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Building2 className="h-4 w-4" />
                      {job.workspace?.name || 'Unknown Agency'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={job.is_active ? 'default' : 'secondary'}>
                      {job.is_active ? 'Hiring' : 'Closed'}
                    </Badge>
                    <Badge variant="outline">
                      {job.employment_type === 'salary' ? 'Salary + Commission' : 'Commission Only'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dream Outcome */}
                {job.dream_outcome && (
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Dream Outcome
                    </h4>
                    <p className="text-foreground italic">"{job.dream_outcome}"</p>
                  </div>
                )}

                {/* Company Description */}
                {job.company_description && (
                  <div>
                    <h3 className="font-medium mb-2">About the Company</h3>
                    <p className="text-muted-foreground">{job.company_description}</p>
                  </div>
                )}

                {/* What You'll Be Selling */}
                {job.offer_description && (
                  <div>
                    <h3 className="font-medium mb-2">What You'll Be Selling</h3>
                    <p className="text-muted-foreground">{job.offer_description}</p>
                  </div>
                )}

                {job.employment_type === 'salary' && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-warning">Exclusivity Required</p>
                        <p className="text-sm text-muted-foreground">
                          This is a salary position. If hired, you will work exclusively for this
                          agency and will be removed from any other workspaces.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ICP Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ideal Customer Profile
                </CardTitle>
                <CardDescription>Who you'll be prospecting and selling to</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {job.icp_job_titles && job.icp_job_titles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Target Titles</h4>
                      <div className="flex flex-wrap gap-2">
                        {job.icp_job_titles.map((title) => (
                          <Badge key={title} variant="secondary">{title}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.icp_industry && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Industry</h4>
                      <p className="text-foreground">{job.icp_industry}</p>
                    </div>
                  )}

                  {job.icp_company_type && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Company Type</h4>
                      <p className="text-foreground">{job.icp_company_type}</p>
                    </div>
                  )}

                  {(job.icp_company_size_min || job.icp_company_size_max) && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Company Size</h4>
                      <p className="text-foreground">
                        {job.icp_company_size_min && job.icp_company_size_max
                          ? `${job.icp_company_size_min} - ${job.icp_company_size_max} employees`
                          : job.icp_company_size_min
                          ? `${job.icp_company_size_min}+ employees`
                          : `Up to ${job.icp_company_size_max} employees`}
                      </p>
                    </div>
                  )}

                  {(job.icp_revenue_min || job.icp_revenue_max) && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Annual Revenue</h4>
                      <p className="text-foreground">
                        {job.icp_revenue_min && job.icp_revenue_max
                          ? `${formatRevenue(job.icp_revenue_min)} - ${formatRevenue(job.icp_revenue_max)}`
                          : job.icp_revenue_min
                          ? `${formatRevenue(job.icp_revenue_min)}+`
                          : `Up to ${formatRevenue(job.icp_revenue_max!)}`}
                      </p>
                    </div>
                  )}

                  {(job.icp_founding_year_min || job.icp_founding_year_max) && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Founded</h4>
                      <p className="text-foreground">
                        {job.icp_founding_year_min && job.icp_founding_year_max
                          ? `${job.icp_founding_year_min} - ${job.icp_founding_year_max}`
                          : job.icp_founding_year_min
                          ? `${job.icp_founding_year_min} or later`
                          : `Before ${job.icp_founding_year_max}`}
                      </p>
                    </div>
                  )}
                </div>

                {job.icp_intent_signal && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Intent Signals</h4>
                    <p className="text-foreground">{job.icp_intent_signal}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Applications (Agency Owner View) */}
            {isAgencyOwner && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Applications ({applications.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {applications.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No applications yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-4 rounded-lg bg-muted/50 border border-border"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">
                                  {app.profile?.full_name || 'Unknown SDR'}
                                </h4>
                                {app.profile?.sdr_level && (
                                  <SDRLevelBadge level={app.profile.sdr_level} size="sm" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {app.profile?.email}
                              </p>
                              {app.cover_letter && (
                                <p className="text-sm mt-2 text-muted-foreground">
                                  "{app.cover_letter}"
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Applied {new Date(app.applied_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={getStatusColor(app.status)}>
                                {app.status}
                              </Badge>
                              {app.status !== 'hired' && app.status !== 'rejected' && (
                                <div className="flex gap-2 mt-2">
                                  {app.status === 'applied' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateApplicationStatus(app.id, 'shortlisted')}
                                    >
                                      Shortlist
                                    </Button>
                                  )}
                                  {(app.status === 'applied' || app.status === 'shortlisted') && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateApplicationStatus(app.id, 'interviewing')}
                                    >
                                      Interview
                                    </Button>
                                  )}
                                  {app.status === 'interviewing' && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateApplicationStatus(app.id, 'hired')}
                                    >
                                      Hire
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => updateApplicationStatus(app.id, 'rejected')}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Deal Structure Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Deal Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {job.average_ticket_size && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Ticket</span>
                    <span className="font-semibold text-lg">{formatCurrency(job.average_ticket_size)}</span>
                  </div>
                )}
                {job.payment_type && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Revenue Type</span>
                    <Badge variant="outline">
                      {job.payment_type === 'recurring' ? 'Recurring' : 'One-Time'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compensation Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Your Earnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {job.employment_type === 'salary' && job.salary_amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Monthly Salary</span>
                    <span className="font-semibold text-lg">{formatCurrency(job.salary_amount)}</span>
                  </div>
                )}
                {job.commission_percentage && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Commission</span>
                    <span className="font-semibold text-lg">{job.commission_percentage}%</span>
                  </div>
                )}
                {job.average_ticket_size && job.commission_percentage && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center text-primary">
                      <span>Earning per Deal</span>
                      <span className="font-bold text-lg">
                        {formatCurrency((job.average_ticket_size * job.commission_percentage) / 100)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Apply Card (SDR View) */}
            {isSDR && (
              <Card className="glass">
                <CardContent className="pt-6">
                  {userApplication ? (
                    <div className="text-center space-y-2">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-success" />
                      <p className="font-medium">You've Applied</p>
                      <Badge className={getStatusColor(userApplication.status)}>
                        {userApplication.status}
                      </Badge>
                    </div>
                  ) : !job.is_active ? (
                    <div className="text-center space-y-2">
                      <p className="text-muted-foreground">This position is no longer accepting applications</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-center text-muted-foreground">
                        Ready to join {job.workspace?.name || 'this team'} as an SDR?
                      </p>
                      <Button className="w-full" onClick={handleApply}>
                        Apply Now
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Posted Date */}
            <div className="text-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 inline mr-1" />
              Posted {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Apply Dialog */}
        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for SDR Position</DialogTitle>
              <DialogDescription>
                Apply to join {job?.workspace?.name || 'this agency'} as an SDR
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Why are you a great fit? (Optional)</Label>
                <Textarea
                  placeholder="Share your relevant experience, what excites you about this opportunity..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                Cancel
              </Button>
              <Button onClick={submitApplication} disabled={applying}>
                {applying ? 'Submitting...' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exclusivity Warning */}
        <AlertDialog open={showExclusivityWarning} onOpenChange={setShowExclusivityWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salary Position - Exclusivity Required</AlertDialogTitle>
              <AlertDialogDescription>
                This is a salary position that requires exclusivity. If you're hired, you will be
                removed from all other workspaces and won't be able to apply to new jobs for 48
                hours. Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowExclusivityWarning(false);
                  setShowApplyDialog(true);
                }}
              >
                I Understand, Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </DashboardLayout>
  );
}
