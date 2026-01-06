import { useQuery } from '@tanstack/react-query';
import { Building2, Users, AlertTriangle, DollarSign, Briefcase, TrendingUp, FileSignature, Phone, GraduationCap, FileCheck, UserCircle, Handshake } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function StatCard({
  title,
  description,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  description: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning';
}) {
  const valueColor = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
  }[variant];

  return (
    <Card className="glass hover:glow-sm transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      </CardContent>
    </Card>
  );
}

export function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats-extended'],
    queryFn: async () => {
      const [
        { count: agencyCount },
        { count: sdrCount },
        { count: disputeCount },
        { data: commissions },
        { count: dealCount },
        { count: jobCount },
        { count: applicationCount },
        { count: contractCount },
        { count: trainingCount },
        { count: leadCount },
        { count: callCount },
      ] = await Promise.all([
        supabase.from('workspaces').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'sdr'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('commissions').select('platform_cut_amount, rake_amount').eq('status', 'paid'),
        supabase.from('deals').select('*', { count: 'exact', head: true }).eq('stage', 'closed_won'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('job_applications').select('*', { count: 'exact', head: true }),
        supabase.from('contracts').select('*', { count: 'exact', head: true }),
        supabase.from('training_materials').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }),
      ]);

      // Platform revenue = platform_cut_amount (fallback to 0 for old commissions without it)
      const totalRake = commissions?.reduce((sum, c) => sum + Number(c.platform_cut_amount ?? 0), 0) || 0;
      
      return {
        agencies: agencyCount || 0,
        sdrs: sdrCount || 0,
        pendingDisputes: disputeCount || 0,
        platformRevenue: totalRake,
        closedDeals: dealCount || 0,
        jobs: jobCount || 0,
        applications: applicationCount || 0,
        contracts: contractCount || 0,
        trainings: trainingCount || 0,
        leads: leadCount || 0,
        calls: callCount || 0,
      };
    },
  });

  const { data: pendingPayouts } = useQuery({
    queryKey: ['pending-payouts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('commissions')
        .select('sdr_payout_amount, amount')
        .eq('status', 'pending');
      // Use sdr_payout_amount if set, fallback to amount for older records
      return data?.reduce((sum, c) => sum + Number(c.sdr_payout_amount ?? c.amount ?? 0), 0) || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Core Metrics</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Agencies"
            description="Total registered"
            value={String(stats?.agencies || 0)}
            subtext="Active agencies"
            icon={Building2}
          />
          <StatCard
            title="SDRs"
            description="Total registered"
            value={String(stats?.sdrs || 0)}
            subtext="Active SDRs"
            icon={Users}
          />
          <StatCard
            title="Disputes"
            description="Pending resolution"
            value={String(stats?.pendingDisputes || 0)}
            subtext="Awaiting review"
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Revenue"
            description="Platform rake"
            value={`$${(stats?.platformRevenue || 0).toLocaleString()}`}
            subtext="Total earned"
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Payouts"
            description="Pending SDR payouts"
            value={`$${(pendingPayouts || 0).toLocaleString()}`}
            subtext="Awaiting transfer"
            icon={DollarSign}
            variant="warning"
          />
          <StatCard
            title="Deals Won"
            description="Total closed"
            value={String(stats?.closedDeals || 0)}
            subtext="Closed won deals"
            icon={Handshake}
            variant="success"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Platform Activity</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Jobs"
            description="Total posted"
            value={String(stats?.jobs || 0)}
            subtext="Job listings"
            icon={Briefcase}
          />
          <StatCard
            title="Applications"
            description="Total received"
            value={String(stats?.applications || 0)}
            subtext="Job applications"
            icon={FileCheck}
          />
          <StatCard
            title="Leads"
            description="Total in CRM"
            value={String(stats?.leads || 0)}
            subtext="All leads"
            icon={UserCircle}
          />
          <StatCard
            title="Contracts"
            description="Total created"
            value={String(stats?.contracts || 0)}
            subtext="All contracts"
            icon={FileSignature}
          />
          <StatCard
            title="Trainings"
            description="Materials uploaded"
            value={String(stats?.trainings || 0)}
            subtext="Training files"
            icon={GraduationCap}
          />
          <StatCard
            title="Calls"
            description="Total made"
            value={String(stats?.calls || 0)}
            subtext="Call logs"
            icon={Phone}
          />
        </div>
      </div>
    </div>
  );
}
