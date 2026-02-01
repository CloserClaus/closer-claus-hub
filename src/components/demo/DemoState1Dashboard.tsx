import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Phone, DollarSign, Calendar, Target } from 'lucide-react';

export const DemoState1Dashboard = () => {
  const stats = [
    { label: 'Active Deals', value: '12', icon: Target, change: '+2 this week' },
    { label: 'Total Pipeline', value: '$84,500', icon: DollarSign, change: '+$12k this month' },
    { label: 'Calls Today', value: '0', icon: Phone, change: 'No calls yet' },
    { label: 'Meetings Booked', value: '3', icon: Calendar, change: 'This week' },
    { label: 'Team Members', value: '2', icon: Users, change: '1 pending hire' },
    { label: 'Conversion Rate', value: '18%', icon: TrendingUp, change: 'Last 30 days' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dashboard" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, here's your overview</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>New lead added: Tech Solutions Inc</span>
                  <span className="text-muted-foreground ml-auto">2h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Deal moved to Proposal stage</span>
                  <span className="text-muted-foreground ml-auto">5h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>Job posting received 3 applications</span>
                  <span className="text-muted-foreground ml-auto">1d ago</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['New', 'Contacted', 'Meeting', 'Proposal', 'Closed'].map((stage, i) => (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="text-sm w-20">{stage}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${[40, 30, 20, 15, 10][i]}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">{[5, 4, 2, 1, 0][i]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
