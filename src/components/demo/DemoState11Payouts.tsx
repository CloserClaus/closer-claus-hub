import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, TrendingUp, CheckCircle2, Building2, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoState11Payouts = () => {
  const stats = [
    { label: 'Total Commissions', value: '$960', icon: DollarSign },
    { label: 'Paid Out', value: '$960', icon: CheckCircle2 },
    { label: 'Pending', value: '$0', icon: TrendingUp },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="commissions" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Commissions</h1>
              <p className="text-muted-foreground">Track earnings and payouts</p>
            </div>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="history" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payout History</CardTitle>
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
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t bg-green-500/5">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">CloudScale Inc</p>
                              <p className="text-sm text-muted-foreground">Michael Torres</p>
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
                            <span className="font-bold text-green-500">$960</span>
                            <span className="text-xs text-muted-foreground ml-1">(8%)</span>
                          </td>
                          <td className="p-3">
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Commission automatically paid to rep</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Sarah Mitchell</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">Stripe Connect</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
