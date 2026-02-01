import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Send, CheckCircle2, Clock, Building2, DollarSign, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoState10Contracts = () => {
  const contracts = [
    { 
      title: 'Service Agreement - CloudScale Inc',
      client: 'Michael Torres',
      company: 'CloudScale Inc',
      value: '$12,000',
      status: 'signed',
      signedAt: 'Feb 6, 2026 at 3:45 PM',
    },
    { 
      title: 'Service Agreement - InnovateTech',
      client: 'David Martinez',
      company: 'InnovateTech',
      value: '$18,000',
      status: 'sent',
      sentAt: 'Feb 6, 2026 at 11:20 AM',
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="contracts" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Contracts</h1>
              <p className="text-muted-foreground">Manage your contracts and agreements</p>
            </div>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </div>
          
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Contracts</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="signed">Signed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {contracts.map((contract, index) => (
                  <Card 
                    key={index}
                    className={contract.status === 'signed' ? 'border-green-500/30' : 'border-yellow-500/30'}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            contract.status === 'signed' 
                              ? 'bg-green-500/10' 
                              : 'bg-yellow-500/10'
                          }`}>
                            <FileText className={`h-6 w-6 ${
                              contract.status === 'signed' 
                                ? 'text-green-500' 
                                : 'text-yellow-500'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{contract.title}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="h-3 w-3" />
                              {contract.client} • {contract.company}
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1 text-sm">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                <span className="font-semibold">{contract.value}</span>
                              </div>
                              {contract.status === 'signed' ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  Signed {contract.signedAt}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Send className="h-4 w-4 text-yellow-500" />
                                  Sent {contract.sentAt}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {contract.status === 'signed' ? (
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Signed
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting Signature
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
