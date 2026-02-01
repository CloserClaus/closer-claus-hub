import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Clock, 
  User, 
  Building2,
  Play,
  Zap
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateDialerIdle = () => {
  const queue = [
    { name: 'Michael Torres', company: 'CloudScale Inc', title: 'VP of Sales', phone: '+1 (555) 123-4567' },
    { name: 'Jennifer Walsh', company: 'DataFlow Systems', title: 'Head of Growth', phone: '+1 (555) 234-5678' },
    { name: 'Robert Kim', company: 'TechVenture Labs', title: 'Director of BD', phone: '+1 (555) 345-6789' },
    { name: 'Amanda Chen', company: 'ScaleUp Software', title: 'Sales Director', phone: '+1 (555) 456-7890' },
    { name: 'David Martinez', company: 'InnovateTech', title: 'VP Sales', phone: '+1 (555) 567-8901' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dialer" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Dialer" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Power Dialer</h1>
                <p className="text-muted-foreground">Make calls efficiently through your queue</p>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                142 minutes remaining
              </Badge>
            </div>
            
            <Tabs defaultValue="dialer">
              <TabsList>
                <TabsTrigger value="dialer">Power Dialer</TabsTrigger>
                <TabsTrigger value="manual">Manual Dial</TabsTrigger>
                <TabsTrigger value="recordings">Recordings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dialer" className="mt-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Call Queue */}
                  <Card className="col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">Call Queue</CardTitle>
                      <Badge variant="outline">{queue.length} leads</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {queue.map((lead, index) => (
                          <div 
                            key={index}
                            className={`flex items-center justify-between p-4 rounded-lg border ${
                              index === 0 ? 'bg-primary/5 border-primary/30' : 'bg-card'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-primary/20' : 'bg-muted'
                              }`}>
                                <User className={`h-5 w-5 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{lead.name}</p>
                                  {index === 0 && (
                                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                                      Next Up
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {lead.company} • {lead.title}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-sm">{lead.phone}</p>
                              <p className="text-xs text-muted-foreground">#{index + 1} in queue</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dialer Controls */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Dialer Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="text-center py-8">
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                          <Phone className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium">Ready to dial</p>
                        <p className="text-sm text-muted-foreground">5 leads in queue</p>
                      </div>

                      <Button size="lg" className="w-full gap-2">
                        <Play className="h-5 w-5" />
                        Start Dialing
                      </Button>

                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Session Calls</span>
                          <span className="font-medium">0</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Connected</span>
                          <span className="font-medium">0</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avg Duration</span>
                          <span className="font-medium">--:--</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};