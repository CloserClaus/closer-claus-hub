import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Coins,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { useLeadCredits } from '@/hooks/useLeadCredits';

interface EnrichmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  unenrichedCount: number;
  onEnrich: (addToCRM: boolean) => Promise<void>;
  isEnriching: boolean;
  enrichmentProgress?: {
    current: number;
    total: number;
    status: 'idle' | 'enriching' | 'complete' | 'partial' | 'error';
    message?: string;
    enrichedCount?: number;
    requestedCount?: number;
    creditsUsed?: number;
    remainingCredits?: number;
  };
}

export function EnrichmentDialog({
  open,
  onOpenChange,
  selectedCount,
  unenrichedCount,
  onEnrich,
  isEnriching,
  enrichmentProgress,
}: EnrichmentDialogProps) {
  const [addToCRM, setAddToCRM] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const { credits, hasEnoughCredits } = useLeadCredits();
  
  const creditsRequired = unenrichedCount * 5;
  const hasCredits = hasEnoughCredits(unenrichedCount);
  const progressPercent = enrichmentProgress 
    ? Math.round((enrichmentProgress.current / enrichmentProgress.total) * 100) 
    : 0;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasStarted(false);
      setAddToCRM(false);
    }
  }, [open]);

  const handleEnrich = async () => {
    setHasStarted(true);
    await onEnrich(addToCRM);
  };

  const getStatusIcon = () => {
    if (!hasStarted) return null;
    
    switch (enrichmentProgress?.status) {
      case 'enriching':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (!hasStarted) return null;
    
    switch (enrichmentProgress?.status) {
      case 'enriching':
        return `Enriching lead ${enrichmentProgress.current} of ${enrichmentProgress.total}...`;
      case 'complete':
        return enrichmentProgress.message || 'Enrichment complete!';
      case 'partial':
        return enrichmentProgress.message || 'Partial enrichment complete';
      case 'error':
        return enrichmentProgress.message || 'Enrichment failed';
      default:
        return 'Starting enrichment...';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enrich Leads
          </DialogTitle>
          <DialogDescription>
            Unlock contact details for {unenrichedCount} lead{unenrichedCount !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credit Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selected Leads</span>
              <span className="font-medium">{selectedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Already Enriched</span>
              <span className="font-medium text-muted-foreground">{selectedCount - unenrichedCount}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Leads to Enrich</span>
              <span className="font-bold">{unenrichedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                Credits Required
              </span>
              <span className={`font-bold ${!hasCredits ? 'text-destructive' : ''}`}>
                {creditsRequired}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your Balance</span>
              <span className={hasCredits ? 'text-green-600' : 'text-destructive'}>
                {credits} credits
              </span>
            </div>
          </div>

          {/* Insufficient Credits Warning */}
          {!hasCredits && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Insufficient Credits</p>
                <p className="text-muted-foreground">
                  You need {creditsRequired - credits} more credits to enrich these leads.
                </p>
              </div>
            </div>
          )}

          {/* Add to CRM Option */}
          {hasCredits && !hasStarted && (
            <div className="flex items-center space-x-3 rounded-lg border p-4">
              <Checkbox 
                id="add-to-crm" 
                checked={addToCRM} 
                onCheckedChange={(checked) => setAddToCRM(checked === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor="add-to-crm" className="flex items-center gap-2 cursor-pointer">
                  <UserPlus className="h-4 w-4" />
                  Add to CRM after enrichment
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically import enriched leads into your CRM pipeline
                </p>
              </div>
            </div>
          )}

          {/* Progress Section */}
          {hasStarted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm">{getStatusMessage()}</span>
              </div>
              <Progress 
                value={progressPercent} 
                className={`h-2 ${enrichmentProgress?.status === 'partial' ? '[&>div]:bg-amber-500' : ''}`} 
              />
              <p className="text-xs text-center text-muted-foreground">
                {progressPercent}% complete
              </p>
              
              {/* Partial Enrichment Details */}
              {enrichmentProgress?.status === 'partial' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Partial Enrichment
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {enrichmentProgress.enrichedCount} of {enrichmentProgress.requestedCount} leads returned with full contact data. 
                        Only {enrichmentProgress.creditsUsed} credits were deducted.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <Filter className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Want more results?
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Try broadening your search filters to find more leads with available contact data.
                      </p>
                    </div>
                  </div>
                  
                  {enrichmentProgress.remainingCredits !== undefined && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 pt-2 border-t border-amber-200 dark:border-amber-800">
                      Remaining balance: {enrichmentProgress.remainingCredits} credits
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {enrichmentProgress?.status === 'complete' || enrichmentProgress?.status === 'partial' ? (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isEnriching}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEnrich}
                disabled={!hasCredits || isEnriching || unenrichedCount === 0}
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enrich ({creditsRequired} credits)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
