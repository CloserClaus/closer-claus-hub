import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Search, RotateCcw } from 'lucide-react';
import { SearchFilters } from './ApolloSearchTab';
import { useState } from 'react';

interface ApolloSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
}

const SENIORITY_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'vp', label: 'VP' },
  { value: 'head', label: 'Head' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior', label: 'Senior' },
  { value: 'entry', label: 'Entry' },
  { value: 'intern', label: 'Intern' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'operations', label: 'Operations' },
  { value: 'information_technology', label: 'IT' },
  { value: 'legal', label: 'Legal' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'product_management', label: 'Product' },
  { value: 'customer_success', label: 'Customer Success' },
];

const EMPLOYEE_RANGE_OPTIONS = [
  { value: '1,10', label: '1-10' },
  { value: '11,20', label: '11-20' },
  { value: '21,50', label: '21-50' },
  { value: '51,100', label: '51-100' },
  { value: '101,200', label: '101-200' },
  { value: '201,500', label: '201-500' },
  { value: '501,1000', label: '501-1,000' },
  { value: '1001,2000', label: '1,001-2,000' },
  { value: '2001,5000', label: '2,001-5,000' },
  { value: '5001,10000', label: '5,001-10,000' },
  { value: '10001,', label: '10,000+' },
];

const COUNTRY_OPTIONS = [
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'India', label: 'India' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Brazil', label: 'Brazil' },
];

export function ApolloSearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
}: ApolloSearchFiltersProps) {
  const [titleInput, setTitleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const addTitle = () => {
    if (titleInput.trim() && !filters.person_titles.includes(titleInput.trim())) {
      onFiltersChange({
        ...filters,
        person_titles: [...filters.person_titles, titleInput.trim()],
      });
      setTitleInput('');
    }
  };

  const removeTitle = (title: string) => {
    onFiltersChange({
      ...filters,
      person_titles: filters.person_titles.filter((t) => t !== title),
    });
  };

  const addLocation = () => {
    if (locationInput.trim() && !filters.person_locations.includes(locationInput.trim())) {
      onFiltersChange({
        ...filters,
        person_locations: [...filters.person_locations, locationInput.trim()],
      });
      setLocationInput('');
    }
  };

  const removeLocation = (location: string) => {
    onFiltersChange({
      ...filters,
      person_locations: filters.person_locations.filter((l) => l !== location),
    });
  };

  const toggleSeniority = (value: string) => {
    const current = filters.person_seniorities;
    onFiltersChange({
      ...filters,
      person_seniorities: current.includes(value)
        ? current.filter((s) => s !== value)
        : [...current, value],
    });
  };

  const toggleDepartment = (value: string) => {
    const current = filters.person_departments;
    onFiltersChange({
      ...filters,
      person_departments: current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value],
    });
  };

  const toggleEmployeeRange = (value: string) => {
    const current = filters.organization_num_employees_ranges;
    onFiltersChange({
      ...filters,
      organization_num_employees_ranges: current.includes(value)
        ? current.filter((r) => r !== value)
        : [...current, value],
    });
  };

  const toggleCountry = (value: string) => {
    const current = filters.person_country;
    onFiltersChange({
      ...filters,
      person_country: current.includes(value)
        ? current.filter((c) => c !== value)
        : [...current, value],
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      person_titles: [],
      person_seniorities: [],
      person_departments: [],
      person_locations: [],
      person_country: [],
      organization_industry_tag_ids: [],
      organization_num_employees_ranges: [],
      page: 1,
      per_page: 25,
    });
    setTitleInput('');
    setLocationInput('');
  };

  const hasFilters =
    filters.person_titles.length > 0 ||
    filters.person_seniorities.length > 0 ||
    filters.person_departments.length > 0 ||
    filters.person_locations.length > 0 ||
    filters.person_country.length > 0 ||
    filters.organization_num_employees_ranges.length > 0;

  return (
    <div className="space-y-5">
      {/* Job Titles */}
      <div className="space-y-2">
        <Label>Job Titles</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. CEO, Sales Director"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTitle()}
          />
          <Button type="button" size="sm" onClick={addTitle}>
            Add
          </Button>
        </div>
        {filters.person_titles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {filters.person_titles.map((title) => (
              <Badge key={title} variant="secondary" className="gap-1">
                {title}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeTitle(title)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Seniority */}
      <div className="space-y-2">
        <Label>Seniority</Label>
        <div className="flex flex-wrap gap-1">
          {SENIORITY_OPTIONS.map((option) => (
            <Badge
              key={option.value}
              variant={filters.person_seniorities.includes(option.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleSeniority(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label>Department</Label>
        <div className="flex flex-wrap gap-1">
          {DEPARTMENT_OPTIONS.map((option) => (
            <Badge
              key={option.value}
              variant={filters.person_departments.includes(option.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleDepartment(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>Location (City/State)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. San Francisco, California"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLocation()}
          />
          <Button type="button" size="sm" onClick={addLocation}>
            Add
          </Button>
        </div>
        {filters.person_locations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {filters.person_locations.map((location) => (
              <Badge key={location} variant="secondary" className="gap-1">
                {location}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeLocation(location)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Country */}
      <div className="space-y-2">
        <Label>Country</Label>
        <div className="flex flex-wrap gap-1">
          {COUNTRY_OPTIONS.map((option) => (
            <Badge
              key={option.value}
              variant={filters.person_country.includes(option.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleCountry(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Company Size */}
      <div className="space-y-2">
        <Label>Company Size (Employees)</Label>
        <div className="flex flex-wrap gap-1">
          {EMPLOYEE_RANGE_OPTIONS.map((option) => (
            <Badge
              key={option.value}
              variant={filters.organization_num_employees_ranges.includes(option.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleEmployeeRange(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

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
