import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Headphones, Shield, TrendingUp, Users, DollarSign, Briefcase, CreditCard, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePlatformAdminStats, useAgencyOwnerStats, useSDRStats } from '@/hooks/useDashboardStats';
import { usePlatformAnalytics, useAgencyAnalytics, useSDRAnalytics, useRecentActivity } from '@/hooks/useAnalyticsData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnalyticsChart } from '@/components/analytics/AnalyticsChart';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { toast } from 'sonner';

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
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6 md:pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xs md:text-sm font-medium truncate">{title}</CardTitle>
          <CardDescription className="text-[10px] md:text-xs truncate">{description}</CardDescription>
        </div>
        <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ml-2">
          <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <p className={`text-xl md:text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">{subtext}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { userRole, profile, user } = useAuth();
  const { currentWorkspace, hasActiveSubscription } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: platformStats } = usePlatformAdminStats();
  const { data: agencyStats } = useAgencyOwnerStats();
  const { data: sdrStats } = useSDRStats();

  const { data: platformAnalytics } = usePlatformAnalytics(period);
  const { data: agencyAnalytics } = useAgencyAnalytics(currentWorkspace?.id, period);
  const { data: sdrAnalytics } = useSDRAnalytics(user?.id, currentWorkspace?.id, period);
  const { data: activities } = useRecentActivity(currentWorkspace?.id, user?.id, userRole);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    toast.success('Dashboard refreshed');
  }, [queryClient]);

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  const renderPlatformAdminDashboard = () => (
    <div className="space-y-6">
      <div data-tour="stats-grid" className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard title="Agencies" description="Total registered" value={String(platformStats?.agencies || 0)} subtext="Active agencies" icon={Building2} />
        <StatCard title="SDRs" description="Total registered" value={String(platformStats?.sdrs || 0)} subtext="Active SDRs" icon={Users} />
        <StatCard title="Disputes" description="Pending resolution" value={String(platformStats?.pendingDisputes || 0)} subtext="Awaiting review" icon={Shield} variant="warning" />
        <StatCard title="Revenue" description="Platform rake" value={formatCurrency(platformStats?.revenue || 0)} subtext="All time" icon={TrendingUp} variant="success" />
        <StatCard title="Payouts" description="Pending SDR payouts" value={formatCurrency(platformStats?.pendingPayouts || 0)} subtext="Awaiting transfer" icon={DollarSign} variant="warning" />
        <StatCard title="Deals" description="Total closed" value={String(platformStats?.closedDeals || 0)} subtext="Last 30 days" icon={Briefcase} variant="success" />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <AnalyticsChart title="User Growth" description="Agencies vs SDRs" data={platformAnalytics?.userGrowth || []} showSecondary primaryLabel="Agencies" secondaryLabel="SDRs" />
        <AnalyticsChart title="Platform Revenue" description="Rake earnings" data={platformAnalytics?.revenue || []} color="hsl(var(--success))" valueFormatter={formatCurrency} />
        <AnalyticsChart title="Deal Funnel" data={platformAnalytics?.dealFunnel || []} type="bar" />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2"><ActivityFeed activities={activities || []} /></div>
      </div>
    </div>
  );

  const renderAgencyOwnerDashboard = () => (
    <div className="space-y-4 md:space-y-6">
      {currentWorkspace && !hasActiveSubscription && (
        <Card className="border-warning/50 bg-gradient-to-r from-warning/10 via-warning/5 to-transparent">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 md:gap-4">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 md:h-6 md:w-6 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base md:text-lg flex flex-wrap items-center gap-2">
                    Unlock Full Access
                    <Badge variant="secondary" className="bg-warning/20 text-warning text-[10px] md:text-xs">Required</Badge>
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">Subscribe to post jobs and hire SDRs. Plans start at $247/month.</p>
                </div>
              </div>
              <Button className="bg-warning text-warning-foreground hover:bg-warning/90 w-full md:w-auto md:self-end" onClick={() => navigate(`/subscription?workspace=${currentWorkspace.id}`)}>
                <CreditCard className="h-4 w-4 mr-2" />View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div data-tour="stats-grid" className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard title="Team" description="Your SDRs" value={String(agencyStats?.teamSize || 0)} subtext="Active members" icon={Users} />
        <StatCard title="Pipeline" description="Total deal value" value={formatCurrency(agencyStats?.pipelineValue || 0)} subtext="Active deals" icon={TrendingUp} variant="success" />
        <StatCard title="Commissions" description="Owed to SDRs" value={formatCurrency(agencyStats?.pendingCommissions || 0)} subtext="Pending payment" icon={DollarSign} variant="warning" />
        <StatCard title="Calls" description="Team activity" value={String(agencyStats?.callsLast7Days || 0)} subtext="Last 7 days" icon={Headphones} />
        <StatCard title="Meetings" description="Scheduled" value={String(agencyStats?.meetingsThisWeek || 0)} subtext="This week" icon={Building2} />
        <StatCard title="Close Rate" description="Win percentage" value={`${agencyStats?.closeRate || 0}%`} subtext="Last 30 days" icon={TrendingUp} variant="success" />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
        <AnalyticsChart title="Pipeline Value" description="Over time" data={agencyAnalytics?.pipelineValue || []} color="hsl(var(--success))" valueFormatter={formatCurrency} />
        <AnalyticsChart title="Deals by Stage" data={agencyAnalytics?.dealsByStage || []} type="bar" />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        <AnalyticsChart title="SDR Performance" description="Deals closed" data={agencyAnalytics?.sdrPerformance || []} type="bar" />
        <div className="lg:col-span-2"><ActivityFeed activities={activities || []} /></div>
      </div>
    </div>
  );

  const renderSDRDashboard = () => (
    <div className="space-y-4 md:space-y-6">
      <div data-tour="stats-grid" className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard title="Workspaces" description="Active agencies" value={String(sdrStats?.workspaces || 0)} subtext="Companies you work for" icon={Building2} />
        <StatCard title="Earnings" description="Total earned" value={formatCurrency(sdrStats?.totalEarnings || 0)} subtext="All time" icon={DollarSign} variant="success" />
        <StatCard title="Pending" description="Awaiting payout" value={formatCurrency(sdrStats?.pendingPayouts || 0)} subtext="To be paid" icon={DollarSign} variant="warning" />
        <StatCard title="Calls" description="Your activity" value={String(sdrStats?.callsLast7Days || 0)} subtext="Last 7 days" icon={Headphones} />
        <StatCard title="Deals" description="Closed won" value={String(sdrStats?.closedDealsLast30Days || 0)} subtext="Last 30 days" icon={Briefcase} variant="success" />
        <StatCard title="Jobs" description="Open positions" value={String(sdrStats?.openJobs || 0)} subtext="Available now" icon={Briefcase} />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
        <AnalyticsChart title="Your Earnings" description="Commission payouts" data={sdrAnalytics?.earnings || []} color="hsl(var(--success))" valueFormatter={formatCurrency} />
        <AnalyticsChart title="Deals Closed" description="Over time" data={sdrAnalytics?.dealsClosed || []} type="bar" color="hsl(var(--primary))" />
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        <AnalyticsChart title="Commission Status" data={sdrAnalytics?.commissionStatus || []} type="bar" />
        <div className="lg:col-span-2"><ActivityFeed activities={activities || []} /></div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <DashboardHeader title="Dashboard" />
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-auto">
        <main className="p-4 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">
          {profile && !profile.email_verified && user && (
            <EmailVerificationBanner email={profile.email} userId={user.id} fullName={profile.full_name || undefined} />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {userRole === 'platform_admin' && 'Platform overview and management'}
                {userRole === 'agency_owner' && 'Your agency performance at a glance'}
                {userRole === 'sdr' && 'Your sales performance overview'}
              </p>
            </div>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>

          {userRole === 'platform_admin' && renderPlatformAdminDashboard()}
          {userRole === 'agency_owner' && renderAgencyOwnerDashboard()}
          {userRole === 'sdr' && renderSDRDashboard()}
        </main>
      </PullToRefresh>
    </DashboardLayout>
  );
}
