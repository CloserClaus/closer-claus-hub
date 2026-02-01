import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Phone, 
  DollarSign, 
  Briefcase, 
  CheckCircle,
  Clock,
  Timer,
  Headphones,
  PhoneCall,
  ArrowUp
} from 'lucide-react';

function StatCard({
  title,
  description,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  trend,
}: {
  title: string;
  description: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning';
  trend?: string;
}) {
  const valueColor = {
    default: 'text-primary',
    success: 'text-green-500',
    warning: 'text-yellow-500',
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
        <div className="flex items-end gap-2">
          <p className={`text-xl md:text-3xl font-bold ${valueColor}`}>{value}</p>
          {trend && (
            <span className="flex items-center text-xs text-green-500 mb-1">
              <ArrowUp className="h-3 w-3" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">{subtext}</p>
      </CardContent>
    </Card>
  );
}

export const DemoStateDashboardScaled = () => {
  const mainStats = [
    { title: 'Team', description: 'Your SDRs', value: '3', subtext: 'Active members', icon: Users, variant: 'default' as const, trend: '+2' },
    { title: 'Pipeline', description: 'Total deal value', value: '$187,500', subtext: 'Active deals', icon: TrendingUp, variant: 'success' as const, trend: '+263%' },
    { title: 'Commissions', description: 'Paid this month', value: '$14,400', subtext: '15 deals closed', icon: DollarSign, variant: 'success' as const, trend: '+1400%' },
    { title: 'Close Rate', description: 'Win percentage', value: '28%', subtext: 'Last 30 days', icon: TrendingUp, variant: 'success' as const, trend: '+8%' },
    { title: 'Active Deals', description: 'In pipeline', value: '23', subtext: 'Not closed', icon: Briefcase, variant: 'default' as const, trend: '+475%' },
    { title: 'Calls Today', description: 'Team activity', value: '47', subtext: 'Made today', icon: Phone, variant: 'default' as const, trend: '+840%' },
  ];

  const callStats = [
    { title: 'Calls Made', description: 'This month', value: '412', subtext: 'Total calls', icon: Headphones, variant: 'default' as const },
    { title: 'Connect Rate', description: 'Pickup rate', value: '42%', subtext: '173 connected', icon: CheckCircle, variant: 'success' as const },
    { title: '2+ Min Calls', description: 'Quality conversations', value: '89', subtext: 'Over 2 minutes', icon: Clock, variant: 'default' as const },
    { title: '6+ Min Calls', description: 'Deep conversations', value: '34', subtext: 'Over 6 minutes', icon: Timer, variant: 'success' as const },
  ];

  const chartBars = [65, 78, 82, 95, 88, 102, 97];

  const activities = [
    { color: 'bg-green-500', text: 'Deal closed: TechVenture Labs - $15,000', time: '15m ago' },
    { color: 'bg-green-500', text: 'Commission paid: Marcus Johnson - $1,200', time: '30m ago' },
    { color: 'bg-purple-500', text: '3 meetings booked by Sarah Mitchell', time: '1h ago' },
    { color: 'bg-blue-500', text: 'New SDR hired: Emily Chen', time: '2h ago' },
    { color: 'bg-green-500', text: 'Deal closed: DataFlow Systems - $8,500', time: '3h ago' },
    { color: 'bg-yellow-500', text: '25 leads imported to CRM', time: '4h ago' },
  ];

  const sdrPerformance = [
    { name: 'Sarah Mitchell', deals: 8, calls: 156, revenue: '$64,000' },
    { name: 'Marcus Johnson', deals: 5, calls: 142, revenue: '$42,500' },
    { name: 'Emily Chen', deals: 2, calls: 114, revenue: '$18,000' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dashboard" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Dashboard" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
              {mainStats.map((stat, index) => (
                <StatCard key={index} {...stat} />
              ))}
            </div>

            {/* Call Analytics Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-primary" />
                  Call Analytics
                </h2>
                <Badge variant="outline">Last 30 days</Badge>
              </div>
              <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
                {callStats.map((stat, index) => (
                  <StatCard key={index} {...stat} />
                ))}
              </div>
            </div>

            {/* Charts and Activity */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Call Volume Chart */}
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Weekly Call Volume</CardTitle>
                  <CardDescription>Calls per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-between gap-2 pt-4">
                    {chartBars.map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-1">
                          <div 
                            className="flex-1 bg-primary/30 rounded-t"
                            style={{ height: `${height * 1.5}px` }}
                          />
                          <div 
                            className="flex-1 bg-primary rounded-t"
                            style={{ height: `${height * 0.6}px` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-primary/30" />
                      <span className="text-muted-foreground">Total Calls</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-primary" />
                      <span className="text-muted-foreground">Connected</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SDR Performance */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base">SDR Performance</CardTitle>
                  <CardDescription>Deals & Revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sdrPerformance.map((sdr, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                            {sdr.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium">{sdr.name}</span>
                        </div>
                        <div className="flex gap-3 text-sm">
                          <Badge variant="outline">{sdr.deals} deals</Badge>
                          <Badge variant="secondary">{sdr.calls} calls</Badge>
                          <span className="font-bold text-green-500">{sdr.revenue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Feed */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${activity.color}`} />
                    <span className="flex-1">{activity.text}</span>
                    <span className="text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};