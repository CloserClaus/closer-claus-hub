import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, RotateCcw, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { SearchFilters } from './ApolloSearchTab';
import { useState } from 'react';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  const [showExclusions, setShowExclusions] = useState(false);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      person_titles: [],
      person_titles_exclude: [],
      person_seniorities: [],
      person_departments: [],
      person_locations: [],
      person_locations_exclude: [],
      person_city: [],
      person_state: [],
      person_country: [],
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
    });
  };

  const countActiveFilters = () => {
    let count = 0;
    if ((filters.person_titles?.length || 0) > 0) count++;
    if ((filters.person_titles_exclude?.length || 0) > 0) count++;
    if ((filters.person_seniorities?.length || 0) > 0) count++;
    if ((filters.person_departments?.length || 0) > 0) count++;
    if ((filters.person_locations?.length || 0) > 0) count++;
    if ((filters.person_locations_exclude?.length || 0) > 0) count++;
    if ((filters.person_city?.length || 0) > 0) count++;
    if ((filters.person_state?.length || 0) > 0) count++;
    if ((filters.person_country?.length || 0) > 0) count++;
    if ((filters.organization_industry_tag_ids?.length || 0) > 0) count++;
    if ((filters.organization_industries_exclude?.length || 0) > 0) count++;
    if ((filters.organization_num_employees_ranges?.length || 0) > 0) count++;
    if ((filters.organization_locations?.length || 0) > 0) count++;
    if ((filters.organization_locations_exclude?.length || 0) > 0) count++;
    if ((filters.revenue_range?.length || 0) > 0) count++;
    if ((filters.founding_year_range?.length || 0) > 0) count++;
    if ((filters.technologies?.length || 0) > 0) count++;
    if ((filters.technologies_exclude?.length || 0) > 0) count++;
    if ((filters.company_type?.length || 0) > 0) count++;
    if ((filters.keywords?.length || 0) > 0) count++;
    if ((filters.keywords_exclude?.length || 0) > 0) count++;
    if ((filters.funding_stage?.length || 0) > 0) count++;
    if (filters.has_email !== null) count++;
    if (filters.has_phone !== null) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <div className="space-y-4">
      {/* Filter count indicator */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}

      {/* Person Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          Person Filters
        </h3>
        
        <div className="space-y-2">
          <Label className="text-sm">Job Titles</Label>
          <MultiSelectCombobox
            options={JOB_TITLE_SUGGESTIONS}
            selected={filters.person_titles || []}
            onSelectionChange={(val) => updateFilter('person_titles', val)}
            placeholder="e.g. CEO, Sales Director..."
            searchPlaceholder="Type to search or add custom..."
            allowCustom
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Seniority Level</Label>
          <MultiSelectCombobox
            options={SENIORITY_OPTIONS}
            selected={filters.person_seniorities || []}
            onSelectionChange={(val) => updateFilter('person_seniorities', val)}
            placeholder="Select seniority..."
            searchPlaceholder="Search seniority..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Department</Label>
          <MultiSelectCombobox
            options={DEPARTMENT_OPTIONS}
            selected={filters.person_departments || []}
            onSelectionChange={(val) => updateFilter('person_departments', val)}
            placeholder="Select departments..."
            searchPlaceholder="Search departments..."
          />
        </div>
      </div>

      <Separator />

      {/* Location Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Location</h3>
        
        <div className="space-y-2">
          <Label className="text-sm">Country</Label>
          <MultiSelectCombobox
            options={COUNTRY_OPTIONS}
            selected={filters.person_country || []}
            onSelectionChange={(val) => updateFilter('person_country', val)}
            placeholder="Select countries..."
            searchPlaceholder="Type to search..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">State / Region</Label>
          <MultiSelectCombobox
            options={US_STATE_OPTIONS}
            selected={filters.person_state || []}
            onSelectionChange={(val) => updateFilter('person_state', val)}
            placeholder="Select states..."
            searchPlaceholder="Type to search..."
            allowCustom
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">City</Label>
          <MultiSelectCombobox
            options={US_CITY_OPTIONS}
            selected={filters.person_city || []}
            onSelectionChange={(val) => updateFilter('person_city', val)}
            placeholder="Select cities..."
            searchPlaceholder="Type to search or add..."
            allowCustom
          />
        </div>
      </div>

      <Separator />

      {/* Company Filters */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Company</h3>
        
        <div className="space-y-2">
          <Label className="text-sm">Industry</Label>
          <MultiSelectCombobox
            options={INDUSTRY_OPTIONS}
            selected={filters.organization_industry_tag_ids || []}
            onSelectionChange={(val) => updateFilter('organization_industry_tag_ids', val)}
            placeholder="Select industries..."
            searchPlaceholder="Type to search..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Company Size</Label>
          <MultiSelectCombobox
            options={EMPLOYEE_RANGE_OPTIONS}
            selected={filters.organization_num_employees_ranges || []}
            onSelectionChange={(val) => updateFilter('organization_num_employees_ranges', val)}
            placeholder="Select employee count..."
            searchPlaceholder="Search..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Revenue</Label>
          <MultiSelectCombobox
            options={REVENUE_OPTIONS}
            selected={filters.revenue_range || []}
            onSelectionChange={(val) => updateFilter('revenue_range', val)}
            placeholder="Select revenue range..."
            searchPlaceholder="Search..."
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between hover:bg-muted/50">
            <span className="flex items-center gap-2">
              Advanced Filters
              {(filters.technologies?.length || 0) + (filters.funding_stage?.length || 0) + (filters.keywords?.length || 0) > 0 && (
                <Badge variant="secondary" className="h-5 text-xs">
                  {(filters.technologies?.length || 0) + (filters.funding_stage?.length || 0) + (filters.keywords?.length || 0)}
                </Badge>
              )}
            </span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label className="text-sm">Technologies Used</Label>
            <MultiSelectCombobox
              options={TECHNOLOGY_OPTIONS}
              selected={filters.technologies || []}
              onSelectionChange={(val) => updateFilter('technologies', val)}
              placeholder="e.g. React, AWS, Salesforce..."
              searchPlaceholder="Search tech stack..."
              allowCustom
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Company Type</Label>
            <MultiSelectCombobox
              options={COMPANY_TYPE_OPTIONS}
              selected={filters.company_type || []}
              onSelectionChange={(val) => updateFilter('company_type', val)}
              placeholder="Select company types..."
              searchPlaceholder="Search..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Funding Stage</Label>
            <MultiSelectCombobox
              options={FUNDING_OPTIONS}
              selected={filters.funding_stage || []}
              onSelectionChange={(val) => updateFilter('funding_stage', val)}
              placeholder="Select funding stages..."
              searchPlaceholder="Search..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Year Founded</Label>
            <MultiSelectCombobox
              options={FOUNDING_YEAR_OPTIONS}
              selected={filters.founding_year_range || []}
              onSelectionChange={(val) => updateFilter('founding_year_range', val)}
              placeholder="Select year range..."
              searchPlaceholder="Search..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Keywords</Label>
            <MultiSelectCombobox
              options={KEYWORD_OPTIONS}
              selected={filters.keywords || []}
              onSelectionChange={(val) => updateFilter('keywords', val)}
              placeholder="Company keywords..."
              searchPlaceholder="Type to add..."
              allowCustom
            />
          </div>

          <Separator className="my-3" />

          {/* Contact Data Filters */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Contact Data Requirements</Label>
            
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <Label htmlFor="has-email" className="text-sm cursor-pointer">Has Email</Label>
              <Switch 
                id="has-email"
                checked={filters.has_email === true}
                onCheckedChange={(checked) => updateFilter('has_email', checked ? true : null)}
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <Label htmlFor="has-phone" className="text-sm cursor-pointer">Has Phone</Label>
              <Switch 
                id="has-phone"
                checked={filters.has_phone === true}
                onCheckedChange={(checked) => updateFilter('has_phone', checked ? true : null)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Exclusion Filters */}
      <Collapsible open={showExclusions} onOpenChange={setShowExclusions}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between hover:bg-destructive/5 text-destructive/80 hover:text-destructive">
            <span className="flex items-center gap-2">
              Exclude Filters
              {(filters.person_titles_exclude?.length || 0) + 
               (filters.person_locations_exclude?.length || 0) + 
               (filters.organization_industries_exclude?.length || 0) +
               (filters.technologies_exclude?.length || 0) +
               (filters.keywords_exclude?.length || 0) > 0 && (
                <Badge variant="destructive" className="h-5 text-xs">
                  {(filters.person_titles_exclude?.length || 0) + 
                   (filters.person_locations_exclude?.length || 0) + 
                   (filters.organization_industries_exclude?.length || 0) +
                   (filters.technologies_exclude?.length || 0) +
                   (filters.keywords_exclude?.length || 0)}
                </Badge>
              )}
            </span>
            {showExclusions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3 border-l-2 border-destructive/20 pl-3 ml-1">
          <p className="text-xs text-muted-foreground">
            Exclude contacts matching these criteria from your search results.
          </p>

          <div className="space-y-2">
            <Label className="text-sm text-destructive/80">Exclude Job Titles</Label>
            <MultiSelectCombobox
              options={JOB_TITLE_SUGGESTIONS}
              selected={filters.person_titles_exclude || []}
              onSelectionChange={(val) => updateFilter('person_titles_exclude', val)}
              placeholder="Titles to exclude..."
              searchPlaceholder="Type to add..."
              allowCustom
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-destructive/80">Exclude Locations</Label>
            <MultiSelectCombobox
              options={[...COUNTRY_OPTIONS, ...US_STATE_OPTIONS, ...US_CITY_OPTIONS]}
              selected={filters.person_locations_exclude || []}
              onSelectionChange={(val) => updateFilter('person_locations_exclude', val)}
              placeholder="Locations to exclude..."
              searchPlaceholder="Type to search..."
              allowCustom
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-destructive/80">Exclude Industries</Label>
            <MultiSelectCombobox
              options={INDUSTRY_OPTIONS}
              selected={filters.organization_industries_exclude || []}
              onSelectionChange={(val) => updateFilter('organization_industries_exclude', val)}
              placeholder="Industries to exclude..."
              searchPlaceholder="Type to search..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-destructive/80">Exclude Technologies</Label>
            <MultiSelectCombobox
              options={TECHNOLOGY_OPTIONS}
              selected={filters.technologies_exclude || []}
              onSelectionChange={(val) => updateFilter('technologies_exclude', val)}
              placeholder="Technologies to exclude..."
              searchPlaceholder="Type to search..."
              allowCustom
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-destructive/80">Exclude Keywords</Label>
            <MultiSelectCombobox
              options={KEYWORD_OPTIONS}
              selected={filters.keywords_exclude || []}
              onSelectionChange={(val) => updateFilter('keywords_exclude', val)}
              placeholder="Keywords to exclude..."
              searchPlaceholder="Type to add..."
              allowCustom
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button onClick={onSearch} disabled={isSearching} className="flex-1" size="lg">
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? 'Searching...' : 'Search Leads'}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="outline" onClick={resetFilters} size="lg">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}