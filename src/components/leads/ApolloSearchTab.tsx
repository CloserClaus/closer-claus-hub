import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApolloSearchFilters } from './ApolloSearchFilters';
import { ApolloSearchResults } from './ApolloSearchResults';
import { useApolloSearch } from '@/hooks/useApolloSearch';

export interface SearchFilters {
  // Person filters
  person_titles: string[];
  person_titles_exclude: string[];
  person_seniorities: string[];
  person_departments: string[];
  person_locations: string[];
  person_locations_exclude: string[];
  person_country: string[];
  person_state: string[];
  person_city: string[];
  // Organization filters
  organization_industry_tag_ids: string[];
  organization_industries_exclude: string[];
  organization_num_employees_ranges: string[];
  organization_locations: string[];
  organization_locations_exclude: string[];
  revenue_range: string[];
  founding_year_range: string[];
  technologies: string[];
  technologies_exclude: string[];
  company_type: string[];
  keywords: string[];
  keywords_exclude: string[];
  funding_stage: string[];
  // Contact filters
  has_email: boolean | null;
  has_phone: boolean | null;
  // Pagination
  page: number;
  per_page: number;
}

const defaultFilters: SearchFilters = {
  person_titles: [],
  person_titles_exclude: [],
  person_seniorities: [],
  person_departments: [],
  person_locations: [],
  person_locations_exclude: [],
  person_country: [],
  person_state: [],
  person_city: [],
  organization_industry_tag_ids: [],
  organization_industries_exclude: [],
  organization_num_employees_ranges: [],
  organization_locations: [],
  organization_locations_exclude: [],
  revenue_range: [],
  founding_year_range: [],
  technologies: [],
  technologies_exclude: [],
  company_type: [],
  keywords: [],
  keywords_exclude: [],
  funding_stage: [],
  has_email: null,
  has_phone: null,
  page: 1,
  per_page: 25,
};

export function ApolloSearchTab() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  const { 
    searchResults, 
    isSearching, 
    pagination, 
    search,
    enrichLeads,
    isEnriching,
    enrichmentProgress,
    resetEnrichmentProgress,
  } = useApolloSearch();

  // Reset enrichment progress when selection changes
  useEffect(() => {
    if (enrichmentProgress.status === 'complete' || enrichmentProgress.status === 'error') {
      // Small delay to let user see the result
      const timer = setTimeout(() => {
        resetEnrichmentProgress();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [enrichmentProgress.status, resetEnrichmentProgress]);

  const handleSearch = () => {
    setSelectedLeads([]);
    search(filters);
  };

  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    search(newFilters);
    setSelectedLeads([]);
  };

  const handlePerPageChange = (perPage: number) => {
    const newFilters = { ...filters, per_page: perPage, page: 1 };
    setFilters(newFilters);
    search(newFilters);
    setSelectedLeads([]);
  };

  const handleEnrichSelected = async (addToCRM: boolean) => {
    if (selectedLeads.length === 0) return;
    await enrichLeads(selectedLeads, addToCRM);
    setSelectedLeads([]);
  };

  const displayResults = searchResults;
  const displayPagination = pagination;

  return (
    <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
      <Card className="h-fit sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Search Filters
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Use filters to find your ideal prospects
          </p>
        </CardHeader>
        <CardContent>
          <ApolloSearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
            isSearching={isSearching}
          />
        </CardContent>
      </Card>

      <ApolloSearchResults
        results={displayResults}
        isLoading={isSearching}
        pagination={displayPagination}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        selectedLeads={selectedLeads}
        onSelectionChange={setSelectedLeads}
        onEnrichSelected={handleEnrichSelected}
        isEnriching={isEnriching}
        enrichmentProgress={enrichmentProgress}
      />
    </div>
  );
}
