import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  Building2,
  AlertCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateCommissionCalculated = () => {
  const stats = [
    { label: 'Total Commissions', value: '$960', icon: DollarSign, color: 'text-primary' },
    { label: 'Pending Payment', value: '$960', icon: Clock, color: 'text-yellow-500' },
    { label: 'Paid Out', value: '$0', icon: TrendingUp, color: 'text-muted-foreground' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="commissions" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Commissions" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Commissions</h1>
                <p className="text-muted-foreground">Track earnings and payouts</p>
              </div>
            </div>

            {/* Pending Payment Alert */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <p className="font-medium text-yellow-500">Commission Pending</p>
                <p className="text-sm text-muted-foreground">
                  $960 commission calculated for CloudScale Inc deal. Payment due within 7 days.
                </p>
              </div>
              <Button size="sm">
                Pay Now
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="glass">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </CardTitle>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-yellow-500/20 text-yellow-500">1</Badge>
                </TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pending" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pending Commissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium text-sm">Deal</th>
                            <th className="text-left p-3 font-medium text-sm">Rep</th>
                            <th className="text-left p-3 font-medium text-sm">Deal Value</th>
                            <th className="text-left p-3 font-medium text-sm">Commission</th>
                            <th className="text-left p-3 font-medium text-sm">Status</th>
                            <th className="text-left p-3 font-medium text-sm"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t bg-yellow-500/5">
                            <td className="p-3">
                              <div>
                                <p className="font-medium">CloudScale Inc</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  Michael Torres
                                </p>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>SM</AvatarFallback>
                                </Avatar>
                                <span>Sarah Mitchell</span>
                              </div>
                            </td>
                            <td className="p-3 font-medium">$12,000</td>
                            <td className="p-3">
                              <div>
                                <span className="font-bold text-green-500">$960</span>
                                <span className="text-xs text-muted-foreground ml-1">(8%)</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button size="sm">Pay Commission</Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Commission Breakdown</span>
                        <div className="text-right">
                          <p>8% of $12,000 = <span className="font-bold">$960</span></p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};