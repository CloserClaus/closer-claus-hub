import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Download, 
  Building2, 
  Users, 
  MapPin,
  DollarSign,
  Mail,
  Phone,
  Linkedin
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateLeadPreview = () => {
  const leads = [
    { name: 'Michael Torres', company: 'CloudScale Inc', title: 'VP of Sales', industry: 'SaaS', size: '85', location: 'San Francisco, CA', email: 'm.torres@cloudscale.io', hasPhone: true, hasLinkedIn: true },
    { name: 'Jennifer Walsh', company: 'DataFlow Systems', title: 'Head of Growth', industry: 'SaaS', size: '120', location: 'Austin, TX', email: 'j.walsh@dataflow.com', hasPhone: true, hasLinkedIn: true },
    { name: 'Robert Kim', company: 'TechVenture Labs', title: 'Director of BD', industry: 'SaaS', size: '95', location: 'Seattle, WA', email: 'r.kim@techventure.io', hasPhone: false, hasLinkedIn: true },
    { name: 'Amanda Chen', company: 'ScaleUp Software', title: 'Sales Director', industry: 'SaaS', size: '150', location: 'Denver, CO', email: 'a.chen@scaleup.com', hasPhone: true, hasLinkedIn: true },
    { name: 'David Martinez', company: 'InnovateTech', title: 'VP Sales', industry: 'SaaS', size: '78', location: 'Boston, MA', email: 'd.martinez@innovatetech.co', hasPhone: true, hasLinkedIn: true },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="leads" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Leads" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Lead Marketplace</h1>
                <p className="text-muted-foreground">Search and enrich leads from our database</p>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <DollarSign className="h-4 w-4 mr-1" />
                847 credits remaining
              </Badge>
            </div>
            
            <Tabs defaultValue="search">
              <TabsList>
                <TabsTrigger value="search">Search</TabsTrigger>
                <TabsTrigger value="saved">Saved Leads</TabsTrigger>
                <TabsTrigger value="lists">Lists</TabsTrigger>
              </TabsList>
              
              <TabsContent value="search" className="mt-6">
                {/* Search Bar with active filters */}
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search leads..." 
                          className="pl-10 bg-muted" 
                        />
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
                    </div>
                  </CardContent>
                </Card>

                {/* Results Table - Preview mode */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">Search Results</CardTitle>
                      <Badge variant="outline">5 leads found</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                        Preview Mode
                      </Badge>
                      <Button>
                        <Download className="h-4 w-4 mr-2" />
                        Import to CRM (5 credits)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium text-sm w-10">
                              <Checkbox checked />
                            </th>
                            <th className="text-left p-3 font-medium text-sm">Name</th>
                            <th className="text-left p-3 font-medium text-sm">Company</th>
                            <th className="text-left p-3 font-medium text-sm">Title</th>
                            <th className="text-left p-3 font-medium text-sm">Location</th>
                            <th className="text-left p-3 font-medium text-sm">Contact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, index) => (
                            <tr key={index} className="border-t hover:bg-muted/30">
                              <td className="p-3"><Checkbox checked /></td>
                              <td className="p-3">
                                <div className="font-medium">{lead.name}</div>
                                <div className="text-xs text-muted-foreground">{lead.email}</div>
                              </td>
                              <td className="p-3">
                                <div className="text-muted-foreground">{lead.company}</div>
                                <div className="text-xs text-muted-foreground">{lead.size} employees</div>
                              </td>
                              <td className="p-3 text-muted-foreground">{lead.title}</td>
                              <td className="p-3 text-muted-foreground text-sm">{lead.location}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-green-500" />
                                  {lead.hasPhone && <Phone className="h-4 w-4 text-green-500" />}
                                  {lead.hasLinkedIn && <Linkedin className="h-4 w-4 text-blue-500" />}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        5 leads selected • Ready to import
                      </span>
                      <span className="text-sm">
                        Cost: <span className="font-semibold text-primary">5 credits</span>
                      </span>
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