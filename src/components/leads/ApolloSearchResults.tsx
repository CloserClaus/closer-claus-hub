import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users as UsersIcon,
  Sparkles,
  List,
  LayoutGrid,
  Table as TableIcon,
  UserPlus,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ResultsTable } from './ResultsTable';
import { ResultsPagination } from './ResultsPagination';
import { EnrichmentDialog } from './EnrichmentDialog';
import { AddToListDialog } from './AddToListDialog';
import { ImportToCRMDialog } from './ImportToCRMDialog';
import { EnrichmentProgress } from '@/hooks/useApolloSearch';
import { useImportToCRM } from '@/hooks/useImportToCRM';
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
const ITEMS_PER_PAGE = 25;

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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [enrichCount, setEnrichCount] = useState<string>('');

  const { importLeads, isImporting, importProgress, resetImportProgress } = useImportToCRM();

  // Calculate paginated results for client-side pagination
  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return results.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [results, currentPage]);

  // Reset to page 1 when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [results.length]);

  const unenrichedLeads = results.filter((lead) => lead.enrichment_status !== 'enriched');
  const enrichedLeads = results.filter((lead) => lead.enrichment_status === 'enriched');
  
  // How many leads will be enriched based on enrichCount input
  const enrichCountNum = parseInt(enrichCount) || 0;
  const leadsToEnrich = Math.min(enrichCountNum, unenrichedLeads.length);

  const handleEnrichByCount = async (addToCRM: boolean) => {
    if (leadsToEnrich === 0) return;
    // Select the first N unenriched leads
    const idsToEnrich = unenrichedLeads.slice(0, leadsToEnrich).map(l => l.id);
    onSelectionChange(idsToEnrich);
    await onEnrichSelected(addToCRM);
    setEnrichCount('');
  };

  const handleEnrich = async (addToCRM: boolean) => {
    if (enrichCount && leadsToEnrich > 0) {
      await handleEnrichByCount(addToCRM);
    } else {
      await onEnrichSelected(addToCRM);
    }
  };

  const handleImport = async () => {
    const enrichedLeadIds = results
      .filter((lead) => selectedLeads.includes(lead.id) && lead.enrichment_status === 'enriched')
      .map((lead) => lead.id);
    await importLeads(enrichedLeadIds);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onSelectionChange([]); // Clear selection when changing pages
  };

  // Reset import progress when dialog closes
  useEffect(() => {
    if (!showImportDialog) {
      const timer = setTimeout(resetImportProgress, 300);
      return () => clearTimeout(timer);
    }
  }, [showImportDialog, resetImportProgress]);

  // Calculate counts for selected leads on current page
  const unenrichedSelected = paginatedResults
    .filter((lead) => selectedLeads.includes(lead.id) && lead.enrichment_status !== 'enriched')
    .length;

  const enrichedSelected = paginatedResults
    .filter((lead) => selectedLeads.includes(lead.id) && lead.enrichment_status === 'enriched')
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
    <>
      <Card>
        <CardHeader className="pb-3">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Search Results
                <span className="text-sm font-normal text-muted-foreground">
                  ({results.length.toLocaleString()})
                </span>
              </CardTitle>
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="border rounded-md h-8"
              >
                <ToggleGroupItem value="table" size="sm" aria-label="Table view" className="h-7 w-7 p-0">
                  <TableIcon className="h-3.5 w-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" size="sm" aria-label="Card view" className="h-7 w-7 p-0">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 text-sm">
              {enrichedLeads.length > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  {enrichedLeads.length} enriched
                </span>
              )}
              {unenrichedLeads.length > 0 && (
                <span className="text-muted-foreground">
                  {unenrichedLeads.length} pending
                </span>
              )}
            </div>
          </div>

          {/* Selection Actions Bar */}
          {selectedLeads.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-3 border-t mt-3">
              <span className="text-sm font-medium">
                {selectedLeads.length} selected
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddToListDialog(true)}
                  className="h-8"
                >
                  <List className="h-3.5 w-3.5 mr-1.5" />
                  Add to List
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                  disabled={isImporting || enrichedSelected === 0}
                  className="h-8"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Import ({enrichedSelected})
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowEnrichDialog(true)}
                  disabled={isEnriching || unenrichedSelected === 0}
                  className="h-8"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Enrich ({unenrichedSelected})
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Enrich Bar */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border mt-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-medium whitespace-nowrap">Quick Enrich:</span>
              <Input
                type="number"
                min="1"
                max={unenrichedLeads.length}
                value={enrichCount}
                onChange={(e) => setEnrichCount(e.target.value)}
                placeholder="Amount"
                className="w-20 h-8 text-center"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                / {unenrichedLeads.length} available
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setShowEnrichDialog(true)}
              disabled={isEnriching || leadsToEnrich === 0}
              className="h-8 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Enrich {leadsToEnrich > 0 ? leadsToEnrich : ''}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {viewMode === 'table' ? (
            <ResultsTable
              leads={paginatedResults}
              selectedLeads={selectedLeads}
              onSelectionChange={onSelectionChange}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {paginatedResults.map((lead) => (
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

          {/* Client-side pagination */}
          {totalPages > 1 && (
            <ResultsPagination
              pagination={{
                page: currentPage,
                per_page: ITEMS_PER_PAGE,
                total_entries: results.length,
                total_pages: totalPages,
              }}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>

      <EnrichmentDialog
        open={showEnrichDialog}
        onOpenChange={setShowEnrichDialog}
        selectedCount={leadsToEnrich > 0 ? leadsToEnrich : selectedLeads.length}
        unenrichedCount={leadsToEnrich > 0 ? leadsToEnrich : unenrichedSelected}
        onEnrich={handleEnrich}
        isEnriching={isEnriching}
        enrichmentProgress={enrichmentProgress}
      />

      <AddToListDialog
        open={showAddToListDialog}
        onOpenChange={setShowAddToListDialog}
        selectedLeadIds={selectedLeads}
      />

      <ImportToCRMDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        selectedCount={selectedLeads.length}
        enrichedCount={enrichedSelected}
        onImport={handleImport}
        isImporting={isImporting}
        importProgress={importProgress}
      />
    </>
  );
}
