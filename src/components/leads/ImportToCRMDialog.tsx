import { useState } from 'react';
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
import { 
  UserPlus, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  FileInput,
} from 'lucide-react';

interface ImportToCRMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  enrichedCount: number;
  onImport: () => Promise<void>;
  isImporting: boolean;
  importProgress?: {
    current: number;
    total: number;
    status: 'idle' | 'importing' | 'complete' | 'error';
    message?: string;
  };
}

export function ImportToCRMDialog({
  open,
  onOpenChange,
  selectedCount,
  enrichedCount,
  onImport,
  isImporting,
  importProgress,
}: ImportToCRMDialogProps) {
  const [hasStarted, setHasStarted] = useState(false);
  
  const unenrichedCount = selectedCount - enrichedCount;
  const progressPercent = importProgress 
    ? Math.round((importProgress.current / importProgress.total) * 100) 
    : 0;

  const handleImport = async () => {
    setHasStarted(true);
    await onImport();
  };

  const getStatusIcon = () => {
    if (!hasStarted) return null;
    
    switch (importProgress?.status) {
      case 'importing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (!hasStarted) return null;
    
    switch (importProgress?.status) {
      case 'importing':
        return `Importing lead ${importProgress.current} of ${importProgress.total}...`;
      case 'complete':
        return importProgress.message || 'Import complete!';
      case 'error':
        return importProgress.message || 'Import failed';
      default:
        return 'Starting import...';
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setHasStarted(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileInput className="h-5 w-5 text-primary" />
            Import to CRM
          </DialogTitle>
          <DialogDescription>
            Add selected leads to your CRM pipeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selected Leads</span>
              <span className="font-medium">{selectedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Enriched (ready to import)</span>
              <span className="font-medium text-green-600">{enrichedCount}</span>
            </div>
            {unenrichedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Not enriched (skipped)</span>
                <span className="font-medium text-muted-foreground">{unenrichedCount}</span>
              </div>
            )}
          </div>

          {/* Warning for unenriched leads */}
          {unenrichedCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-400">Some leads not enriched</p>
                <p className="text-muted-foreground">
                  {unenrichedCount} lead{unenrichedCount !== 1 ? 's' : ''} will be skipped. Enrich them first to import with full contact details.
                </p>
              </div>
            </div>
          )}

          {/* No enriched leads warning */}
          {enrichedCount === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">No leads to import</p>
                <p className="text-muted-foreground">
                  Please enrich the selected leads first before importing to CRM.
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
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progressPercent}% complete
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {importProgress?.status === 'complete' ? (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || enrichedCount === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Import {enrichedCount} Lead{enrichedCount !== 1 ? 's' : ''}
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
