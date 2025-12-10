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
            .select('id, full_name, email')
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

  const formatCompensation = (job: Job) => {
    if (job.employment_type === 'salary' && job.salary_amount) {
      return `$${job.salary_amount.toLocaleString()}/month`;
    }
    if (job.commission_percentage) {
      return `${job.commission_percentage}% commission`;
    }
    return 'Compensation TBD';
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
        <Button variant="ghost" onClick={() => navigate('/jobs')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Job Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{job.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Building2 className="h-4 w-4" />
                      {job.workspace?.name || 'Unknown Agency'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={job.employment_type === 'salary' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {job.employment_type === 'salary' ? 'Salary' : 'Commission Only'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-success">
                    <DollarSign className="h-5 w-5" />
                    <span className="font-medium">{formatCompensation(job)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span>Posted {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>

                {job.requirements && job.requirements.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Requirements</h3>
                    <ul className="space-y-2">
                      {job.requirements.map((req, index) => (
                        <li key={index} className="flex items-start gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                          {req}
                        </li>
                      ))}
                    </ul>
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
                            <div>
                              <p className="font-medium">
                                {app.profile?.full_name || 'Unknown'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {app.profile?.email}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Applied {new Date(app.applied_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className={getStatusColor(app.status)}>
                              {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                            </Badge>
                          </div>

                          {app.cover_letter && (
                            <p className="mt-3 text-sm text-muted-foreground">
                              "{app.cover_letter}"
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-4">
                            {app.status === 'applied' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updateApplicationStatus(app.id, 'shortlisted')}
                                >
                                  Shortlist
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateApplicationStatus(app.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {app.status === 'shortlisted' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updateApplicationStatus(app.id, 'interviewing')}
                                >
                                  Move to Interview
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateApplicationStatus(app.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {app.status === 'interviewing' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-success hover:bg-success/90"
                                  onClick={() => updateApplicationStatus(app.id, 'hired')}
                                >
                                  Hire
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateApplicationStatus(app.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Apply Section (SDR View) */}
          {isSDR && (
            <div>
              <Card className="glass sticky top-20">
                <CardHeader>
                  <CardTitle>Apply for this position</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userApplication ? (
                    <div className="text-center space-y-4">
                      <Badge className={`${getStatusColor(userApplication.status)} text-base px-4 py-2`}>
                        {userApplication.status.charAt(0).toUpperCase() +
                          userApplication.status.slice(1)}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        You applied on{' '}
                        {new Date(userApplication.applied_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          <strong>Compensation:</strong> {formatCompensation(job)}
                        </p>
                        <p>
                          <strong>Type:</strong>{' '}
                          {job.employment_type === 'salary'
                            ? 'Salary (Exclusive)'
                            : 'Commission Only'}
                        </p>
                      </div>
                      <Button onClick={handleApply} className="w-full">
                        Apply Now
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Apply Dialog */}
        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for {job.title}</DialogTitle>
              <DialogDescription>
                Submit your application to {job.workspace?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cover-letter">Cover Letter (Optional)</Label>
                <Textarea
                  id="cover-letter"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Tell the agency why you're a great fit..."
                  rows={5}
                  className="mt-2 bg-muted border-border"
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
              <AlertDialogTitle>Exclusivity Required</AlertDialogTitle>
              <AlertDialogDescription>
                This is a salary position that requires exclusivity. If you're hired, you will be
                automatically removed from all other workspaces. You currently work with{' '}
                {currentWorkspaceCount} other {currentWorkspaceCount === 1 ? 'agency' : 'agencies'}.
                <br />
                <br />
                Are you sure you want to apply?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setShowExclusivityWarning(false);
                setShowApplyDialog(true);
              }}>
                I Understand, Apply Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </DashboardLayout>
  );
}
