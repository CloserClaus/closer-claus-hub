import { Building2, Headphones, Shield, TrendingUp, Users, DollarSign, Briefcase } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { SubscriptionGuard } from '@/components/layout/SubscriptionGuard';
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

export default function Dashboard() {
  const { userRole, profile } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const renderPlatformAdminDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Agencies"
        description="Total registered"
        value="0"
        subtext="Active agencies"
        icon={Building2}
      />
      <StatCard
        title="SDRs"
        description="Total registered"
        value="0"
        subtext="Active SDRs"
        icon={Users}
      />
      <StatCard
        title="Disputes"
        description="Pending resolution"
        value="0"
        subtext="Awaiting review"
        icon={Shield}
        variant="warning"
      />
      <StatCard
        title="Revenue"
        description="Platform rake"
        value="$0"
        subtext="Last 30 days"
        icon={TrendingUp}
        variant="success"
      />
      <StatCard
        title="Payouts"
        description="Pending SDR payouts"
        value="$0"
        subtext="Awaiting transfer"
        icon={DollarSign}
        variant="warning"
      />
      <StatCard
        title="Deals"
        description="Total closed"
        value="0"
        subtext="Last 30 days"
        icon={Briefcase}
        variant="success"
      />
    </div>
  );

  const renderAgencyOwnerDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Team"
        description="Your SDRs"
        value="0"
        subtext="Active members"
        icon={Users}
      />
      <StatCard
        title="Pipeline"
        description="Total deal value"
        value="$0"
        subtext="Active deals"
        icon={TrendingUp}
        variant="success"
      />
      <StatCard
        title="Commissions"
        description="Owed to SDRs"
        value="$0"
        subtext="Pending payment"
        icon={DollarSign}
        variant="warning"
      />
      <StatCard
        title="Calls"
        description="Team activity"
        value="0"
        subtext="Last 7 days"
        icon={Headphones}
      />
      <StatCard
        title="Meetings"
        description="Scheduled"
        value="0"
        subtext="This week"
        icon={Building2}
      />
      <StatCard
        title="Close Rate"
        description="Win percentage"
        value="0%"
        subtext="Last 30 days"
        icon={TrendingUp}
        variant="success"
      />
    </div>
  );

  const renderSDRDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Workspaces"
        description="Active agencies"
        value="0"
        subtext="Companies you work for"
        icon={Building2}
      />
      <StatCard
        title="Earnings"
        description="Total earned"
        value="$0"
        subtext="All time"
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="Pending"
        description="Awaiting payout"
        value="$0"
        subtext="To be paid"
        icon={DollarSign}
        variant="warning"
      />
      <StatCard
        title="Calls"
        description="Your activity"
        value="0"
        subtext="Last 7 days"
        icon={Headphones}
      />
      <StatCard
        title="Deals"
        description="Closed won"
        value="0"
        subtext="Last 30 days"
        icon={Briefcase}
        variant="success"
      />
      <StatCard
        title="Jobs"
        description="Open positions"
        value="0"
        subtext="Available now"
        icon={Briefcase}
      />
    </div>
  );

  return (
    <DashboardLayout>
      <DashboardHeader title="Dashboard" />
      <SubscriptionGuard>
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
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
