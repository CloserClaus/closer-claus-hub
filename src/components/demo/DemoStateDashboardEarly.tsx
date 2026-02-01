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
  PhoneCall
} from 'lucide-react';

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
        <p className={`text-xl md:text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">{subtext}</p>
      </CardContent>
    </Card>
  );
}

export const DemoStateDashboardEarly = () => {
  const mainStats = [
    { title: 'Team', description: 'Your SDRs', value: '1', subtext: 'Active members', icon: Users, variant: 'default' as const },
    { title: 'Pipeline', description: 'Total deal value', value: '$51,500', subtext: 'Active deals', icon: TrendingUp, variant: 'success' as const },
    { title: 'Commissions', description: 'Paid this month', value: '$960', subtext: '1 deal closed', icon: DollarSign, variant: 'success' as const },
    { title: 'Close Rate', description: 'Win percentage', value: '20%', subtext: 'Last 30 days', icon: TrendingUp, variant: 'success' as const },
    { title: 'Active Deals', description: 'In pipeline', value: '4', subtext: 'Not closed', icon: Briefcase, variant: 'default' as const },
    { title: 'Calls Today', description: 'Team activity', value: '5', subtext: 'Made today', icon: Phone, variant: 'default' as const },
  ];

  const callStats = [
    { title: 'Calls Made', description: 'Total calls', value: '5', subtext: 'In selected period', icon: Headphones, variant: 'default' as const },
    { title: 'Connect Rate', description: 'Pickup rate', value: '40%', subtext: '2 connected', icon: CheckCircle, variant: 'success' as const },
    { title: '2+ Min Calls', description: 'Quality conversations', value: '2', subtext: 'Over 2 minutes', icon: Clock, variant: 'default' as const },
    { title: '6+ Min Calls', description: 'Deep conversations', value: '1', subtext: 'Over 6 minutes', icon: Timer, variant: 'success' as const },
  ];

  const activities = [
    { color: 'bg-green-500', text: 'Commission paid: Sarah Mitchell - $960', time: '1h ago' },
    { color: 'bg-green-500', text: 'Deal closed: CloudScale Inc - $12,000', time: '2h ago' },
    { color: 'bg-blue-500', text: 'Contract signed by Michael Torres', time: '3h ago' },
    { color: 'bg-purple-500', text: 'Meeting booked: Michael Torres', time: '4h ago' },
    { color: 'bg-blue-500', text: 'Call completed: 4:12 duration', time: '5h ago' },
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
                <Badge variant="outline">Today</Badge>
              </div>
              <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
                {callStats.map((stat, index) => (
                  <StatCard key={index} {...stat} />
                ))}
              </div>
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