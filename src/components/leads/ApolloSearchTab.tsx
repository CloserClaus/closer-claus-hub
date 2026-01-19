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

// Dummy data for demo purposes
export const DUMMY_RESULTS = [
  {
    id: 'demo-1',
    first_name: 'Sarah',
    last_name: 'Johnson',
    title: 'VP of Sales',
    company: 'TechCorp Inc.',
    industry: 'Computer Software',
    city: 'San Francisco',
    state: 'California',
    country: 'United States',
    employee_count: '201-500',
    seniority: 'VP',
    department: 'Sales',
  },
  {
    id: 'demo-2',
    first_name: 'Michael',
    last_name: 'Chen',
    title: 'Director of Engineering',
    company: 'DataFlow Systems',
    industry: 'Information Technology',
    city: 'New York',
    state: 'New York',
    country: 'United States',
    employee_count: '51-100',
    seniority: 'Director',
    department: 'Engineering',
  },
  {
    id: 'demo-3',
    first_name: 'Emily',
    last_name: 'Rodriguez',
    title: 'Chief Marketing Officer',
    company: 'GrowthLabs',
    industry: 'Marketing & Advertising',
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    employee_count: '11-50',
    seniority: 'C-Suite',
    department: 'Marketing',
  },
  {
    id: 'demo-4',
    first_name: 'David',
    last_name: 'Kim',
    title: 'Head of Product',
    company: 'InnovateTech',
    industry: 'Computer Software',
    city: 'Seattle',
    state: 'Washington',
    country: 'United States',
    employee_count: '101-200',
    seniority: 'Head',
    department: 'Product Management',
  },
  {
    id: 'demo-5',
    first_name: 'Jessica',
    last_name: 'Williams',
    title: 'Senior Account Executive',
    company: 'CloudSolutions Ltd',
    industry: 'Information Technology',
    city: 'Chicago',
    state: 'Illinois',
    country: 'United States',
    employee_count: '501-1000',
    seniority: 'Senior',
    department: 'Sales',
  },
];

export function ApolloSearchTab() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showDemoResults, setShowDemoResults] = useState(true); // Show demo results by default
  const [isDemoSearching, setIsDemoSearching] = useState(false);
  
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
    // If no real API configured, show demo results
    setIsDemoSearching(true);
    setSelectedLeads([]);
    
    // Simulate search delay for demo
    setTimeout(() => {
      setShowDemoResults(true);
      setIsDemoSearching(false);
    }, 800);
    
    // Also trigger real search if available
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

  // Use demo results if no real results and demo mode is active
  const displayResults = searchResults.length > 0 ? searchResults : (showDemoResults ? DUMMY_RESULTS.map(d => ({
    ...d,
    apollo_id: d.id,
    workspace_id: '',
    enrichment_status: 'pending' as const,
    email: null,
    phone: null,
    linkedin_url: null,
    company_name: d.company,
    company_domain: null,
    company_linkedin_url: null,
    email_status: null,
    phone_status: null,
    credits_used: null,
    enriched_at: null,
    enriched_by: null,
    search_filters: null,
    created_at: new Date().toISOString(),
  })) : []);

  const displayPagination = pagination || (showDemoResults ? {
    page: 1,
    per_page: 25,
    total_entries: DUMMY_RESULTS.length,
    total_pages: 1,
  } : null);

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
            isSearching={isSearching || isDemoSearching}
          />
        </CardContent>
      </Card>

      <ApolloSearchResults
        results={displayResults}
        isLoading={isSearching || isDemoSearching}
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
