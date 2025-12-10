import { useNavigate } from 'react-router-dom';
import { Building2, Headphones, Shield, TrendingUp, Users, DollarSign, Briefcase, CreditCard, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePlatformAdminStats, useAgencyOwnerStats, useSDRStats } from '@/hooks/useDashboardStats';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

export default function Dashboard() {
  const { userRole, profile } = useAuth();
  const { currentWorkspace, hasActiveSubscription } = useWorkspace();
  const navigate = useNavigate();

  const { data: platformStats } = usePlatformAdminStats();
  const { data: agencyStats } = useAgencyOwnerStats();
  const { data: sdrStats } = useSDRStats();

  const renderPlatformAdminDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Agencies"
        description="Total registered"
        value={String(platformStats?.agencies || 0)}
        subtext="Active agencies"
        icon={Building2}
      />
      <StatCard
        title="SDRs"
        description="Total registered"
        value={String(platformStats?.sdrs || 0)}
        subtext="Active SDRs"
        icon={Users}
      />
      <StatCard
        title="Disputes"
        description="Pending resolution"
        value={String(platformStats?.pendingDisputes || 0)}
        subtext="Awaiting review"
        icon={Shield}
        variant="warning"
      />
      <StatCard
        title="Revenue"
        description="Platform rake"
        value={`$${(platformStats?.revenue || 0).toLocaleString()}`}
        subtext="All time"
        icon={TrendingUp}
        variant="success"
      />
      <StatCard
        title="Payouts"
        description="Pending SDR payouts"
        value={`$${(platformStats?.pendingPayouts || 0).toLocaleString()}`}
        subtext="Awaiting transfer"
        icon={DollarSign}
        variant="warning"
      />
      <StatCard
        title="Deals"
        description="Total closed"
        value={String(platformStats?.closedDeals || 0)}
        subtext="Last 30 days"
        icon={Briefcase}
        variant="success"
      />
    </div>
  );

  const renderAgencyOwnerDashboard = () => (
    <div className="space-y-6">
      {/* Subscription Banner */}
      {currentWorkspace && !hasActiveSubscription && (
        <Card className="border-warning/50 bg-gradient-to-r from-warning/10 via-warning/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    Unlock Full Platform Access
                    <Badge variant="secondary" className="bg-warning/20 text-warning">
                      Required for SDRs
                    </Badge>
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Subscribe to post jobs, hire SDRs, and manage your sales team. Plans start at $247/month.
                  </p>
                </div>
              </div>
              <Button 
                className="bg-warning text-warning-foreground hover:bg-warning/90 shrink-0"
                onClick={() => navigate(`/subscription?workspace=${currentWorkspace.id}`)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Team"
          description="Your SDRs"
          value={String(agencyStats?.teamSize || 0)}
          subtext="Active members"
          icon={Users}
        />
        <StatCard
          title="Pipeline"
          description="Total deal value"
          value={`$${(agencyStats?.pipelineValue || 0).toLocaleString()}`}
          subtext="Active deals"
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Commissions"
          description="Owed to SDRs"
          value={`$${(agencyStats?.pendingCommissions || 0).toLocaleString()}`}
          subtext="Pending payment"
          icon={DollarSign}
          variant="warning"
        />
        <StatCard
          title="Calls"
          description="Team activity"
          value={String(agencyStats?.callsLast7Days || 0)}
          subtext="Last 7 days"
          icon={Headphones}
        />
        <StatCard
          title="Meetings"
          description="Scheduled"
          value={String(agencyStats?.meetingsThisWeek || 0)}
          subtext="This week"
          icon={Building2}
        />
        <StatCard
          title="Close Rate"
          description="Win percentage"
          value={`${agencyStats?.closeRate || 0}%`}
          subtext="Last 30 days"
          icon={TrendingUp}
          variant="success"
        />
      </div>
    </div>
  );

  const renderSDRDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Workspaces"
        description="Active agencies"
        value={String(sdrStats?.workspaces || 0)}
        subtext="Companies you work for"
        icon={Building2}
      />
      <StatCard
        title="Earnings"
        description="Total earned"
        value={`$${(sdrStats?.totalEarnings || 0).toLocaleString()}`}
        subtext="All time"
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="Pending"
        description="Awaiting payout"
        value={`$${(sdrStats?.pendingPayouts || 0).toLocaleString()}`}
        subtext="To be paid"
        icon={DollarSign}
        variant="warning"
      />
      <StatCard
        title="Calls"
        description="Your activity"
        value={String(sdrStats?.callsLast7Days || 0)}
        subtext="Last 7 days"
        icon={Headphones}
      />
      <StatCard
        title="Deals"
        description="Closed won"
        value={String(sdrStats?.closedDealsLast30Days || 0)}
        subtext="Last 30 days"
        icon={Briefcase}
        variant="success"
      />
      <StatCard
        title="Jobs"
        description="Open positions"
        value={String(sdrStats?.openJobs || 0)}
        subtext="Available now"
        icon={Briefcase}
      />
    </div>
  );

  return (
    <DashboardLayout>
      <DashboardHeader title="Dashboard" />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'platform_admin' && 'Platform overview and management'}
            {userRole === 'agency_owner' && 'Your agency performance at a glance'}
            {userRole === 'sdr' && 'Your sales performance overview'}
          </p>
        </div>

        {userRole === 'platform_admin' && renderPlatformAdminDashboard()}
        {userRole === 'agency_owner' && renderAgencyOwnerDashboard()}
        {userRole === 'sdr' && renderSDRDashboard()}

        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Real-time data will populate here once the CRM, Dialer, and Jobs systems are built.
            </p>
          </CardContent>
        </Card>
      </main>
    </DashboardLayout>
  );
}
