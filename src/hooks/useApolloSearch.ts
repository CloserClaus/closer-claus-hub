import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

interface SearchFilters {
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  person_country?: string[];
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  revenue_range_min?: number;
  revenue_range_max?: number;
  organization_founded_year_min?: number;
  organization_founded_year_max?: number;
  page?: number;
  per_page?: number;
}

interface PaginationInfo {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export interface EnrichmentProgress {
  current: number;
  total: number;
  status: 'idle' | 'enriching' | 'complete' | 'error';
  message?: string;
}

export function useApolloSearch() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [searchResults, setSearchResults] = useState<ApolloLead[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });

  const resetEnrichmentProgress = useCallback(() => {
    setEnrichmentProgress({
      current: 0,
      total: 0,
      status: 'idle',
    });
  }, []);

  const searchMutation = useMutation({
    mutationFn: async (filters: SearchFilters) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('apollo-search', {
        body: {
          workspace_id: currentWorkspace.id,
          filters,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Search failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      setSearchResults(data.leads || []);
      setPagination(data.pagination || null);
      toast.success(`Found ${data.pagination?.total_entries || 0} leads`);
      queryClient.invalidateQueries({ queryKey: ['apollo-leads'] });
    },
    onError: (error) => {
      toast.error('Search failed: ' + error.message);
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async ({ leadIds, addToCRM }: { leadIds: string[]; addToCRM: boolean }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      // Set initial progress
      setEnrichmentProgress({
        current: 0,
        total: leadIds.length,
        status: 'enriching',
      });

      const response = await supabase.functions.invoke('apollo-enrich', {
        body: {
          workspace_id: currentWorkspace.id,
          apollo_lead_ids: leadIds,
          add_to_crm: addToCRM,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Enrichment failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Update progress to complete
      setEnrichmentProgress({
        current: data.enriched_count || 0,
        total: data.enriched_count || 0,
        status: 'complete',
        message: `Successfully enriched ${data.enriched_count} leads! ${data.credits_used} credits used, ${data.remaining_credits} remaining.`,
      });

      toast.success(
        `Enriched ${data.enriched_count} leads (${data.credits_used} credits used). ${data.remaining_credits} credits remaining.`
      );
      
      // Update the local search results with enriched data
      setSearchResults((prev) =>
        prev.map((lead) => {
          const enrichedLead = data.enriched_leads?.find((e: ApolloLead) => e.id === lead.id);
          return enrichedLead || lead;
        })
      );

      queryClient.invalidateQueries({ queryKey: ['apollo-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-credits'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      setEnrichmentProgress((prev) => ({
        ...prev,
        status: 'error',
        message: error.message,
      }));
      toast.error('Enrichment failed: ' + error.message);
    },
  });

  const search = (filters: SearchFilters) => {
    searchMutation.mutate(filters);
  };

  const enrichLeads = async (leadIds: string[], addToCRM: boolean) => {
    await enrichMutation.mutateAsync({ leadIds, addToCRM });
  };

  return {
    searchResults,
    isSearching: searchMutation.isPending,
    pagination,
    search,
    enrichLeads,
    isEnriching: enrichMutation.isPending,
    enrichmentProgress,
    resetEnrichmentProgress,
  };
}
