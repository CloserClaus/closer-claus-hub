import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Download, CheckCircle2, Building2, Users, MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoState4Leads = () => {
  const leads = [
    { name: 'Michael Torres', company: 'CloudScale Inc', title: 'VP of Sales', industry: 'SaaS', size: '50-200', location: 'San Francisco, CA', enriched: true },
    { name: 'Jennifer Walsh', company: 'DataFlow Systems', title: 'Head of Growth', industry: 'SaaS', size: '50-200', location: 'Austin, TX', enriched: true },
    { name: 'Robert Kim', company: 'TechVenture Labs', title: 'Director of BD', industry: 'SaaS', size: '50-200', location: 'Seattle, WA', enriched: true },
    { name: 'Amanda Chen', company: 'ScaleUp Software', title: 'Sales Director', industry: 'SaaS', size: '50-200', location: 'Denver, CO', enriched: true },
    { name: 'David Martinez', company: 'InnovateTech', title: 'VP Sales', industry: 'SaaS', size: '50-200', location: 'Boston, MA', enriched: true },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="leads" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Lead Marketplace</h1>
              <p className="text-muted-foreground">Search and enrich leads</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                847 credits remaining
              </Badge>
            </div>
          </div>
          
          <Tabs defaultValue="search">
            <TabsList>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="saved">Saved Leads</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="mt-6">
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search leads..." className="pl-10" />
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1 px-3 py-2">
                        <Building2 className="h-3 w-3" /> SaaS
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1 px-3 py-2">
                        <Users className="h-3 w-3" /> 50-200
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1 px-3 py-2">
                        <MapPin className="h-3 w-3" /> United States
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      More Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Search Results</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-500 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      All Enriched
                    </Badge>
                    <Button size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Import to CRM
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium text-sm">
                            <Checkbox />
                          </th>
                          <th className="text-left p-3 font-medium text-sm">Name</th>
                          <th className="text-left p-3 font-medium text-sm">Company</th>
                          <th className="text-left p-3 font-medium text-sm">Title</th>
                          <th className="text-left p-3 font-medium text-sm">Location</th>
                          <th className="text-left p-3 font-medium text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead, index) => (
                          <tr key={index} className="border-t hover:bg-muted/30">
                            <td className="p-3"><Checkbox checked /></td>
                            <td className="p-3 font-medium">{lead.name}</td>
                            <td className="p-3 text-muted-foreground">{lead.company}</td>
                            <td className="p-3 text-muted-foreground">{lead.title}</td>
                            <td className="p-3 text-muted-foreground">{lead.location}</td>
                            <td className="p-3">
                              <Badge className="bg-green-500/20 text-green-500 border-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Enriched
                              </Badge>
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
      </div>
    </div>
  );
};
