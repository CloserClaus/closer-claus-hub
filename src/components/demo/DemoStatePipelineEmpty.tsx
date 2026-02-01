import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Filter,
  ArrowRight
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStatePipelineEmpty = () => {
  const stages = [
    { name: 'New', color: 'bg-blue-500', count: 0 },
    { name: 'Contacted', color: 'bg-yellow-500', count: 0 },
    { name: 'Meeting', color: 'bg-purple-500', count: 0 },
    { name: 'Proposal', color: 'bg-orange-500', count: 0 },
    { name: 'Closed Won', color: 'bg-green-500', count: 0 },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="crm" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="CRM" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">CRM Pipeline</h1>
                <p className="text-muted-foreground">Track deals through your sales funnel</p>
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
                <TabsTrigger value="leads">
                  Leads
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">5</Badge>
                </TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pipeline" className="mt-6">
                {/* Pipeline Value Summary */}
                <Card className="mb-6 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                        <p className="text-2xl font-bold">$0</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-sm text-muted-foreground">Active Deals</p>
                        <p className="text-2xl font-bold">0</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-sm text-muted-foreground">Won This Month</p>
                        <p className="text-2xl font-bold text-green-500">$0</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Convert Leads
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </Card>

                {/* Pipeline Stages - Empty */}
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {stages.map((stage, index) => (
                    <div key={index} className="min-w-[280px] flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <span className="font-medium">{stage.name}</span>
                        <Badge variant="secondary" className="ml-auto">{stage.count}</Badge>
                      </div>
                      
                      <div className="space-y-3 min-h-[400px]">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                          <div className={`w-10 h-10 rounded-full ${stage.color}/20 flex items-center justify-center mb-3`}>
                            <Plus className={`h-5 w-5 ${stage.color.replace('bg-', 'text-')}`} />
                          </div>
                          <p className="text-sm font-medium">No deals yet</p>
                          <p className="text-xs mt-1">Convert leads or add deals manually</p>
                        </div>
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