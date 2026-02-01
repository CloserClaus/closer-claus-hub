import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Phone, DollarSign, Calendar, Target, ArrowUp } from 'lucide-react';

export const DemoState12DashboardAfter = () => {
  const stats = [
    { label: 'Active Deals', value: '11', icon: Target, change: '+1 closed this week', trend: 'down' },
    { label: 'Total Pipeline', value: '$72,500', icon: DollarSign, change: '+$12k closed', trend: 'neutral' },
    { label: 'Calls Today', value: '12', icon: Phone, change: '+12 from yesterday', trend: 'up' },
    { label: 'Meetings Booked', value: '4', icon: Calendar, change: '+1 this week', trend: 'up' },
    { label: 'Team Members', value: '3', icon: Users, change: '+1 new hire', trend: 'up' },
    { label: 'Conversion Rate', value: '21%', icon: TrendingUp, change: '+3% from last month', trend: 'up' },
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
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold">{stat.value}</span>
                      {stat.trend === 'up' && (
                        <ArrowUp className="h-4 w-4 text-green-500 mb-1" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${
                      stat.trend === 'up' ? 'text-green-500' : 'text-muted-foreground'
                    }`}>
                      {stat.change}
                    </p>
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
                  <span>Deal closed: CloudScale Inc - $12,000</span>
                  <span className="text-muted-foreground ml-auto">1h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Commission paid: Sarah Mitchell - $960</span>
                  <span className="text-muted-foreground ml-auto">1h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Meeting booked: Michael Torres</span>
                  <span className="text-muted-foreground ml-auto">3h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>12 calls completed by Sarah M.</span>
                  <span className="text-muted-foreground ml-auto">4h ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>5 leads imported to CRM</span>
                  <span className="text-muted-foreground ml-auto">5h ago</span>
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
                          className={`h-full rounded-full ${
                            stage === 'Closed' ? 'bg-green-500' : 'bg-primary'
                          }`} 
                          style={{ width: `${[25, 15, 15, 5, 15][i]}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">{[2, 1, 2, 0, 1][i]}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">This Week's Revenue</span>
                    <span className="text-lg font-bold text-green-500">$12,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
