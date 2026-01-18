import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users as UsersIcon,
  Sparkles,
  List,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ResultsTable } from './ResultsTable';
import { ResultsPagination } from './ResultsPagination';
import { EnrichmentDialog } from './EnrichmentDialog';
import { AddToListDialog } from './AddToListDialog';
import { EnrichmentProgress } from '@/hooks/useApolloSearch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LeadCard } from './LeadCard';

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
  onPerPageChange?: (perPage: number) => void;
  selectedLeads: string[];
  onSelectionChange: (ids: string[]) => void;
  onEnrichSelected: (addToCRM: boolean) => Promise<void>;
  isEnriching: boolean;
  enrichmentProgress?: EnrichmentProgress;
}

type ViewMode = 'cards' | 'table';

export function ApolloSearchResults({
  results,
  isLoading,
  pagination,
  onPageChange,
  onPerPageChange,
  selectedLeads,
  onSelectionChange,
  onEnrichSelected,
  isEnriching,
  enrichmentProgress,
}: ApolloSearchResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);

  const unenrichedSelected = results
    .filter((lead) => selectedLeads.includes(lead.id) && lead.enrichment_status !== 'enriched')
    .length;

  const handleEnrich = async (addToCRM: boolean) => {
    await onEnrichSelected(addToCRM);
  };

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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">
              Search Results
              {pagination && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({pagination.total_entries.toLocaleString()} found)
                </span>
              )}
            </CardTitle>
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="border rounded-md"
            >
              <ToggleGroupItem value="table" size="sm" aria-label="Table view">
                <TableIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" size="sm" aria-label="Card view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {selectedLeads.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {selectedLeads.length} selected ({unenrichedSelected} to enrich)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddToListDialog(true)}
              >
                <List className="h-4 w-4 mr-1" />
                Add to List
              </Button>
              <Button
                size="sm"
                onClick={() => setShowEnrichDialog(true)}
                disabled={isEnriching || unenrichedSelected === 0}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Enrich Selected
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {viewMode === 'table' ? (
            <ResultsTable
              leads={results}
              selectedLeads={selectedLeads}
              onSelectionChange={onSelectionChange}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {results.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedLeads.includes(lead.id)}
                  onToggleSelect={() => {
                    if (selectedLeads.includes(lead.id)) {
                      onSelectionChange(selectedLeads.filter(id => id !== lead.id));
                    } else {
                      onSelectionChange([...selectedLeads, lead.id]);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {pagination && pagination.total_pages > 1 && (
            <ResultsPagination
              pagination={pagination}
              onPageChange={onPageChange}
              onPerPageChange={onPerPageChange}
            />
          )}
        </CardContent>
      </Card>

      <EnrichmentDialog
        open={showEnrichDialog}
        onOpenChange={setShowEnrichDialog}
        selectedCount={selectedLeads.length}
        unenrichedCount={unenrichedSelected}
        onEnrich={handleEnrich}
        isEnriching={isEnriching}
        enrichmentProgress={enrichmentProgress}
      />

      <AddToListDialog
        open={showAddToListDialog}
        onOpenChange={setShowAddToListDialog}
        selectedLeadIds={selectedLeads}
      />
    </>
  );
}
