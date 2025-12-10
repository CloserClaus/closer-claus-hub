import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Commission {
  id: string;
  amount: number;
  rake_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  deal_id: string;
  sdr_id: string;
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
  } | null;
}

export default function Commissions() {
  const { currentWorkspace, isOwner } = useWorkspace();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchCommissions();
    }
  }, [currentWorkspace?.id]);

  const fetchCommissions = async () => {
    if (!currentWorkspace?.id) return;

    setIsLoading(true);
    
    // Fetch commissions with deal info
    const { data: commissionsData, error: commissionsError } = await supabase
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
        )
      `)
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (commissionsError) {
      console.error('Error fetching commissions:', commissionsError);
      toast.error("Failed to load commissions");
      setIsLoading(false);
      return;
    }

    // Fetch SDR profiles for each commission
    const commissionsWithProfiles: Commission[] = [];
    for (const commission of commissionsData || []) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', commission.sdr_id)
        .maybeSingle();

      commissionsWithProfiles.push({
        ...commission,
        sdr_profile: profile,
      });
    }

    setCommissions(commissionsWithProfiles);
    setIsLoading(false);
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    setPayingId(commissionId);
    
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
    totalPending: commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount), 0),
    totalPaid: commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0),
    totalRake: commissions
      .reduce((sum, c) => sum + Number(c.rake_amount), 0),
    count: commissions.length,
  };

  if (!currentWorkspace) {
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

  if (!isOwner) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Commissions" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Only workspace owners can manage commissions.</p>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Commissions" />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8" />
              Commissions
            </h1>
            <p className="text-muted-foreground">
              Track and manage SDR commissions for closed deals
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
                    <p className="text-sm text-muted-foreground">Platform Rake</p>
                    <p className="text-2xl font-bold">${stats.totalRake.toLocaleString()}</p>
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
                      <TableHead>SDR</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Deal Value</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Rake</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {commission.sdr_profile?.full_name || 'Unknown SDR'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {commission.sdr_profile?.email}
                            </p>
                          </div>
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
                        <TableCell className="font-medium text-success">
                          ${Number(commission.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          ${Number(commission.rake_amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(commission.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          {commission.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsPaid(commission.id)}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}