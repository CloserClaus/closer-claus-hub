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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { EvaluationProgress } from '@/hooks/useLeadReadinessEvaluation';

interface EvaluateReadinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadCount: number;
  creditCost: number;
  availableCredits: number;
  onConfirm: () => void;
  isEvaluating: boolean;
  progress: EvaluationProgress;
}

export function EvaluateReadinessDialog({
  open,
  onOpenChange,
  leadCount,
  creditCost,
  availableCredits,
  onConfirm,
  isEvaluating,
  progress,
}: EvaluateReadinessDialogProps) {
  const canAfford = availableCredits >= creditCost;
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const handleConfirm = () => {
    if (canAfford) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Evaluate Lead Readiness
          </DialogTitle>
          <DialogDescription>
            Use AI to analyze buying readiness for your leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {progress.status === 'idle' && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium">{leadCount} lead{leadCount !== 1 ? 's' : ''}</div>
                  <div className="text-sm text-muted-foreground">
                    Cost: {creditCost} credits
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Your balance</div>
                  <div className={`font-medium ${canAfford ? 'text-foreground' : 'text-destructive'}`}>
                    {availableCredits} credits
                  </div>
                </div>
              </div>

              {!canAfford && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Not enough credits. You need {creditCost - availableCredits} more credits.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p>
                  The AI will analyze each lead's company, website, and LinkedIn presence
                  to determine their buying readiness. Results are scored from 0-100 and
                  categorized as HOT, WARM, COOL, or COLD.
                </p>
              </div>
            </>
          )}

          {progress.status === 'evaluating' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Evaluating leads...</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="text-sm text-muted-foreground text-center">
                {progress.current} of {progress.total} leads evaluated
              </div>
            </div>
          )}

          {progress.status === 'complete' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-700">Evaluation Complete</div>
                <div className="text-sm text-green-600">{progress.message}</div>
              </div>
            </div>
          )}

          {progress.status === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{progress.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {progress.status === 'complete' || progress.status === 'error' ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEvaluating}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!canAfford || isEvaluating}>
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Evaluate ({creditCost} credits)
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
