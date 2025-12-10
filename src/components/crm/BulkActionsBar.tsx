import { Trash2, X, UserPlus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

interface BulkActionsBarProps {
  selectedCount: number;
  type: 'leads' | 'deals';
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkStageChange?: (stage: string) => void;
  isAgencyOwner: boolean;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  type,
  onClearSelection,
  onBulkDelete,
  onBulkStageChange,
  isAgencyOwner,
  isProcessing,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-lg',
        'bg-card border border-border shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-200'
      )}
    >
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {type === 'deals' && onBulkStageChange && (
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={onBulkStageChange} disabled={isProcessing}>
            <SelectTrigger className="w-40 h-8 bg-muted border-border">
              <SelectValue placeholder="Change stage" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map(stage => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isAgencyOwner && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onBulkDelete}
          disabled={isProcessing}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete {selectedCount}
        </Button>
      )}
    </div>
  );
}
