import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApolloSearchFilters } from './ApolloSearchFilters';
import { ApolloSearchResults } from './ApolloSearchResults';
import { useApolloSearch } from '@/hooks/useApolloSearch';

export interface SearchFilters {
  person_titles: string[];
  person_seniorities: string[];
  person_departments: string[];
  person_locations: string[];
  person_country: string[];
  organization_industry_tag_ids: string[];
  organization_num_employees_ranges: string[];
  revenue_range_min?: number;
  revenue_range_max?: number;
  organization_founded_year_min?: number;
  organization_founded_year_max?: number;
  page: number;
  per_page: number;
}

const defaultFilters: SearchFilters = {
  person_titles: [],
  person_seniorities: [],
  person_departments: [],
  person_locations: [],
  person_country: [],
  organization_industry_tag_ids: [],
  organization_num_employees_ranges: [],
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
  } = useApolloSearch();

  const handleSearch = () => {
    search(filters);
    setSelectedLeads([]);
  };

  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    search(newFilters);
  };

  const handleEnrichSelected = async (addToCRM: boolean) => {
    if (selectedLeads.length === 0) return;
    await enrichLeads(selectedLeads, addToCRM);
    setSelectedLeads([]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Search Filters</CardTitle>
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
        results={searchResults}
        isLoading={isSearching}
        pagination={pagination}
        onPageChange={handlePageChange}
        selectedLeads={selectedLeads}
        onSelectionChange={setSelectedLeads}
        onEnrichSelected={handleEnrichSelected}
        isEnriching={isEnriching}
      />
    </div>
  );
}
