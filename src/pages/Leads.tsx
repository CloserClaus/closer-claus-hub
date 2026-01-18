import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApolloSearchTab } from '@/components/leads/ApolloSearchTab';
import { LeadListsTab } from '@/components/leads/LeadListsTab';
import { SavedLeadsTab } from '@/components/leads/SavedLeadsTab';
import { LeadCreditsDisplay } from '@/components/leads/LeadCreditsDisplay';
import { Search, List, Users } from 'lucide-react';

const Leads = () => {
  const [activeTab, setActiveTab] = useState('search');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lead Marketplace</h1>
            <p className="text-muted-foreground">
              Search and enrich leads from Apollo's database
            </p>
          </div>
          <LeadCreditsDisplay />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Saved Leads</span>
            </TabsTrigger>
            <TabsTrigger value="lists" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lists</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-6">
            <ApolloSearchTab />
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            <SavedLeadsTab />
          </TabsContent>

          <TabsContent value="lists" className="mt-6">
            <LeadListsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Leads;
