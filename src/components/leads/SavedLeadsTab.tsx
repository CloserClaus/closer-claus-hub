import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

export function SavedLeadsTab() {
  const { currentWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['apollo-leads', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('apollo_leads')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApolloLead[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const filteredLeads = leads?.filter((lead) => {
    const matchesSearch =
      searchQuery === '' ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.title?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || lead.enrichment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const enrichedCount = leads?.filter((l) => l.enrichment_status === 'enriched').length || 0;
  const searchedCount = leads?.filter((l) => l.enrichment_status === 'searched').length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Saved Leads</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {leads?.length || 0} total • {enrichedCount} enriched • {searchedCount} pending
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enriched">Enriched</SelectItem>
                <SelectItem value="searched">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filteredLeads || filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No saved leads</p>
            <p className="text-sm">Search and save leads from the Search tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex gap-4 p-4 border rounded-lg hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </h4>
                      {lead.title && (
                        <p className="text-sm text-muted-foreground">{lead.title}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Badge
                        variant={lead.enrichment_status === 'enriched' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {lead.enrichment_status === 'enriched' ? (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Enriched
                          </>
                        ) : (
                          'Pending'
                        )}
                      </Badge>
                      {lead.seniority && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {lead.seniority.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {lead.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {lead.company_name}
                      </span>
                    )}
                    {(lead.city || lead.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {lead.industry && (
                      <Badge variant="secondary" className="text-xs">
                        {lead.industry}
                      </Badge>
                    )}
                  </div>

                  {lead.enrichment_status === 'enriched' && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {lead.email}
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {lead.phone}
                        </a>
                      )}
                      {lead.linkedin_url && (
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
