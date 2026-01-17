import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, RefreshCw, DollarSign, Building2, User, Calendar, CreditCard, Banknote } from 'lucide-react';

interface SalaryPayment {
  id: string;
  workspace_id: string;
  sdr_id: string;
  job_id: string;
  application_id: string;
  salary_amount: number;
  agency_charged_at: string | null;
  agency_charge_status: string;
  stripe_payment_intent_id: string | null;
  sdr_payout_date: string;
  sdr_payout_status: string;
  sdr_payout_amount: number | null;
  sdr_paid_at: string | null;
  sdr_stripe_transfer_id: string | null;
  hired_at: string;
  created_at: string;
  workspace?: { name: string };
  sdr_profile?: { full_name: string | null; email: string };
  job?: { title: string };
}

export function SalaryPaymentsTable() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [chargeFilter, setChargeFilter] = useState<string>('all');
  const [payoutFilter, setPayoutFilter] = useState<string>('all');
  const [processingPayouts, setProcessingPayouts] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalCharges: 0,
    pendingCharges: 0,
    scheduledPayouts: 0,
    completedPayouts: 0,
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch related data
      const paymentIds = data?.map(p => p.id) || [];
      const workspaceIds = [...new Set(data?.map(p => p.workspace_id) || [])];
      const sdrIds = [...new Set(data?.map(p => p.sdr_id) || [])];
      const jobIds = [...new Set(data?.map(p => p.job_id) || [])];

      // Fetch workspaces
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds);

      // Fetch SDR profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sdrIds);

      // Fetch jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title')
        .in('id', jobIds);

      // Map related data
      const enrichedPayments = data?.map(payment => ({
        ...payment,
        workspace: workspaces?.find(w => w.id === payment.workspace_id),
        sdr_profile: profiles?.find(p => p.id === payment.sdr_id),
        job: jobs?.find(j => j.id === payment.job_id),
      })) || [];

      setPayments(enrichedPayments);

      // Calculate stats
      const totalCharges = enrichedPayments.reduce((sum, p) => 
        p.agency_charge_status === 'paid' ? sum + Number(p.salary_amount) : sum, 0);
      const pendingCharges = enrichedPayments.filter(p => p.agency_charge_status === 'pending').length;
      const scheduledPayouts = enrichedPayments.filter(p => p.sdr_payout_status === 'scheduled').length;
      const completedPayouts = enrichedPayments.filter(p => p.sdr_payout_status === 'paid').length;

      setStats({ totalCharges, pendingCharges, scheduledPayouts, completedPayouts });

    } catch (error: any) {
      console.error('Error fetching salary payments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch salary payments',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const triggerPayoutProcessing = async () => {
    setProcessingPayouts(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-salary-payouts', {
        body: {},
      });

      if (error) throw error;

      toast({
        title: 'Payouts Processed',
        description: `Processed: ${data.processed}, Successful: ${data.successful}, Failed: ${data.failed}, Held: ${data.held}`,
      });

      fetchPayments();
    } catch (error: any) {
      console.error('Error processing payouts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to process payouts',
      });
    } finally {
      setProcessingPayouts(false);
    }
  };

  const getChargeStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Scheduled</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">Processing</Badge>;
      case 'held':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Held</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.workspace?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.sdr_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.sdr_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.job?.title?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCharge = chargeFilter === 'all' || payment.agency_charge_status === chargeFilter;
    const matchesPayout = payoutFilter === 'all' || payment.sdr_payout_status === payoutFilter;

    return matchesSearch && matchesCharge && matchesPayout;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Charged</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCharges.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From agencies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Charges</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCharges}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Payouts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledPayouts}</div>
            <p className="text-xs text-muted-foreground">Upcoming SDR payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedPayouts}</div>
            <p className="text-xs text-muted-foreground">SDRs paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by agency, SDR, or job..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={chargeFilter} onValueChange={setChargeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Charge Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Charges</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={payoutFilter} onValueChange={setPayoutFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Payout Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payouts</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="held">Held</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={fetchPayments} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button 
          onClick={triggerPayoutProcessing} 
          disabled={processingPayouts}
          className="gap-2"
        >
          {processingPayouts ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Banknote className="h-4 w-4" />
          )}
          Process Payouts Now
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead>Hired</TableHead>
                <TableHead>Agency Charge</TableHead>
                <TableHead>Payout Date</TableHead>
                <TableHead>Payout Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No salary payments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{payment.workspace?.name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{payment.sdr_profile?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{payment.sdr_profile?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{payment.job?.title || 'Unknown'}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(payment.salary_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.hired_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getChargeStatusBadge(payment.agency_charge_status)}
                        {payment.agency_charged_at && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.agency_charged_at), 'MMM d')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.sdr_payout_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getPayoutStatusBadge(payment.sdr_payout_status)}
                        {payment.sdr_paid_at && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.sdr_paid_at), 'MMM d')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
