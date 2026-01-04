import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Lock, Unlock, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type SubscriptionTier = 'omega' | 'beta' | 'alpha' | null;

const TIER_CONFIG: Record<string, { maxSdrs: number; rake: number }> = {
  omega: { maxSdrs: 1, rake: 2 },
  beta: { maxSdrs: 2, rake: 1.5 },
  alpha: { maxSdrs: 5, rake: 1 },
};

export function AgenciesTable() {
  const [selectedAgency, setSelectedAgency] = useState<{ id: string; name: string; currentTier: SubscriptionTier } | null>(null);
  const [newTier, setNewTier] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: agencies, isLoading, refetch } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async () => {
      const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get owner profiles
      const ownerIds = workspaces?.map(w => w.owner_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return workspaces?.map(w => ({
        ...w,
        owner: profileMap.get(w.owner_id),
        memberCount: (w.workspace_members as any)?.[0]?.count || 0,
      })) || [];
    },
  });

  const toggleLock = async (workspaceId: string, currentlyLocked: boolean) => {
    const { error } = await supabase
      .from('workspaces')
      .update({ is_locked: !currentlyLocked })
      .eq('id', workspaceId);

    if (error) {
      toast.error('Failed to update workspace');
      return;
    }

    toast.success(currentlyLocked ? 'Workspace unlocked' : 'Workspace locked');
    refetch();
  };

  const handleAssignSubscription = async () => {
    if (!selectedAgency || !newTier) return;

    setIsUpdating(true);

    try {
      const tierConfig = TIER_CONFIG[newTier];
      
      const { error } = await supabase
        .from('workspaces')
        .update({
          subscription_tier: newTier as 'omega' | 'beta' | 'alpha',
          subscription_status: 'active',
          max_sdrs: tierConfig.maxSdrs,
          rake_percentage: tierConfig.rake,
        })
        .eq('id', selectedAgency.id);

      if (error) throw error;

      toast.success(`Subscription updated to ${newTier.toUpperCase()} for ${selectedAgency.name}`);
      setSelectedAgency(null);
      setNewTier('');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subscription');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveSubscription = async () => {
    if (!selectedAgency) return;

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          subscription_status: 'cancelled',
        })
        .eq('id', selectedAgency.id);

      if (error) throw error;

      toast.success(`Subscription removed for ${selectedAgency.name}`);
      setSelectedAgency(null);
      setNewTier('');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove subscription');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasActiveSubscription = (agency: any) => {
    return agency.subscription_status === 'active';
  };

  const getDisplayTier = (agency: any) => {
    if (!hasActiveSubscription(agency)) {
      return null;
    }
    return agency.subscription_tier;
  };

  const tierColors: Record<string, string> = {
    omega: 'bg-slate-500/20 text-slate-300',
    beta: 'bg-blue-500/20 text-blue-300',
    alpha: 'bg-amber-500/20 text-amber-300',
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading agencies...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Agencies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agencies && agencies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>SDRs</TableHead>
                  <TableHead>Rake %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((agency) => {
                  const displayTier = getDisplayTier(agency);
                  return (
                    <TableRow key={agency.id}>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agency.owner?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{agency.owner?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {displayTier ? (
                          <Badge className={tierColors[displayTier]}>
                            {displayTier.toUpperCase()}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            None
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {agency.memberCount} / {agency.max_sdrs}
                        </div>
                      </TableCell>
                      <TableCell>{agency.rake_percentage}%</TableCell>
                      <TableCell>
                        <Badge variant={agency.is_locked ? 'destructive' : hasActiveSubscription(agency) ? 'default' : 'secondary'}>
                          {agency.is_locked ? 'Locked' : hasActiveSubscription(agency) ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAgency({
                              id: agency.id,
                              name: agency.name,
                              currentTier: displayTier as SubscriptionTier,
                            })}
                            title="Manage subscription"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLock(agency.id, agency.is_locked || false)}
                            title={agency.is_locked ? 'Unlock' : 'Lock'}
                          >
                            {agency.is_locked ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No agencies registered yet</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAgency} onOpenChange={(open) => !open && setSelectedAgency(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Update subscription for <span className="font-medium">{selectedAgency?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Plan</label>
              <p className="text-sm text-muted-foreground">
                {selectedAgency?.currentTier?.toUpperCase() || 'None'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign New Plan</label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="omega">
                    <div className="flex flex-col">
                      <span>Omega</span>
                      <span className="text-xs text-muted-foreground">$247/mo • 1 SDR • 2% rake</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="beta">
                    <div className="flex flex-col">
                      <span>Beta</span>
                      <span className="text-xs text-muted-foreground">$347/mo • 2 SDRs • 1.5% rake</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="alpha">
                    <div className="flex flex-col">
                      <span>Alpha</span>
                      <span className="text-xs text-muted-foreground">$497/mo • 5 SDRs • 1% rake</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedAgency?.currentTier && (
              <Button
                variant="destructive"
                onClick={handleRemoveSubscription}
                disabled={isUpdating}
                className="sm:mr-auto"
              >
                Remove Subscription
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedAgency(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssignSubscription} disabled={!newTier || isUpdating}>
              {isUpdating ? 'Updating...' : 'Assign Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
