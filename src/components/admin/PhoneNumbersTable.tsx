import { useState, useEffect } from 'react';
import { Phone, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';

interface PhoneNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  monthly_cost: number;
  created_at: string;
  workspace_id: string;
  assigned_to: string | null;
  workspace_name?: string;
  profile_name?: string;
  profile_email?: string;
}

export function PhoneNumbersTable() {
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState<PhoneNumber | null>(null);

  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const { data: numbersData, error: numbersError } = await supabase
        .from('workspace_phone_numbers')
        .select('id, phone_number, is_active, monthly_cost, created_at, workspace_id, assigned_to')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (numbersError) throw numbersError;

      if (!numbersData || numbersData.length === 0) {
        setNumbers([]);
        return;
      }

      // Fetch workspace and user data
      const workspaceIds = [...new Set(numbersData.map(n => n.workspace_id))];
      const userIds = [...new Set(numbersData.filter(n => n.assigned_to).map(n => n.assigned_to as string))];

      const [workspacesResult, profilesResult] = await Promise.all([
        supabase.from('workspaces').select('id, name').in('id', workspaceIds),
        userIds.length > 0 ? supabase.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [] }
      ]);

      const workspaceMap = new Map<string, string>();
      workspacesResult.data?.forEach(w => workspaceMap.set(w.id, w.name));

      const profileMap = new Map<string, { full_name: string | null; email: string }>();
      profilesResult.data?.forEach(p => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));

      const enrichedNumbers: PhoneNumber[] = numbersData.map(num => {
        const profile = num.assigned_to ? profileMap.get(num.assigned_to) : undefined;
        return {
          ...num,
          workspace_name: workspaceMap.get(num.workspace_id),
          profile_name: profile?.full_name || undefined,
          profile_email: profile?.email,
        };
      });

      setNumbers(enrichedNumbers);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load phone numbers',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  const handleTerminate = async (number: PhoneNumber) => {
    setTerminatingId(number.id);
    try {
      // Call edge function to release the number from Twilio
      const { error: releaseError } = await supabase.functions.invoke('release-phone-number', {
        body: { phoneNumberId: number.id },
      });

      if (releaseError) throw releaseError;

      toast({
        title: 'Number terminated',
        description: `${number.phone_number} has been released`,
      });

      // Refresh the list
      fetchNumbers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Termination failed',
        description: error.message || 'Failed to terminate phone number',
      });
    } finally {
      setTerminatingId(null);
      setConfirmTerminate(null);
    }
  };

  const activeCount = numbers.length;
  const totalMonthlyCost = numbers.reduce((sum, n) => sum + (n.monthly_cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Active Numbers</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Total Monthly Cost</CardDescription>
            <CardTitle className="text-2xl text-success">${totalMonthlyCost.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Active Phone Numbers
              </CardTitle>
              <CardDescription>
                Manage phone numbers across all workspaces
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchNumbers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active phone numbers
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Monthly Cost</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono font-medium">
                      {number.phone_number}
                    </TableCell>
                    <TableCell>
                      {number.workspace_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {number.profile_name || number.profile_email || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      ${number.monthly_cost?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(number.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmTerminate(number)}
                        disabled={terminatingId === number.id}
                      >
                        {terminatingId === number.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Terminate Confirmation Dialog */}
      <AlertDialog open={!!confirmTerminate} onOpenChange={() => setConfirmTerminate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to terminate {confirmTerminate?.phone_number}? 
              This will release the number from Twilio and it cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTerminate && handleTerminate(confirmTerminate)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
