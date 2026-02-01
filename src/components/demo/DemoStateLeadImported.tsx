import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Plus, 
  CheckCircle2, 
  Mail,
  Phone,
  Linkedin,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateLeadImported = () => {
  const leads = [
    { name: 'Michael Torres', company: 'CloudScale Inc', title: 'VP of Sales', email: 'm.torres@cloudscale.io', status: 'new', hasPhone: true, assignee: 'SM' },
    { name: 'Jennifer Walsh', company: 'DataFlow Systems', title: 'Head of Growth', email: 'j.walsh@dataflow.com', status: 'new', hasPhone: true, assignee: 'SM' },
    { name: 'Robert Kim', company: 'TechVenture Labs', title: 'Director of BD', email: 'r.kim@techventure.io', status: 'new', hasPhone: false, assignee: 'SM' },
    { name: 'Amanda Chen', company: 'ScaleUp Software', title: 'Sales Director', email: 'a.chen@scaleup.com', status: 'new', hasPhone: true, assignee: 'SM' },
    { name: 'David Martinez', company: 'InnovateTech', title: 'VP Sales', email: 'd.martinez@innovatetech.co', status: 'new', hasPhone: true, assignee: 'SM' },
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
                <h1 className="text-2xl font-bold">CRM</h1>
                <p className="text-muted-foreground">Manage leads and deals</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Lead
                </Button>
              </div>
            </div>

            {/* Success Banner */}
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-500">5 leads imported successfully!</p>
                <p className="text-sm text-muted-foreground">Leads have been added to your CRM and assigned to Sarah Mitchell.</p>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                842 credits remaining
              </Badge>
            </div>
            
            <Tabs defaultValue="leads">
              <TabsList>
                <TabsTrigger value="leads" className="relative">
                  Leads
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">5</Badge>
                </TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              
              <TabsContent value="leads" className="mt-6">
                {/* Search */}
                <Card className="mb-4">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search leads..." 
                          className="pl-10 bg-muted" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Leads Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">All Leads</CardTitle>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Just Imported
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium text-sm w-10">
                              <Checkbox />
                            </th>
                            <th className="text-left p-3 font-medium text-sm">Lead</th>
                            <th className="text-left p-3 font-medium text-sm">Company</th>
                            <th className="text-left p-3 font-medium text-sm">Title</th>
                            <th className="text-left p-3 font-medium text-sm">Contact</th>
                            <th className="text-left p-3 font-medium text-sm">Status</th>
                            <th className="text-left p-3 font-medium text-sm">Assigned</th>
                            <th className="text-left p-3 font-medium text-sm w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, index) => (
                            <tr key={index} className="border-t hover:bg-muted/30 bg-green-500/5">
                              <td className="p-3"><Checkbox /></td>
                              <td className="p-3">
                                <div className="font-medium">{lead.name}</div>
                                <div className="text-xs text-muted-foreground">{lead.email}</div>
                              </td>
                              <td className="p-3 text-muted-foreground">{lead.company}</td>
                              <td className="p-3 text-muted-foreground text-sm">{lead.title}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-green-500" />
                                  {lead.hasPhone && <Phone className="h-4 w-4 text-green-500" />}
                                  <Linkedin className="h-4 w-4 text-blue-500" />
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                                  New
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                                    {lead.assignee}
                                  </div>
                                  <span className="text-sm text-muted-foreground">Sarah M.</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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