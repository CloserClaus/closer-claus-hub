import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SDRLevelBadge } from "@/components/ui/sdr-level-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Loader2,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Commission {
  id: string;
  amount: number;
  rake_amount: number;
  agency_rake_amount: number;
  platform_cut_percentage: number;
  platform_cut_amount: number;
  sdr_payout_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  deal_id: string;
  sdr_id: string;
  workspace_id: string;
  deals?: {
    title: string;
    value: number;
    leads?: {
      first_name: string;
      last_name: string;
      company: string | null;
    } | null;
  } | null;
  sdr_profile?: {
    full_name: string | null;
    email: string;
    sdr_level?: number;
  } | null;
  workspace?: {
    name: string;
    owner_id?: string;
  } | null;
}

export default function Commissions() {
  const { currentWorkspace, isOwner, loading: workspaceLoading } = useWorkspace();
  const { user, userRole } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [confirmPayCommission, setConfirmPayCommission] = useState<Commission | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id || userRole === 'sdr') {
      fetchCommissions();
    }
  }, [currentWorkspace?.id, userRole, user?.id]);

  const fetchCommissions = async () => {
    if (!currentWorkspace?.id && userRole !== 'sdr') return;
    if (userRole === 'sdr' && !user?.id) return;

    setIsLoading(true);
    
    // Fetch commissions based on role
    let query = supabase
      .from('commissions')
      .select(`
        *,
        deals (
          title,
          value,
          leads (
            first_name,
            last_name,
            company
          )
        ),
        workspace:workspaces (
          name,
          owner_id
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by workspace for agency owners, by SDR ID for SDRs
    if (userRole === 'sdr') {
      query = query.eq('sdr_id', user!.id);
    } else if (currentWorkspace?.id) {
      query = query.eq('workspace_id', currentWorkspace.id);
    }

    const { data: commissionsData, error: commissionsError } = await query;

    if (commissionsError) {
      console.error('Error fetching commissions:', commissionsError);
      toast.error("Failed to load commissions");
      setIsLoading(false);
      return;
    }

    // Fetch SDR profiles in a single batch query (only needed for agency owners)
    if (isOwner && commissionsData && commissionsData.length > 0) {
      const sdrIds = [...new Set(commissionsData.map(c => c.sdr_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, sdr_level')
        .in('id', sdrIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const commissionsWithProfiles = commissionsData.map(commission => ({
        ...commission,
        sdr_profile: profileMap.get(commission.sdr_id) || null,
      }));
      
      setCommissions(commissionsWithProfiles);
    } else {
      setCommissions(commissionsData || []);
    }
    
    setIsLoading(false);
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    setPayingId(commissionId);
    setConfirmPayCommission(null);
    
    try {
      const { error } = await supabase
        .from('commissions')
        .update({ 
          status: 'paid', 
          paid_at: new Date().toISOString() 
        })
        .eq('id', commissionId);

      if (error) {
        toast.error("Failed to mark commission as paid");
        return;
      }

      toast.success("Commission marked as paid");
      fetchCommissions();
    } catch (error) {
      console.error('Error:', error);
      toast.error("An error occurred");
    } finally {
      setPayingId(null);
    }
  };

  const handleConfirmPay = (commission: Commission) => {
    setConfirmPayCommission(commission);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredCommissions = commissions.filter(c => 
    statusFilter === 'all' || c.status === statusFilter
  );

  const stats = {
    // For SDRs: show their net payout; For agencies: show total due (commission + rake)
    totalPending: commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => {
        if (isSDR) {
          return sum + Number(c.sdr_payout_amount || c.amount);
        }
        // Agency sees total due: commission + agency rake
        return sum + Number(c.amount) + Number(c.agency_rake_amount || c.rake_amount);
      }, 0),
    totalPaid: commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => {
        if (isSDR) {
          return sum + Number(c.sdr_payout_amount || c.amount);
        }
        return sum + Number(c.amount) + Number(c.agency_rake_amount || c.rake_amount);
      }, 0),
    totalRake: commissions
      .reduce((sum, c) => sum + Number(c.agency_rake_amount || c.rake_amount), 0),
    totalPlatformCut: commissions
      .reduce((sum, c) => sum + Number(c.platform_cut_amount || 0), 0),
    count: commissions.length,
  };

  // SDRs without any commissions yet
  if (userRole === 'sdr' && commissions.length === 0 && !isLoading) {
    // Allow page to render, will show empty state
  }

  // Non-SDR users without workspace
  if (workspaceLoading && userRole !== 'sdr') {
    return (
      <DashboardLayout>
        <DashboardHeader title="Commissions" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!currentWorkspace && userRole !== 'sdr') {
    return (
      <DashboardLayout>
        <DashboardHeader title="Commissions" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Please select a workspace to view commissions.</p>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  const isSDR = userRole === 'sdr';

  return (
    <DashboardLayout>
      <DashboardHeader title="Commissions" />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8" />
              {isSDR ? 'My Earnings' : 'Commissions'}
            </h1>
            <p className="text-muted-foreground">
              {isSDR ? 'Track your commissions and earnings' : 'Track and manage SDR commissions for closed deals'}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">${stats.totalPending.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Out</p>
                    <p className="text-2xl font-bold">${stats.totalPaid.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isSDR ? 'Platform Fees' : 'Agency Rake'}</p>
                    <p className="text-2xl font-bold">${isSDR ? stats.totalPlatformCut.toLocaleString() : stats.totalRake.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Users className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Commissions</p>
                    <p className="text-2xl font-bold">{stats.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Commissions Table */}
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : filteredCommissions.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No commissions yet</h3>
                <p className="text-muted-foreground">
                  Commissions will appear here when deals are closed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isSDR ? 'Agency' : 'Closed By'}</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Deal Value</TableHead>
                      {isSDR && <TableHead>Gross Commission</TableHead>}
                      {isSDR && <TableHead>Platform Fee</TableHead>}
                      {isSDR && <TableHead>Net Payout</TableHead>}
                      {!isSDR && <TableHead>SDR Commission</TableHead>}
                      {!isSDR && <TableHead>Platform Fee</TableHead>}
                      {!isSDR && <TableHead>Total Due</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      {!isSDR && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((commission) => {
                      // Check if this was closed by the agency (amount is 0 means no SDR involved)
                      const isAgencyClosed = commission.amount === 0 || commission.sdr_id === commission.workspace?.owner_id;
                      const totalAgencyDue = Number(commission.amount) + Number(commission.agency_rake_amount || commission.rake_amount);
                      
                      return (
                        <TableRow key={commission.id}>
                          <TableCell>
                            {isSDR ? (
                              <p className="font-medium">{commission.workspace?.name || 'Agency'}</p>
                            ) : (
                              <div>
                                {isAgencyClosed ? (
                                  <Badge variant="outline" className="bg-muted">Agency Closed</Badge>
                                ) : (
                                  <>
                                    <p className="font-medium">
                                      {commission.sdr_profile?.full_name || 'Unknown SDR'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <SDRLevelBadge level={commission.sdr_profile?.sdr_level || 1} size="sm" />
                                      <span className="text-xs text-muted-foreground">
                                        {commission.sdr_profile?.email}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{commission.deals?.title || 'Unknown Deal'}</p>
                              {commission.deals?.leads && (
                                <p className="text-xs text-muted-foreground">
                                  {commission.deals.leads.first_name} {commission.deals.leads.last_name}
                                  {commission.deals.leads.company && ` • ${commission.deals.leads.company}`}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            ${commission.deals?.value?.toLocaleString() || '0'}
                          </TableCell>
                          {isSDR && (
                            <>
                              <TableCell className="text-muted-foreground">
                                ${Number(commission.amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-destructive">
                                <div className="flex items-center gap-1">
                                  <Percent className="h-3 w-3" />
                                  {commission.platform_cut_percentage || 5}% (${Number(commission.platform_cut_amount || 0).toLocaleString()})
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-success">
                                ${Number(commission.sdr_payout_amount || commission.amount).toLocaleString()}
                              </TableCell>
                            </>
                          )}
                          {!isSDR && (
                            <>
                              <TableCell className="text-muted-foreground">
                                {isAgencyClosed ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  `$${Number(commission.amount).toLocaleString()}`
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                ${Number(commission.agency_rake_amount || commission.rake_amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-medium">
                                ${totalAgencyDue.toLocaleString()}
                              </TableCell>
                            </>
                          )}
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(commission.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        {!isSDR && (
                          <TableCell className="text-right">
                            {commission.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleConfirmPay(commission)}
                                disabled={payingId === commission.id}
                              >
                                {payingId === commission.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Paid
                                  </>
                                )}
                              </Button>
                            )}
                            {commission.status === 'paid' && commission.paid_at && (
                              <span className="text-xs text-muted-foreground">
                                Paid {format(new Date(commission.paid_at), 'MMM d')}
                              </span>
                            )}
                          </TableCell>
                        )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmPayCommission} onOpenChange={(open) => !open && setConfirmPayCommission(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Commission Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark this commission as paid?
                {confirmPayCommission && (
                  <div className="mt-4 p-3 rounded-lg bg-muted space-y-1">
                    <p><strong>SDR:</strong> {confirmPayCommission.sdr_profile?.full_name || 'Unknown'}</p>
                    <p><strong>Deal:</strong> {confirmPayCommission.deals?.title || 'Unknown'}</p>
                    <p><strong>Amount:</strong> ${Number(confirmPayCommission.sdr_payout_amount || confirmPayCommission.amount).toLocaleString()}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmPayCommission && handleMarkAsPaid(confirmPayCommission.id)}>
                Confirm Payment
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </DashboardLayout>
  );
}