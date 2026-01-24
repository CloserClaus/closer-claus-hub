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

// Helper function to generate dummy leads
const generateDummyLeads = (count: number) => {
  const firstNames = ['Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'James', 'Amanda', 'Robert', 'Jennifer', 'Christopher', 'Lisa', 'Daniel', 'Michelle', 'Matthew', 'Ashley', 'Andrew', 'Stephanie', 'Joshua', 'Nicole', 'Ryan', 'Elizabeth', 'Justin', 'Heather', 'Brandon', 'Megan', 'William', 'Rachel', 'Jonathan', 'Lauren', 'Kevin', 'Samantha', 'Brian', 'Brittany', 'Tyler', 'Kayla', 'Eric', 'Rebecca', 'Adam', 'Christina', 'Nicholas'];
  const lastNames = ['Johnson', 'Chen', 'Rodriguez', 'Kim', 'Williams', 'Smith', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Ramirez', 'Campbell', 'Mitchell'];
  const titles = ['VP of Sales', 'Director of Engineering', 'Chief Marketing Officer', 'Head of Product', 'Senior Account Executive', 'Sales Manager', 'CEO', 'CTO', 'CFO', 'COO', 'Director of Sales', 'VP of Marketing', 'Head of Growth', 'Business Development Manager', 'Enterprise Account Executive', 'Regional Sales Director', 'VP of Operations', 'Director of Customer Success', 'Head of Partnerships', 'Chief Revenue Officer'];
  const companies = ['TechCorp Inc.', 'DataFlow Systems', 'GrowthLabs', 'InnovateTech', 'CloudSolutions Ltd', 'NextGen Software', 'Digital Dynamics', 'Apex Technologies', 'Summit Systems', 'Velocity Partners', 'Quantum Analytics', 'Pioneer Digital', 'Elevate Inc.', 'Synergy Solutions', 'Horizon Tech', 'Pulse Analytics', 'Momentum Labs', 'Catalyst Corp', 'Forge Digital', 'Spark Innovations'];
  const companyDomains = ['techcorp.com', 'dataflow.io', 'growthlabs.com', 'innovatetech.co', 'cloudsolutions.com', 'nextgensoftware.io', 'digitaldynamics.com', 'apextechnologies.com', 'summitsystems.io', 'velocitypartners.com', 'quantumanalytics.io', 'pioneerdigital.com', 'elevate.io', 'synergysolutions.com', 'horizontech.co', 'pulseanalytics.io', 'momentumlabs.com', 'catalystcorp.io', 'forgedigital.com', 'sparkinnovations.io'];
  const industries = ['Computer Software', 'Information Technology', 'Marketing & Advertising', 'Financial Services', 'Healthcare', 'E-commerce', 'SaaS', 'Telecommunications', 'Manufacturing', 'Consulting', 'Real Estate', 'Education', 'Logistics', 'Media & Entertainment', 'Cybersecurity'];
  const cities = ['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston', 'Denver', 'Los Angeles', 'Atlanta', 'Miami', 'Portland', 'Dallas', 'Phoenix', 'San Diego', 'Philadelphia'];
  const states = ['California', 'New York', 'Texas', 'Washington', 'Illinois', 'Massachusetts', 'Colorado', 'Georgia', 'Florida', 'Oregon', 'Arizona', 'Pennsylvania'];
  const employeeCounts = ['1-10', '11-50', '51-100', '101-200', '201-500', '501-1000', '1001-5000', '5000+'];
  const seniorities = ['C-Suite', 'VP', 'Director', 'Head', 'Senior', 'Manager', 'Entry'];
  const departments = ['Sales', 'Marketing', 'Engineering', 'Product Management', 'Operations', 'Finance', 'Customer Success', 'Business Development'];
  const emailStatuses = ['verified', 'valid', 'guessed', 'unavailable'];
  const phoneStatuses = ['valid', 'mobile', 'landline', 'unavailable'];

  const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const getRandomNumber = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

  return Array.from({ length: count }, (_, i) => {
    const firstName = getRandomItem(firstNames);
    const lastName = getRandomItem(lastNames);
    const companyIndex = getRandomNumber(0, companies.length - 1);
    const company = companies[companyIndex];
    const domain = companyDomains[companyIndex];
    // All leads start as unenriched so users can see the full flow
    const isEnriched = false;
    
    const linkedinHandle = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${getRandomNumber(10000, 99999)}`;
    const companyLinkedinHandle = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return {
      id: `demo-${i + 1}`,
      first_name: firstName,
      last_name: lastName,
      title: getRandomItem(titles),
      company: company,
      company_domain: domain,
      company_linkedin_url: `https://linkedin.com/company/${companyLinkedinHandle}`,
      linkedin_url: `https://linkedin.com/in/${linkedinHandle}`,
      industry: getRandomItem(industries),
      city: getRandomItem(cities),
      state: getRandomItem(states),
      country: 'United States',
      employee_count: getRandomItem(employeeCounts),
      seniority: getRandomItem(seniorities),
      department: getRandomItem(departments),
      enrichment_status: isEnriched ? 'enriched' : 'pending',
      email: isEnriched ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}` : null,
      email_status: isEnriched ? getRandomItem(emailStatuses) : null,
      phone: isEnriched ? `+1 (${getRandomNumber(200, 999)}) ${getRandomNumber(200, 999)}-${getRandomNumber(1000, 9999)}` : null,
      phone_status: isEnriched ? getRandomItem(phoneStatuses) : null,
    };
  });
};

// Remove global dummy results - they should only be generated per-session when user searches

export function ApolloSearchTab() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showDemoResults, setShowDemoResults] = useState(false); // Only show demo results after explicit search
  const [isDemoSearching, setIsDemoSearching] = useState(false);
  const [demoLeads, setDemoLeads] = useState<ReturnType<typeof generateDummyLeads>>([]);
  
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
    setIsDemoSearching(true);
    setSelectedLeads([]);
    
    // Generate fresh demo leads for this search session only
    // These are ephemeral and not shared across users/sessions
    const sessionDemoLeads = generateDummyLeads(500);
    
    // Simulate search delay for demo
    setTimeout(() => {
      setDemoLeads(sessionDemoLeads);
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

  // Use demo results if no real results and demo mode is active (only after user searches)
  const displayResults = searchResults.length > 0 ? searchResults : (showDemoResults && demoLeads.length > 0 ? demoLeads.map(d => ({
    ...d,
    apollo_id: d.id,
    workspace_id: '',
    enrichment_status: 'pending' as const,
    // Email and phone are only revealed after enrichment
    email: null,
    phone: null,
    email_status: null,
    phone_status: null,
    // LinkedIn and website are always visible from Apollo search
    linkedin_url: d.linkedin_url,
    company_name: d.company,
    company_domain: d.company_domain,
    company_linkedin_url: d.company_linkedin_url,
    credits_used: null,
    enriched_at: null,
    enriched_by: null,
    search_filters: null,
    created_at: new Date().toISOString(),
  })) : []);

  const displayPagination = pagination || (showDemoResults && demoLeads.length > 0 ? {
    page: 1,
    per_page: 25,
    total_entries: demoLeads.length,
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
