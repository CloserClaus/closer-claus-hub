import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  PauseCircle,
  RefreshCw,
  DollarSign,
  CreditCard,
  ExternalLink,
  Loader2,
  BanknoteIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface Payout {
  id: string;
  amount: number;
  sdr_payout_amount: number | null;
  sdr_payout_status: string | null;
  sdr_payout_stripe_transfer_id: string | null;
  sdr_paid_at: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  deals?: {
    title: string;
    value: number;
  } | null;
  workspace?: {
    name: string;
  } | null;
}

interface BankAccount {
  stripe_connect_account_id: string | null;
  stripe_connect_status: string | null;
  stripe_connect_onboarded_at: string | null;
}

export function PayoutsTab() {
  const { user } = useAuth();
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Fetch bank account status
  const { data: bankAccount, isLoading: bankLoading } = useQuery({
    queryKey: ['sdr-bank-account', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_connect_account_id, stripe_connect_status, stripe_connect_onboarded_at')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data as BankAccount;
    },
    enabled: !!user?.id,
  });

  // Fetch payout history
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['sdr-payouts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          sdr_payout_amount,
          sdr_payout_status,
          sdr_payout_stripe_transfer_id,
          sdr_paid_at,
          status,
          paid_at,
          created_at,
          deals (title, value),
          workspace:workspaces (name)
        `)
        .eq('sdr_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Payout[];
    },
    enabled: !!user?.id,
  });

  const handleSetupBank = async () => {
    setIsSettingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account');
      if (error) throw error;
      if (data?.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else if (data?.login_url) {
        window.open(data.login_url, '_blank');
      }
    } catch (error) {
      console.error('Error setting up bank:', error);
      toast.error('Failed to start bank setup');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleViewDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-connect-dashboard-link');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error getting dashboard link:', error);
      toast.error('Failed to open payout dashboard');
    }
  };

  const getPayoutStatusBadge = (status: string | null, paidAt: string | null) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            {paidAt ? `Paid ${format(new Date(paidAt), 'MMM d, yyyy')}` : 'Paid'}
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'held':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <PauseCircle className="h-3 w-3 mr-1" />
            Held - Connect Bank
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-muted">
            <Clock className="h-3 w-3 mr-1" />
            Awaiting Payment
          </Badge>
        );
    }
  };

  // Stats calculations
  const stats = {
    totalReceived: payouts?.filter(p => p.sdr_payout_status === 'paid')
      .reduce((sum, p) => sum + Number(p.sdr_payout_amount || p.amount), 0) || 0,
    processing: payouts?.filter(p => p.sdr_payout_status === 'processing')
      .reduce((sum, p) => sum + Number(p.sdr_payout_amount || p.amount), 0) || 0,
    held: payouts?.filter(p => p.sdr_payout_status === 'held')
      .reduce((sum, p) => sum + Number(p.sdr_payout_amount || p.amount), 0) || 0,
    awaiting: payouts?.filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.sdr_payout_amount || p.amount), 0) || 0,
  };

  const isConnected = bankAccount?.stripe_connect_status === 'active';

  if (bankLoading || payoutsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank Account Card */}
      <Card className={isConnected ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BanknoteIcon className="h-5 w-5" />
            Bank Account
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? 'Your bank account is connected and ready to receive payouts'
              : 'Connect your bank account to receive commission payouts'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {isConnected ? (
                <>
                  <Badge className="bg-success/20 text-success text-sm py-1 px-3">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Connected
                  </Badge>
                  {bankAccount?.stripe_connect_onboarded_at && (
                    <span className="text-sm text-muted-foreground">
                      Connected {format(new Date(bankAccount.stripe_connect_onboarded_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </>
              ) : (
                <Badge className="bg-warning/20 text-warning text-sm py-1 px-3">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Not Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {isConnected ? (
                <Button variant="outline" onClick={handleViewDashboard}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Payout Dashboard
                </Button>
              ) : (
                <Button onClick={handleSetupBank} disabled={isSettingUp}>
                  {isSettingUp ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Connect Bank Account
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Received</p>
                <p className="text-2xl font-bold text-success">${stats.totalReceived.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">${stats.processing.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <PauseCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Held</p>
                <p className="text-2xl font-bold text-warning">${stats.held.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Awaiting</p>
                <p className="text-2xl font-bold">${stats.awaiting.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            All your commission payouts and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Deal Value</TableHead>
                  <TableHead>Your Payout</TableHead>
                  <TableHead>Agency Payment</TableHead>
                  <TableHead>Payout Status</TableHead>
                  <TableHead>Transfer ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {payout.deals?.title || 'Unknown Deal'}
                    </TableCell>
                    <TableCell>
                      {payout.workspace?.name || 'Unknown Agency'}
                    </TableCell>
                    <TableCell>
                      ${payout.deals?.value?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="font-medium text-success">
                      ${Number(payout.sdr_payout_amount || payout.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {payout.status === 'paid' ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/20">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getPayoutStatusBadge(payout.sdr_payout_status, payout.sdr_paid_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payout.sdr_payout_stripe_transfer_id ? (
                        <span title={payout.sdr_payout_stripe_transfer_id}>
                          {payout.sdr_payout_stripe_transfer_id.substring(0, 12)}...
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payout.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No payouts yet</h3>
              <p className="text-muted-foreground">
                Commission payouts will appear here when agencies pay for closed deals.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
