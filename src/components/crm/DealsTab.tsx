import { Plus, DollarSign, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CRMFilters, FilterState } from '@/components/crm/CRMFilters';
import { CRMPagination } from '@/components/crm/Pagination';
import { Deal } from '@/hooks/useCRMData';

interface DealsTabProps {
  deals: Deal[];
  filteredDeals: Deal[];
  paginatedDeals: Deal[];
  dealFilters: FilterState;
  setDealFilters: (f: FilterState) => void;
  isAgencyOwner: boolean;
  selectedDealIds: Set<string>;
  toggleDealSelection: (id: string) => void;
  selectAllDeals: () => void;
  dealsPage: number;
  setDealsPage: (p: number) => void;
  totalDealsPages: number;
  onOpenDealDetail: (deal: Deal) => void;
  onAddDeal: () => void;
  onDispute: (deal: Deal) => void;
  onDeleteDeal: (dealId: string) => void;
}

export function DealsTab({
  deals, filteredDeals, paginatedDeals, dealFilters, setDealFilters,
  isAgencyOwner, selectedDealIds, toggleDealSelection, selectAllDeals,
  dealsPage, setDealsPage, totalDealsPages,
  onOpenDealDetail, onAddDeal, onDispute, onDeleteDeal,
}: DealsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <CRMFilters
          type="deals"
          filters={dealFilters}
          onFiltersChange={setDealFilters}
        />
        <div className="text-sm text-muted-foreground">
          {filteredDeals.length} of {deals.length} deals
        </div>
      </div>

      {filteredDeals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No deals yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first deal to track opportunities
            </p>
            <Button onClick={onAddDeal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
              onCheckedChange={selectAllDeals}
            />
            <span className="text-sm text-muted-foreground">
              Select all ({filteredDeals.length})
            </span>
          </div>

          <div className="space-y-3">
            {paginatedDeals.map(deal => (
              <Card
                key={deal.id}
                className={`glass hover:glow-sm transition-all cursor-pointer ${
                  selectedDealIds.has(deal.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onOpenDealDetail(deal)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDealIds.has(deal.id)}
                        onCheckedChange={() => toggleDealSelection(deal.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <h3 className="font-medium">{deal.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(deal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="capitalize">
                        {deal.stage.replace('_', ' ')}
                      </Badge>
                      <span className="font-semibold text-success">
                        ${Number(deal.value).toLocaleString()}
                      </span>
                      {!isAgencyOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); onDispute(deal); }}
                          title="File a dispute"
                        >
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        </Button>
                      )}
                      {isAgencyOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); onDeleteDeal(deal.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <CRMPagination
            currentPage={dealsPage}
            totalPages={totalDealsPages}
            onPageChange={setDealsPage}
          />
        </>
      )}
    </div>
  );
}
