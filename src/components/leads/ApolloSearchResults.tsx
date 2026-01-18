import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin, 
  Users as UsersIcon,
  Sparkles,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

interface ApolloSearchResultsProps {
  results: ApolloLead[];
  isLoading: boolean;
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  } | null;
  onPageChange: (page: number) => void;
  selectedLeads: string[];
  onSelectionChange: (ids: string[]) => void;
  onEnrichSelected: (addToCRM: boolean) => void;
  isEnriching: boolean;
}

export function ApolloSearchResults({
  results,
  isLoading,
  pagination,
  onPageChange,
  selectedLeads,
  onSelectionChange,
  onEnrichSelected,
  isEnriching,
}: ApolloSearchResultsProps) {
  const toggleSelectAll = () => {
    if (selectedLeads.length === results.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(results.map((lead) => lead.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedLeads.includes(id)) {
      onSelectionChange(selectedLeads.filter((leadId) => leadId !== id));
    } else {
      onSelectionChange([...selectedLeads, id]);
    }
  };

  const unenrichedSelected = results
    .filter((lead) => selectedLeads.includes(lead.id) && lead.enrichment_status !== 'enriched')
    .length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm">Use the filters to search for leads</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg">
            Search Results
            {pagination && (
              <span className="text-muted-foreground font-normal ml-2">
                ({pagination.total_entries.toLocaleString()} found)
              </span>
            )}
          </CardTitle>
        </div>
        {selectedLeads.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedLeads.length} selected ({unenrichedSelected} to enrich)
            </span>
            <Button
              size="sm"
              onClick={() => onEnrichSelected(false)}
              disabled={isEnriching || unenrichedSelected === 0}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Enrich ({unenrichedSelected * 5} credits)
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => onEnrichSelected(true)}
              disabled={isEnriching || unenrichedSelected === 0}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Enrich & Add to CRM
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Select All */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            checked={selectedLeads.length === results.length && results.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">Select all on this page</span>
        </div>

        {/* Results List */}
        <div className="space-y-3">
          {results.map((lead) => (
            <div
              key={lead.id}
              className={`flex gap-4 p-4 border rounded-lg transition-colors ${
                selectedLeads.includes(lead.id) ? 'bg-accent/50 border-primary/30' : 'hover:bg-accent/30'
              }`}
            >
              <Checkbox
                checked={selectedLeads.includes(lead.id)}
                onCheckedChange={() => toggleSelect(lead.id)}
              />
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
                    {lead.enrichment_status === 'enriched' && (
                      <Badge variant="default" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Enriched
                      </Badge>
                    )}
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
                      {lead.employee_count && (
                        <span className="text-xs">({lead.employee_count} emp)</span>
                      )}
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

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
