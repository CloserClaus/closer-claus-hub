import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Filter, 
  Building2, 
  Users, 
  MapPin,
  Briefcase,
  DollarSign,
  X
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DemoStateLeadFilters = () => {
  const activeFilters = [
    { icon: Building2, label: 'SaaS', category: 'Industry' },
    { icon: Users, label: '50-200 employees', category: 'Size' },
    { icon: MapPin, label: 'United States', category: 'Location' },
    { icon: Briefcase, label: 'VP, Director, Head of', category: 'Title' },
    { icon: DollarSign, label: '$5M-50M Revenue', category: 'Revenue' },
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
                {/* Search Bar with Filter Button */}
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search leads by name, company, or title..." 
                          className="pl-10 bg-muted" 
                        />
                      </div>
                      <Button className="gap-2">
                        <Filter className="h-4 w-4" />
                        Apply Filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-4 gap-6">
                  {/* Filters Panel - Left Side */}
                  <Card className="col-span-1 h-fit">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        Filters
                        <Badge variant="secondary">5 active</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Active Filters */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Active Filters</p>
                        <div className="flex flex-wrap gap-2">
                          {activeFilters.map((filter, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="flex items-center gap-1 pl-2 pr-1 py-1"
                            >
                              <filter.icon className="h-3 w-3" />
                              {filter.label}
                              <button className="ml-1 hover:bg-muted rounded p-0.5">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Industry Filter */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Industry</p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked />
                            <span>SaaS</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>FinTech</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>Healthcare</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>E-commerce</span>
                          </label>
                        </div>
                      </div>

                      {/* Company Size Filter */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Company Size</p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>1-10</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>11-50</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked />
                            <span>50-200</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>200-500</span>
                          </label>
                        </div>
                      </div>

                      {/* Location Filter */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Location</p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked />
                            <span>United States</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>Canada</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox />
                            <span>United Kingdom</span>
                          </label>
                        </div>
                      </div>

                      <Button className="w-full" size="sm">
                        <Search className="h-4 w-4 mr-2" />
                        Search Leads
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Results Panel - Right Side (Empty state) */}
                  <Card className="col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base">Search Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <h3 className="font-medium text-lg mb-2">Configure your filters</h3>
                        <p className="text-sm mb-4">
                          Select your target criteria and click "Search Leads" to find matching prospects
                        </p>
                        <p className="text-xs">
                          Filters configured: Industry, Company Size, Location, Title, Revenue
                        </p>
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