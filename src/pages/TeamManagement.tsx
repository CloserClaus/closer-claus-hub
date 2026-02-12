import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserMinus, Mail, Calendar, Briefcase, AlertTriangle, Building2, LogOut, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { SubscriptionGuard } from '@/components/layout/SubscriptionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { format, addHours, isFuture } from 'date-fns';

interface TeamMember {
  id: string;
  user_id: string;
  joined_at: string;
  is_salary_exclusive: boolean;
  profile: {
    full_name: string | null;
    email: string;
  };
}

interface SDRWorkspace {
  id: string;
  workspace_id: string;
  joined_at: string;
  is_salary_exclusive: boolean;
  pending_leave_at: string | null;
  workspace: {
    id: string;
    name: string;
    owner_id: string;
  };
  owner_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function TeamManagement() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [workspaceToLeave, setWorkspaceToLeave] = useState<SDRWorkspace | null>(null);
  const [leaveReason, setLeaveReason] = useState('');

  // Agency owner: fetch team members
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['team-members', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];

      const { data: members, error } = await supabase
        .from('workspace_members')
        .select('id, user_id, joined_at, is_salary_exclusive')
        .eq('workspace_id', currentWorkspace.id)
        .is('removed_at', null);

      if (error) throw error;

      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return members.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || { full_name: null, email: '' },
      })) as TeamMember[];
    },
    enabled: !!currentWorkspace && userRole === 'agency_owner',
  });

  // SDR: fetch workspaces they belong to
  const { data: sdrWorkspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['sdr-workspaces', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: memberships, error } = await supabase
        .from('workspace_members')
        .select(`
          id,
          workspace_id,
          joined_at,
          is_salary_exclusive,
          pending_leave_at,
          workspaces!inner (
            id,
            name,
            owner_id
          )
        `)
        .eq('user_id', user.id)
        .is('removed_at', null);

      if (error) throw error;

      if (!memberships || memberships.length === 0) return [];

      // Fetch owner profiles
      const ownerIds = [...new Set(memberships.map(m => (m.workspaces as any).owner_id))];
      const { data: ownerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);

      const ownerMap = new Map(ownerProfiles?.map(p => [p.id, p]) || []);

      return memberships.map(m => ({
        id: m.id,
        workspace_id: m.workspace_id,
        joined_at: m.joined_at,
        is_salary_exclusive: m.is_salary_exclusive,
        pending_leave_at: m.pending_leave_at,
        workspace: m.workspaces as { id: string; name: string; owner_id: string },
        owner_profile: ownerMap.get((m.workspaces as any).owner_id) || null,
      })) as SDRWorkspace[];
    },
    enabled: !!user && userRole === 'sdr',
  });

  // Agency owner: remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId, userId, reason }: { memberId: string; userId: string; reason: string }) => {
      if (!currentWorkspace) throw new Error('No workspace selected');

      const cooldownUntil = new Date();
      cooldownUntil.setHours(cooldownUntil.getHours() + 48);

      const { error } = await supabase
        .from('workspace_members')
        .update({
          removed_at: new Date().toISOString(),
          cooldown_until: cooldownUntil.toISOString(),
        })
        .eq('id', memberId);

      if (error) throw error;

      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'sdr_removed',
            workspace_id: currentWorkspace.id,
            sdr_user_id: userId,
            reason: reason || undefined,
          },
        });
      } catch (notifError) {
        console.error('Failed to send removal notification:', notifError);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Team member removed',
        description: 'They will still receive commissions for deals closing within 14 days.',
      });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setMemberToRemove(null);
      setRemovalReason('');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to remove team member',
      });
    },
  });

  // SDR: initiate leave with 24-hour notice
  const initiateLeave = useMutation({
    mutationFn: async ({ membershipId, workspaceId, workspaceName, reason }: { 
      membershipId: string; 
      workspaceId: string;
      workspaceName: string;
      reason: string;
    }) => {
      const leaveAt = addHours(new Date(), 24);

      const { error } = await supabase
        .from('workspace_members')
        .update({
          pending_leave_at: leaveAt.toISOString(),
        })
        .eq('id', membershipId);

      if (error) throw error;

      // Notify the agency owner
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id, name')
        .eq('id', workspaceId)
        .single();

      if (workspace) {
        try {
          await supabase.functions.invoke('create-notification', {
            body: {
              action: 'sdr_leaving',
              workspace_id: workspaceId,
              target_user_id: workspace.owner_id,
              sdr_user_id: user?.id,
              reason: reason || undefined,
              leave_at: leaveAt.toISOString(),
            },
          });
        } catch (notifError) {
          console.error('Failed to send leave notification:', notifError);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Leave notice submitted',
        description: 'Your 24-hour notice period has started. You will be removed from this agency after the notice period ends.',
      });
      queryClient.invalidateQueries({ queryKey: ['sdr-workspaces'] });
      setWorkspaceToLeave(null);
      setLeaveReason('');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to initiate leave',
      });
    },
  });

  // SDR: cancel pending leave
  const cancelLeave = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ pending_leave_at: null })
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Leave cancelled',
        description: 'Your leave notice has been cancelled.',
      });
      queryClient.invalidateQueries({ queryKey: ['sdr-workspaces'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to cancel leave',
      });
    },
  });

  const handleRemoveMember = () => {
    if (!memberToRemove) return;
    removeMemberMutation.mutate({
      memberId: memberToRemove.id,
      userId: memberToRemove.user_id,
      reason: removalReason,
    });
  };

  const handleLeaveCompany = () => {
    if (!workspaceToLeave) return;
    initiateLeave.mutate({
      membershipId: workspaceToLeave.id,
      workspaceId: workspaceToLeave.workspace_id,
      workspaceName: workspaceToLeave.workspace.name,
      reason: leaveReason,
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  // SDR View
  if (userRole === 'sdr') {
    return (
      <DashboardLayout>
        <DashboardHeader title="My Companies" />
        <main className="flex-1 p-3 md:p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">My Companies</h1>
            <p className="text-muted-foreground">
              Companies you are currently working with
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardDescription>Active Companies</CardDescription>
                <CardTitle className="text-2xl">{sdrWorkspaces?.length || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardDescription>Salary Positions</CardDescription>
                <CardTitle className="text-2xl">
                  {sdrWorkspaces?.filter(w => w.is_salary_exclusive).length || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardDescription>Commission Only</CardDescription>
                <CardTitle className="text-2xl">
                  {sdrWorkspaces?.filter(w => !w.is_salary_exclusive).length || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Companies List */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                My Companies
              </CardTitle>
              <CardDescription>
                Agencies you are currently employed with
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWorkspaces ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/4" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !sdrWorkspaces || sdrWorkspaces.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No companies yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Apply to job listings to start working with agencies.
                  </p>
                  <Button onClick={() => window.location.href = '/jobs'}>
                    <Briefcase className="h-4 w-4 mr-2" />
                    Browse Jobs
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sdrWorkspaces.map(ws => {
                    const hasPendingLeave = ws.pending_leave_at && isFuture(new Date(ws.pending_leave_at));
                    
                    return (
                      <div
                        key={ws.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          hasPendingLeave 
                            ? 'bg-warning/10 border-warning/30' 
                            : 'bg-muted/50 border-border hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {ws.workspace.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{ws.workspace.name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              {ws.owner_profile && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {ws.owner_profile.full_name || ws.owner_profile.email}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Joined {format(new Date(ws.joined_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                            {hasPendingLeave && (
                              <div className="flex items-center gap-1 mt-1 text-sm text-warning">
                                <Clock className="h-3 w-3" />
                                Leaving on {format(new Date(ws.pending_leave_at!), 'MMM d, yyyy h:mm a')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={ws.is_salary_exclusive ? 'default' : 'secondary'}>
                            {ws.is_salary_exclusive ? 'Salary' : 'Commission'}
                          </Badge>
                          {hasPendingLeave ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelLeave.mutate(ws.id)}
                              disabled={cancelLeave.isPending}
                            >
                              Cancel Leave
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setWorkspaceToLeave(ws)}
                            >
                              <LogOut className="h-4 w-4 mr-1" />
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Company Dialog */}
          <AlertDialog open={!!workspaceToLeave} onOpenChange={(open) => {
            if (!open) {
              setWorkspaceToLeave(null);
              setLeaveReason('');
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Company</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave {workspaceToLeave?.workspace.name}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-warning">24-Hour Notice Period</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Your leave will take effect 24 hours from now</li>
                        <li>You will still receive commissions for deals closing within 14 days</li>
                        <li>You can cancel this leave before the notice period ends</li>
                        <li>The agency will be notified of your decision</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leave-reason">Reason for leaving (optional)</Label>
                  <Textarea
                    id="leave-reason"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Let the agency know why you're leaving..."
                    className="bg-muted border-border"
                    rows={3}
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeaveCompany}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={initiateLeave.isPending}
                >
                  {initiateLeave.isPending ? 'Submitting...' : 'Submit Leave Notice'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </DashboardLayout>
    );
  }

  // Agency Owner View (existing)
  if (userRole !== 'agency_owner') {
    return (
      <DashboardLayout>
        <DashboardHeader title="Team Management" />
        <main className="flex-1 p-3 md:p-6">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                Only agency owners can access team management.
              </p>
            </CardContent>
          </Card>
        </main>
      </DashboardLayout>
    );
  }

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Team Management" />
        <main className="flex-1 p-3 md:p-6">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
              <p className="text-muted-foreground">
                Create a workspace to manage your team.
              </p>
            </CardContent>
          </Card>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Team Management" />
      <SubscriptionGuard feature="team">
        <main className="flex-1 p-3 md:p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Your Team</h1>
            <p className="text-muted-foreground">
              Manage SDRs working in your agency
            </p>
          </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Total SDRs</CardDescription>
              <CardTitle className="text-2xl">{teamMembers?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Salary (Exclusive)</CardDescription>
              <CardTitle className="text-2xl">
                {teamMembers?.filter(m => m.is_salary_exclusive).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription>Commission Only</CardDescription>
              <CardTitle className="text-2xl">
                {teamMembers?.filter(m => !m.is_salary_exclusive).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Team Members List */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              SDRs currently working for {currentWorkspace.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTeam ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !teamMembers || teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No team members yet</h3>
                <p className="text-muted-foreground mb-4">
                  Post a job listing to start hiring SDRs for your agency.
                </p>
                <Button onClick={() => window.location.href = '/jobs/new'}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Post a Job
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(member.profile.full_name, member.profile.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.profile.full_name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.profile.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={member.is_salary_exclusive ? 'default' : 'secondary'}>
                        {member.is_salary_exclusive ? 'Salary' : 'Commission'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setMemberToRemove(member)}
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remove Member Dialog */}
        <AlertDialog open={!!memberToRemove} onOpenChange={(open) => {
          if (!open) {
            setMemberToRemove(null);
            setRemovalReason('');
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {memberToRemove?.profile.full_name || memberToRemove?.profile.email} from your team?
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning">Important Notes:</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li>They will still receive commissions for deals closing within 14 days</li>
                      <li>They will retain read-only access to previous conversations</li>
                      <li>A 48-hour cooldown will apply before they can join new agencies</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="removal-reason">Reason for removal (optional)</Label>
                <Textarea
                  id="removal-reason"
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Provide a reason for the removal..."
                  className="bg-muted border-border"
                  rows={3}
                />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removeMemberMutation.isPending}
              >
                {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}