import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SearchFilters } from './ApolloSearchTab';
import { useState } from 'react';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SENIORITY_OPTIONS,
  DEPARTMENT_OPTIONS,
  EMPLOYEE_RANGE_OPTIONS,
  COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  US_CITY_OPTIONS,
  INDUSTRY_OPTIONS,
  REVENUE_OPTIONS,
  FOUNDING_YEAR_OPTIONS,
  TECHNOLOGY_OPTIONS,
  EMAIL_STATUS_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  KEYWORD_OPTIONS,
  JOB_TITLE_SUGGESTIONS,
  FUNDING_OPTIONS,
} from './apolloFilterOptions';

interface ApolloSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function ApolloSearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
}: ApolloSearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      person_titles: [],
      person_seniorities: [],
      person_departments: [],
      person_locations: [],
      person_city: [],
      person_state: [],
      person_country: [],
      organization_industry_tag_ids: [],
      organization_num_employees_ranges: [],
      revenue_range: [],
      founding_year_range: [],
      technologies: [],
      contact_email_status: [],
      company_type: [],
      keywords: [],
      funding_stage: [],
      page: 1,
      per_page: 25,
    });
  };

  const hasFilters =
    (filters.person_titles?.length || 0) > 0 ||
    (filters.person_seniorities?.length || 0) > 0 ||
    (filters.person_departments?.length || 0) > 0 ||
    (filters.person_locations?.length || 0) > 0 ||
    (filters.person_city?.length || 0) > 0 ||
    (filters.person_state?.length || 0) > 0 ||
    (filters.person_country?.length || 0) > 0 ||
    (filters.organization_industry_tag_ids?.length || 0) > 0 ||
    (filters.organization_num_employees_ranges?.length || 0) > 0 ||
    (filters.revenue_range?.length || 0) > 0 ||
    (filters.founding_year_range?.length || 0) > 0 ||
    (filters.technologies?.length || 0) > 0 ||
    (filters.contact_email_status?.length || 0) > 0 ||
    (filters.company_type?.length || 0) > 0 ||
    (filters.keywords?.length || 0) > 0 ||
    (filters.funding_stage?.length || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Person Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Person Filters</h3>
        
        <div className="space-y-2">
          <Label>Job Titles</Label>
          <MultiSelectCombobox
            options={JOB_TITLE_SUGGESTIONS}
            selected={filters.person_titles || []}
            onSelectionChange={(val) => updateFilter('person_titles', val)}
            placeholder="Search job titles..."
            searchPlaceholder="Type to search or add custom..."
            allowCustom
          />
        </div>

        <div className="space-y-2">
          <Label>Seniority</Label>
          <MultiSelectCombobox
            options={SENIORITY_OPTIONS}
            selected={filters.person_seniorities || []}
            onSelectionChange={(val) => updateFilter('person_seniorities', val)}
            placeholder="Select seniority levels..."
            searchPlaceholder="Search seniority..."
          />
        </div>

        <div className="space-y-2">
          <Label>Department</Label>
          <MultiSelectCombobox
            options={DEPARTMENT_OPTIONS}
            selected={filters.person_departments || []}
            onSelectionChange={(val) => updateFilter('person_departments', val)}
            placeholder="Select departments..."
            searchPlaceholder="Search departments..."
          />
        </div>
      </div>

      {/* Location Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Location</h3>
        
        <div className="space-y-2">
          <Label>Country</Label>
          <MultiSelectCombobox
            options={COUNTRY_OPTIONS}
            selected={filters.person_country || []}
            onSelectionChange={(val) => updateFilter('person_country', val)}
            placeholder="Select countries..."
            searchPlaceholder="Type to search countries..."
          />
        </div>

        <div className="space-y-2">
          <Label>State / Region</Label>
          <MultiSelectCombobox
            options={US_STATE_OPTIONS}
            selected={filters.person_state || []}
            onSelectionChange={(val) => updateFilter('person_state', val)}
            placeholder="Select states..."
            searchPlaceholder="Type to search states..."
            allowCustom
          />
        </div>

        <div className="space-y-2">
          <Label>City</Label>
          <MultiSelectCombobox
            options={US_CITY_OPTIONS}
            selected={filters.person_city || []}
            onSelectionChange={(val) => updateFilter('person_city', val)}
            placeholder="Select cities..."
            searchPlaceholder="Type to search or add city..."
            allowCustom
          />
        </div>
      </div>

      {/* Company Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Company</h3>
        
        <div className="space-y-2">
          <Label>Industry</Label>
          <MultiSelectCombobox
            options={INDUSTRY_OPTIONS}
            selected={filters.organization_industry_tag_ids || []}
            onSelectionChange={(val) => updateFilter('organization_industry_tag_ids', val)}
            placeholder="Select industries..."
            searchPlaceholder="Type to search industries..."
          />
        </div>

        <div className="space-y-2">
          <Label>Company Size</Label>
          <MultiSelectCombobox
            options={EMPLOYEE_RANGE_OPTIONS}
            selected={filters.organization_num_employees_ranges || []}
            onSelectionChange={(val) => updateFilter('organization_num_employees_ranges', val)}
            placeholder="Select employee ranges..."
            searchPlaceholder="Search company sizes..."
          />
        </div>

        <div className="space-y-2">
          <Label>Revenue</Label>
          <MultiSelectCombobox
            options={REVENUE_OPTIONS}
            selected={filters.revenue_range || []}
            onSelectionChange={(val) => updateFilter('revenue_range', val)}
            placeholder="Select revenue ranges..."
            searchPlaceholder="Search revenue..."
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            Advanced Filters
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label>Technologies Used</Label>
            <MultiSelectCombobox
              options={TECHNOLOGY_OPTIONS}
              selected={filters.technologies || []}
              onSelectionChange={(val) => updateFilter('technologies', val)}
              placeholder="Select technologies..."
              searchPlaceholder="Search tech stack..."
            />
          </div>

          <div className="space-y-2">
            <Label>Company Type</Label>
            <MultiSelectCombobox
              options={COMPANY_TYPE_OPTIONS}
              selected={filters.company_type || []}
              onSelectionChange={(val) => updateFilter('company_type', val)}
              placeholder="Select company types..."
              searchPlaceholder="Search company types..."
            />
          </div>

          <div className="space-y-2">
            <Label>Funding Stage</Label>
            <MultiSelectCombobox
              options={FUNDING_OPTIONS}
              selected={filters.funding_stage || []}
              onSelectionChange={(val) => updateFilter('funding_stage', val)}
              placeholder="Select funding stages..."
              searchPlaceholder="Search funding..."
            />
          </div>

          <div className="space-y-2">
            <Label>Year Founded</Label>
            <MultiSelectCombobox
              options={FOUNDING_YEAR_OPTIONS}
              selected={filters.founding_year_range || []}
              onSelectionChange={(val) => updateFilter('founding_year_range', val)}
              placeholder="Select founding year range..."
              searchPlaceholder="Search years..."
            />
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <MultiSelectCombobox
              options={KEYWORD_OPTIONS}
              selected={filters.keywords || []}
              onSelectionChange={(val) => updateFilter('keywords', val)}
              placeholder="Select keywords..."
              searchPlaceholder="Search or add keywords..."
              allowCustom
            />
          </div>

          <div className="space-y-2">
            <Label>Email Status</Label>
            <MultiSelectCombobox
              options={EMAIL_STATUS_OPTIONS}
              selected={filters.contact_email_status || []}
              onSelectionChange={(val) => updateFilter('contact_email_status', val)}
              placeholder="Select email status..."
              searchPlaceholder="Search..."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button onClick={onSearch} disabled={isSearching} className="flex-1">
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
        {hasFilters && (
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
