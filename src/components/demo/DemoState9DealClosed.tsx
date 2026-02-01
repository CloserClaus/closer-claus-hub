import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Trophy, DollarSign, User } from 'lucide-react';

export const DemoState9DealClosed = () => {
  const stages = [
    { 
      name: 'New', 
      color: 'bg-blue-500',
      leads: [
        { name: 'Jennifer Walsh', company: 'DataFlow Systems', value: '$8,500', assignee: 'SM' },
        { name: 'Robert Kim', company: 'TechVenture Labs', value: '$15,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Contacted', 
      color: 'bg-yellow-500',
      leads: [
        { name: 'Amanda Chen', company: 'ScaleUp Software', value: '$10,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Meeting', 
      color: 'bg-purple-500',
      leads: [
        { name: 'David Martinez', company: 'InnovateTech', value: '$18,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Proposal', 
      color: 'bg-orange-500',
      leads: []
    },
    { 
      name: 'Closed Won', 
      color: 'bg-green-500',
      leads: [
        { name: 'Michael Torres', company: 'CloudScale Inc', value: '$12,000', assignee: 'SM', isClosed: true },
      ]
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="crm" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">CRM Pipeline</h1>
              <p className="text-muted-foreground">Track and manage your deals</p>
            </div>
          </div>
          
          <Tabs defaultValue="pipeline">
            <TabsList>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pipeline" className="mt-6">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage, index) => (
                  <div key={index} className="min-w-[280px] flex-shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                      <span className="font-medium">{stage.name}</span>
                      <Badge variant="secondary" className="ml-auto">{stage.leads.length}</Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {stage.leads.map((lead, leadIndex) => (
                        <Card 
                          key={leadIndex} 
                          className={`cursor-pointer hover:shadow-md transition-shadow ${
                            lead.isClosed ? 'ring-2 ring-green-500/50 bg-green-500/5' : ''
                          }`}
                        >
                          <CardContent className="p-4">
                            {lead.isClosed && (
                              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-green-500/20">
                                <Trophy className="h-5 w-5 text-green-500" />
                                <span className="font-medium text-green-500">Deal Closed!</span>
                              </div>
                            )}
                            
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium">{lead.name}</h4>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {lead.company}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold text-green-500">{lead.value}</span>
                                {lead.isClosed && (
                                  <p className="text-xs text-muted-foreground">Deal Value</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">{lead.assignee}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">Sarah M.</span>
                              </div>
                              {lead.isClosed ? (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Won
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">In Progress</Badge>
                              )}
                            </div>
                            
                            {lead.isClosed && (
                              <div className="mt-3 pt-3 border-t border-green-500/20">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Rep Attribution</span>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-xs">SM</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">Sarah Mitchell</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      
                      {stage.leads.length === 0 && (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                          <p className="text-sm">No deals in this stage</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
