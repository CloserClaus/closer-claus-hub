import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Shield, Mail, Users, CreditCard, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifyEmailDialogOpen, setVerifyEmailDialogOpen] = useState(false);
  const [unlockWorkspaceDialogOpen, setUnlockWorkspaceDialogOpen] = useState(false);
  const [bypassSubscriptionDialogOpen, setBypassSubscriptionDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  // Fetch all users for email verification bypass
  const { data: users } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, email_verified')
        .order('created_at', { ascending: false });
      return profiles || [];
    },
  });

  // Fetch all workspaces for unlock/subscription bypass
  const { data: workspaces } = useQuery({
    queryKey: ['admin-all-workspaces'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workspaces')
        .select('id, name, owner_id, is_locked, subscription_status, subscription_tier')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Verify email mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      toast({
        title: 'Email Verified',
        description: 'User email has been marked as verified.',
      });
      setVerifyEmailDialogOpen(false);
      setSelectedUserId('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  // Unlock workspace mutation
  const unlockWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const { error } = await supabase
        .from('workspaces')
        .update({ is_locked: false })
        .eq('id', workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-workspaces'] });
      toast({
        title: 'Workspace Unlocked',
        description: 'Workspace has been unlocked successfully.',
      });
      setUnlockWorkspaceDialogOpen(false);
      setSelectedWorkspaceId('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  // Bypass subscription mutation
  const bypassSubscriptionMutation = useMutation({
    mutationFn: async ({ workspaceId, tier }: { workspaceId: string; tier: string }) => {
      const maxSdrs = tier === 'alpha' ? 5 : tier === 'beta' ? 2 : 1;
      const rakePercentage = tier === 'alpha' ? 1 : tier === 'beta' ? 1.5 : 2;
      
      const { error } = await supabase
        .from('workspaces')
        .update({
          subscription_status: 'active',
          subscription_tier: tier as 'omega' | 'beta' | 'alpha',
          max_sdrs: maxSdrs,
          rake_percentage: rakePercentage,
          is_locked: false,
        })
        .eq('id', workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-workspaces'] });
      toast({
        title: 'Subscription Bypassed',
        description: 'Workspace subscription has been activated.',
      });
      setBypassSubscriptionDialogOpen(false);
      setSelectedWorkspaceId('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const [selectedTier, setSelectedTier] = useState<string>('omega');

  const unverifiedUsers = users?.filter(u => !u.email_verified) || [];
  const lockedWorkspaces = workspaces?.filter(w => w.is_locked) || [];
  const pendingWorkspaces = workspaces?.filter(w => w.subscription_status !== 'active') || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Admin Controls
        </h2>
        <p className="text-muted-foreground mt-1">
          Bypass platform limitations and manage user access
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Email Verification Bypass */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Email Verification</CardTitle>
                <CardDescription>Bypass email verification</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unverified users</span>
              <span className="font-semibold text-warning">{unverifiedUsers.length}</span>
            </div>
            <Dialog open={verifyEmailDialogOpen} onOpenChange={setVerifyEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify User Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Verify User Email</DialogTitle>
                  <DialogDescription>
                    Select a user to mark their email as verified.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unverifiedUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email} ({user.email})
                          </SelectItem>
                        ))}
                        {unverifiedUsers.length === 0 && (
                          <SelectItem value="none" disabled>
                            All users are verified
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => verifyEmailMutation.mutate(selectedUserId)}
                    disabled={!selectedUserId || verifyEmailMutation.isPending}
                  >
                    {verifyEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Email
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Unlock Workspace */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-base">Workspace Lock</CardTitle>
                <CardDescription>Unlock locked workspaces</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Locked workspaces</span>
              <span className="font-semibold text-warning">{lockedWorkspaces.length}</span>
            </div>
            <Dialog open={unlockWorkspaceDialogOpen} onOpenChange={setUnlockWorkspaceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  Unlock Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Unlock Workspace</DialogTitle>
                  <DialogDescription>
                    Select a workspace to unlock and restore access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Workspace</Label>
                    <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a workspace..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lockedWorkspaces.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            {ws.name}
                          </SelectItem>
                        ))}
                        {lockedWorkspaces.length === 0 && (
                          <SelectItem value="none" disabled>
                            No locked workspaces
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => unlockWorkspaceMutation.mutate(selectedWorkspaceId)}
                    disabled={!selectedWorkspaceId || unlockWorkspaceMutation.isPending}
                  >
                    {unlockWorkspaceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Unlock Workspace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Subscription Bypass */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle className="text-base">Subscription</CardTitle>
                <CardDescription>Activate subscriptions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending subscriptions</span>
              <span className="font-semibold text-warning">{pendingWorkspaces.length}</span>
            </div>
            <Dialog open={bypassSubscriptionDialogOpen} onOpenChange={setBypassSubscriptionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Activate Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Activate Subscription</DialogTitle>
                  <DialogDescription>
                    Grant a subscription tier to a workspace without payment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Workspace</Label>
                    <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a workspace..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces?.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            {ws.name} ({ws.subscription_status || 'pending'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subscription Tier</Label>
                    <Select value={selectedTier} onValueChange={setSelectedTier}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="omega">Omega (1 SDR, 2% rake)</SelectItem>
                        <SelectItem value="beta">Beta (2 SDRs, 1.5% rake)</SelectItem>
                        <SelectItem value="alpha">Alpha (5 SDRs, 1% rake)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => bypassSubscriptionMutation.mutate({ 
                      workspaceId: selectedWorkspaceId, 
                      tier: selectedTier 
                    })}
                    disabled={!selectedWorkspaceId || bypassSubscriptionMutation.isPending}
                  >
                    {bypassSubscriptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Activate Subscription
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Summary */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Admin Capabilities Summary</CardTitle>
          <CardDescription>Your platform admin powers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Verify any user's email</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Unlock locked workspaces</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Grant subscriptions for free</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Override deal values</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Resolve all disputes</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Manage all commissions</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>View all conversations</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Manage SDR payouts</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
