import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle2,
  Building2,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateCommissionPaid = () => {
  const stats = [
    { label: 'Total Commissions', value: '$960', icon: DollarSign, color: 'text-primary' },
    { label: 'Paid Out', value: '$960', icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Pending', value: '$0', icon: TrendingUp, color: 'text-muted-foreground' },
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

            {/* Success Banner */}
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-500">Commission Paid! 💰</p>
                <p className="text-sm text-muted-foreground">
                  $960 transferred to Sarah Mitchell via Stripe Connect
                </p>
              </div>
              <Badge variant="outline" className="text-green-500 border-green-500/30">
                <CreditCard className="h-3 w-3 mr-1" />
                Transfer Complete
              </Badge>
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
            
            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="history">
                  History
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">1</Badge>
                </TabsTrigger>
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
                            <th className="text-left p-3 font-medium text-sm">Transaction</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t bg-green-500/5">
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
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-xs text-muted-foreground">
                                tr_1abc...xyz
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-6 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Commission paid automatically via Stripe Connect</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Sarah Mitchell</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="border-green-500/30 text-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Stripe Connect
                          </Badge>
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