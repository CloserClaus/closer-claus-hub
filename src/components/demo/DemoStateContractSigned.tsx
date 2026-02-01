import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle2, 
  Building2, 
  DollarSign,
  Plus,
  Download,
  Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateContractSigned = () => {
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
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-500">Contract Signed! ✅</p>
                <p className="text-sm text-muted-foreground">
                  Michael Torres signed the Service Agreement at 5:15 PM
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
            
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All Contracts</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="signed">
                  Signed
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">1</Badge>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {/* Contract Card - Signed status */}
                  <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <FileText className="h-7 w-7 text-green-500" />
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
                              <div className="flex items-center gap-1 text-sm text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                                Signed Feb 6, 2026 at 5:15 PM
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 px-3 py-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Signed
                          </Badge>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>

                      {/* Signature Details */}
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Signature Details</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Signed By</p>
                            <p className="font-medium">Michael Torres</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="font-medium">m.torres@cloudscale.io</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Timestamp</p>
                            <p className="font-medium">Feb 6, 2026 5:15:32 PM EST</p>
                          </div>
                        </div>
                      </div>

                      {/* Activity */}
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Contract Activity</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-green-500 font-medium">Contract signed by Michael Torres</span>
                            <span className="text-muted-foreground ml-auto">Just now</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Contract viewed by recipient</span>
                            <span className="text-muted-foreground ml-auto">45 min ago</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Contract sent to m.torres@cloudscale.io</span>
                            <span className="text-muted-foreground ml-auto">1 hour ago</span>
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