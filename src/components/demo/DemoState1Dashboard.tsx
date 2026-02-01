import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  Phone, 
  DollarSign, 
  Briefcase, 
  PhoneCall, 
  CheckCircle, 
  Clock, 
  Timer,
  Headphones
} from 'lucide-react';

interface DemoState1DashboardProps {
  subState?: string;
}

// Stat card matching actual Dashboard.tsx StatCard component
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

export const DemoState1Dashboard = ({ subState = 'full' }: DemoState1DashboardProps) => {
  const isActivity = subState === 'activity';

  // Baseline metrics (calm, believable)
  const mainStats = [
    { title: 'Team', description: 'Your SDRs', value: isActivity ? '2' : '1', subtext: 'Active members', icon: Users, variant: 'default' as const },
    { title: 'Pipeline', description: 'Total deal value', value: isActivity ? '$127,500' : '$84,500', subtext: 'Active deals', icon: TrendingUp, variant: 'success' as const },
    { title: 'Commissions', description: 'Owed to SDRs', value: isActivity ? '$4,200' : '$2,400', subtext: 'Pending payment', icon: DollarSign, variant: 'warning' as const },
    { title: 'Close Rate', description: 'Win percentage', value: isActivity ? '22%' : '18%', subtext: 'Last 30 days', icon: TrendingUp, variant: 'success' as const },
    { title: 'Active Deals', description: 'In pipeline', value: isActivity ? '14' : '12', subtext: 'Not closed', icon: Briefcase, variant: 'default' as const },
    { title: 'Calls Today', description: 'Team activity', value: isActivity ? '8' : '0', subtext: 'Made today', icon: Phone, variant: 'default' as const },
  ];

  const callStats = [
    { title: 'Calls Made', description: 'Total calls', value: isActivity ? '47' : '32', subtext: 'In selected period', icon: Headphones, variant: 'default' as const },
    { title: 'Connect Rate', description: 'Pickup rate', value: isActivity ? '38%' : '34%', subtext: isActivity ? '18 connected' : '11 connected', icon: CheckCircle, variant: 'success' as const },
    { title: '2+ Min Calls', description: 'Quality conversations', value: isActivity ? '12' : '8', subtext: 'Over 2 minutes', icon: Clock, variant: 'default' as const },
    { title: '6+ Min Calls', description: 'Deep conversations', value: isActivity ? '5' : '3', subtext: 'Over 6 minutes', icon: Timer, variant: 'success' as const },
  ];

  const activities = isActivity ? [
    { color: 'bg-green-500', text: 'Sarah Chen completed 8 calls', time: '10m ago' },
    { color: 'bg-blue-500', text: 'Deal moved to Proposal: Acme Corp', time: '25m ago' },
    { color: 'bg-green-500', text: 'New lead added: TechFlow Solutions', time: '1h ago' },
    { color: 'bg-yellow-500', text: 'Marcus hired and added to team', time: '2h ago' },
    { color: 'bg-blue-500', text: 'Meeting scheduled with DataSync Inc', time: '3h ago' },
  ] : [
    { color: 'bg-green-500', text: 'New lead added: Tech Solutions Inc', time: '2h ago' },
    { color: 'bg-blue-500', text: 'Deal moved to Proposal stage', time: '5h ago' },
    { color: 'bg-yellow-500', text: 'Job posting received 3 applications', time: '1d ago' },
  ];

  // Chart data simulation
  const chartBars = isActivity 
    ? [40, 55, 35, 60, 45, 70, 50]
    : [25, 30, 20, 35, 28, 40, 32];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dashboard" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Dashboard" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Main Stats Grid - matches actual Dashboard */}
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Performance Analytics</h2>
                <Badge variant="outline">30 days</Badge>
              </div>
              
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {/* Call Volume Chart */}
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Call Volume</CardTitle>
                    <CardDescription>Total vs Connected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end justify-between gap-2 pt-4">
                      {chartBars.map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex gap-1">
                            <div 
                              className="flex-1 bg-primary/30 rounded-t"
                              style={{ height: `${height}px` }}
                            />
                            <div 
                              className="flex-1 bg-primary rounded-t"
                              style={{ height: `${height * 0.4}px` }}
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

                {/* Pipeline Value Chart */}
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pipeline Value</CardTitle>
                    <CardDescription>Over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end pt-4">
                      <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d={isActivity 
                            ? "M0,100 L50,85 L100,75 L150,60 L200,45 L250,35 L300,20 L300,120 L0,120 Z"
                            : "M0,100 L50,95 L100,90 L150,85 L200,80 L250,75 L300,70 L300,120 L0,120 Z"
                          }
                          fill="url(#gradient)"
                        />
                        <path
                          d={isActivity 
                            ? "M0,100 L50,85 L100,75 L150,60 L200,45 L250,35 L300,20"
                            : "M0,100 L50,95 L100,90 L150,85 L200,80 L250,75 L300,70"
                          }
                          fill="none"
                          stroke="hsl(var(--success))"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
              <Card className="glass lg:col-span-2">
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

              {/* SDR Performance */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base">SDR Performance</CardTitle>
                  <CardDescription>Deals & Calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isActivity ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Sarah Chen</span>
                          <div className="flex gap-2 text-xs">
                            <Badge variant="outline">3 deals</Badge>
                            <Badge variant="secondary">24 calls</Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Marcus Johnson</span>
                          <div className="flex gap-2 text-xs">
                            <Badge variant="outline">1 deal</Badge>
                            <Badge variant="secondary">8 calls</Badge>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Sarah Chen</span>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">2 deals</Badge>
                          <Badge variant="secondary">18 calls</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
