import { useState, useEffect } from 'react';
import { Filter, X, Save, ChevronDown, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

export interface FilterState {
  stage: string;
  dateRange: string;
  minValue: string;
  maxValue: string;
  hasEmail: string;
  hasPhone: string;
  assignedTo: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
}

const DEFAULT_FILTERS: FilterState = {
  stage: '',
  dateRange: '',
  minValue: '',
  maxValue: '',
  hasEmail: '',
  hasPhone: '',
  assignedTo: '',
};

const STORAGE_KEY = 'crm_saved_views';

interface CRMFiltersProps {
  type: 'leads' | 'deals';
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  teamMembers?: TeamMember[];
  isAgencyOwner?: boolean;
}

export function CRMFilters({ type, filters, onFiltersChange, teamMembers = [], isAgencyOwner = false }: CRMFiltersProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${type}`);
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [type]);

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const saveView = () => {
    if (!viewName.trim()) return;

    const newView: SavedView = {
      id: Date.now().toString(),
      name: viewName.trim(),
      filters: { ...filters },
    };

    const updated = [...savedViews, newView];
    setSavedViews(updated);
    localStorage.setItem(`${STORAGE_KEY}_${type}`, JSON.stringify(updated));
    setShowSaveDialog(false);
    setViewName('');
  };

  const loadView = (view: SavedView) => {
    onFiltersChange(view.filters);
  };

  const deleteView = (viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updated);
    localStorage.setItem(`${STORAGE_KEY}_${type}`, JSON.stringify(updated));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filter Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-popover border-border" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {type === 'deals' && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Stage</label>
                <Select
                  value={filters.stage || "all"}
                  onValueChange={(value) => handleFilterChange('stage', value === "all" ? "" : value)}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {PIPELINE_STAGES.map(stage => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Date Range</label>
              <Select
                value={filters.dateRange || "any"}
                onValueChange={(value) => handleFilterChange('dateRange', value === "any" ? "" : value)}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="quarter">This quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'deals' && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Value Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minValue}
                    onChange={(e) => handleFilterChange('minValue', e.target.value)}
                    className="bg-muted border-border"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxValue}
                    onChange={(e) => handleFilterChange('maxValue', e.target.value)}
                    className="bg-muted border-border"
                  />
                </div>
              </div>
            )}

            {type === 'leads' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Has Email</label>
                  <Select
                    value={filters.hasEmail || "any"}
                    onValueChange={(value) => handleFilterChange('hasEmail', value === "any" ? "" : value)}
                  >
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Has email</SelectItem>
                      <SelectItem value="no">No email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Has Phone</label>
                  <Select
                    value={filters.hasPhone || "any"}
                    onValueChange={(value) => handleFilterChange('hasPhone', value === "any" ? "" : value)}
                  >
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Has phone</SelectItem>
                      <SelectItem value="no">No phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee filter for leads - agency owners only */}
                {isAgencyOwner && teamMembers.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Assigned To</label>
                    <Select
                      value={filters.assignedTo || "any"}
                      onValueChange={(value) => handleFilterChange('assignedTo', value === "any" ? "" : value)}
                    >
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers.map(member => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.profile.full_name || member.profile.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowSaveDialog(true)}
              >
                <Save className="h-4 w-4" />
                Save as View
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Saved Views */}
      {savedViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Saved Views
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover border-border">
            {savedViews.map(view => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between gap-4"
                onClick={() => loadView(view)}
              >
                <span>{view.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteView(view.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active Filter Badges */}
      {filters.stage && (
        <Badge variant="secondary" className="gap-1">
          Stage: {PIPELINE_STAGES.find(s => s.value === filters.stage)?.label}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => handleFilterChange('stage', '')}
          />
        </Badge>
      )}
      {filters.dateRange && (
        <Badge variant="secondary" className="gap-1">
          {filters.dateRange === 'today' && 'Today'}
          {filters.dateRange === 'week' && 'This week'}
          {filters.dateRange === 'month' && 'This month'}
          {filters.dateRange === 'quarter' && 'This quarter'}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => handleFilterChange('dateRange', '')}
          />
        </Badge>
      )}
      {filters.assignedTo && (
        <Badge variant="secondary" className="gap-1">
          {filters.assignedTo === 'unassigned' 
            ? 'Unassigned' 
            : `Assigned: ${teamMembers.find(m => m.user_id === filters.assignedTo)?.profile.full_name || teamMembers.find(m => m.user_id === filters.assignedTo)?.profile.email || 'SDR'}`}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => handleFilterChange('assignedTo', '')}
          />
        </Badge>
      )}

      {/* Save View Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Give your filtered view a name to quickly access it later.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g., Hot Leads, This Week's Meetings"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            className="bg-muted border-border"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveView} disabled={!viewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
