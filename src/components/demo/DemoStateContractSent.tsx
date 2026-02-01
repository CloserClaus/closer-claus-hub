import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Send, 
  Clock, 
  Building2, 
  DollarSign,
  Plus,
  Mail
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateContractSent = () => {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="contracts" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Contracts" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Contracts</h1>
                <p className="text-muted-foreground">Manage your contracts and agreements</p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Contract
              </Button>
            </div>

            {/* Success Banner */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
              <Send className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-blue-500">Contract sent!</p>
                <p className="text-sm text-muted-foreground">
                  Service Agreement sent to Michael Torres at CloudScale Inc
                </p>
              </div>
              <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                <Mail className="h-3 w-3 mr-1" />
                Email Sent
              </Badge>
            </div>
            
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All Contracts</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">1</Badge>
                </TabsTrigger>
                <TabsTrigger value="signed">Signed</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {/* Contract Card - Sent status */}
                  <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <FileText className="h-7 w-7 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Service Agreement - CloudScale Inc</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="h-3 w-3" />
                              Michael Torres • CloudScale Inc
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1 text-sm">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                <span className="font-semibold">$12,000</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Send className="h-4 w-4 text-yellow-500" />
                                Sent Feb 6, 2026 at 4:30 PM
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 px-3 py-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Awaiting Signature
                          </Badge>
                          <Button variant="outline" size="sm">
                            View Contract
                          </Button>
                          <Button variant="outline" size="sm">
                            Resend
                          </Button>
                        </div>
                      </div>

                      {/* Tracking */}
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Contract Activity</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Contract sent to m.torres@cloudscale.io</span>
                            <span className="text-muted-foreground ml-auto">Just now</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>Contract created from deal</span>
                            <span className="text-muted-foreground ml-auto">5 min ago</span>
                          </div>
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