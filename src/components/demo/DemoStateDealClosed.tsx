import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Plus, 
  Filter,
  Building2,
  DollarSign,
  Trophy,
  CheckCircle2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateDealClosed = () => {
  const stages = [
    { 
      name: 'New', 
      color: 'bg-blue-500',
      deals: [
        { name: 'Jennifer Walsh', company: 'DataFlow Systems', value: '$8,500', assignee: 'SM' },
        { name: 'Robert Kim', company: 'TechVenture Labs', value: '$15,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Contacted', 
      color: 'bg-yellow-500',
      deals: [
        { name: 'Amanda Chen', company: 'ScaleUp Software', value: '$10,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Meeting', 
      color: 'bg-purple-500',
      deals: [
        { name: 'David Martinez', company: 'InnovateTech', value: '$18,000', assignee: 'SM' },
      ]
    },
    { 
      name: 'Proposal', 
      color: 'bg-orange-500',
      deals: []
    },
    { 
      name: 'Closed Won', 
      color: 'bg-green-500',
      deals: [
        { name: 'Michael Torres', company: 'CloudScale Inc', value: '$12,000', assignee: 'SM', isWon: true },
      ]
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="crm" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="CRM" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <Trophy className="h-6 w-6 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-500">Deal Closed Won! 🎉</p>
                <p className="text-sm text-muted-foreground">CloudScale Inc - $12,000 closed by Sarah Mitchell</p>
              </div>
              <Badge className="bg-green-500 text-white">+$12,000</Badge>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">CRM Pipeline</h1>
                <p className="text-muted-foreground">Deal moved to Closed Won</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Deal
                </Button>
              </div>
            </div>
            
            <Tabs defaultValue="pipeline">
              <TabsList>
                <TabsTrigger value="leads">Leads</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pipeline" className="mt-6">
                {/* Pipeline Value Summary */}
                <Card className="mb-6 p-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                      <p className="text-2xl font-bold">$51,500</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-sm text-muted-foreground">Active Deals</p>
                      <p className="text-2xl font-bold">4</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-sm text-muted-foreground">Won This Month</p>
                      <p className="text-2xl font-bold text-green-500">$12,000</p>
                    </div>
                  </div>
                </Card>

                {/* Pipeline Stages */}
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {stages.map((stage, index) => (
                    <div key={index} className="min-w-[280px] flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <span className="font-medium">{stage.name}</span>
                        <Badge variant="secondary" className="ml-auto">{stage.deals.length}</Badge>
                      </div>
                      
                      <div className="space-y-3">
                        {stage.deals.map((deal, dealIndex) => (
                          <Card 
                            key={dealIndex} 
                            className={`cursor-pointer hover:shadow-md transition-shadow ${
                              deal.isWon ? 'ring-2 ring-green-500/50 bg-green-500/5' : ''
                            }`}
                          >
                            <CardContent className="p-4">
                              {deal.isWon && (
                                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-green-500/20">
                                  <Trophy className="h-5 w-5 text-green-500" />
                                  <span className="font-medium text-green-500">Deal Closed!</span>
                                </div>
                              )}
                              
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-medium">{deal.name}</h4>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {deal.company}
                                  </p>
                                </div>
                                <span className="text-lg font-bold text-green-500 flex items-center">
                                  <DollarSign className="h-4 w-4" />
                                  {deal.value.replace('$', '')}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">{deal.assignee}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">Sarah M.</span>
                                </div>
                                {deal.isWon ? (
                                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Won
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Active</Badge>
                                )}
                              </div>

                              {deal.isWon && (
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
                        
                        {stage.deals.length === 0 && (
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
        </main>
      </div>
    </div>
  );
};