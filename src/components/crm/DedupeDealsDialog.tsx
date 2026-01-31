import { useState, useMemo } from 'react';
import { Search, Loader2, Trash2, Check, AlertTriangle, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  lead_id: string | null;
  assigned_to: string;
  created_at: string;
}

interface DuplicatePair {
  deal1: Deal;
  deal2: Deal;
  matchScore: number;
  matchType: string;
}

interface DedupeDealsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: Deal[];
  workspaceId: string;
  onSuccess: () => void;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function DedupeDealsDialog({
  open,
  onOpenChange,
  deals,
  workspaceId,
  onSuccess,
}: DedupeDealsDialogProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [resolvedPairs, setResolvedPairs] = useState<Set<string>>(new Set());

  const findDuplicates = () => {
    setIsScanning(true);
    const pairs: DuplicatePair[] = [];
    const checkedPairs = new Set<string>();

    for (let i = 0; i < deals.length; i++) {
      for (let j = i + 1; j < deals.length; j++) {
        const deal1 = deals[i];
        const deal2 = deals[j];
        const pairKey = [deal1.id, deal2.id].sort().join('-');

        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        let matchScore = 0;
        let matchType = '';

        // Same lead_id (highest priority)
        if (deal1.lead_id && deal2.lead_id && deal1.lead_id === deal2.lead_id) {
          matchScore = 100;
          matchType = 'Same lead source';
        }
        // Exact title match
        else if (deal1.title.toLowerCase() === deal2.title.toLowerCase()) {
          matchScore = 95;
          matchType = 'Exact title match';
        }
        // Fuzzy title match
        else {
          const title1 = deal1.title.toLowerCase();
          const title2 = deal2.title.toLowerCase();
          const distance = levenshteinDistance(title1, title2);
          const maxLength = Math.max(title1.length, title2.length);
          const similarity = 1 - (distance / maxLength);
          
          if (similarity >= 0.8) {
            matchScore = Math.round(similarity * 100);
            matchType = 'Similar title';
          }
        }

        // Same value + similar stage
        if (matchScore < 70 && deal1.value === deal2.value && deal1.value > 0) {
          const sameStage = deal1.stage === deal2.stage;
          if (sameStage) {
            matchScore = 70;
            matchType = 'Same value & stage';
          }
        }

        if (matchScore >= 70) {
          pairs.push({ deal1, deal2, matchScore, matchType });
        }
      }
    }

    // Sort by match score (highest first)
    pairs.sort((a, b) => b.matchScore - a.matchScore);
    setDuplicates(pairs);
    setHasScanned(true);
    setIsScanning(false);
  };

  const handleKeepBoth = (pair: DuplicatePair) => {
    const pairKey = [pair.deal1.id, pair.deal2.id].sort().join('-');
    setResolvedPairs(prev => new Set(prev).add(pairKey));
  };

  const handleDeleteDeal = async (dealToDelete: Deal, pair: DuplicatePair) => {
    setProcessingIds(prev => new Set(prev).add(dealToDelete.id));

    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealToDelete.id);
      if (error) throw error;

      const pairKey = [pair.deal1.id, pair.deal2.id].sort().join('-');
      setResolvedPairs(prev => new Set(prev).add(pairKey));
      
      // Remove pairs involving the deleted deal
      setDuplicates(prev => prev.filter(p => 
        p.deal1.id !== dealToDelete.id && p.deal2.id !== dealToDelete.id
      ));

      toast({
        title: 'Deal deleted',
        description: `Removed "${dealToDelete.title}"`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(dealToDelete.id);
        return next;
      });
    }
  };

  const handleMergeDeals = async (keepDeal: Deal, deleteDeal: Deal, pair: DuplicatePair) => {
    setProcessingIds(prev => new Set(prev).add(deleteDeal.id));

    try {
      // Merge data - keep higher value, more recent notes
      const updates: Record<string, any> = {};
      if (deleteDeal.value > keepDeal.value) {
        updates.value = deleteDeal.value;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('deals')
          .update(updates)
          .eq('id', keepDeal.id);
        if (updateError) throw updateError;
      }

      // Delete the other deal
      const { error: deleteError } = await supabase.from('deals').delete().eq('id', deleteDeal.id);
      if (deleteError) throw deleteError;

      const pairKey = [pair.deal1.id, pair.deal2.id].sort().join('-');
      setResolvedPairs(prev => new Set(prev).add(pairKey));
      
      setDuplicates(prev => prev.filter(p => 
        p.deal1.id !== deleteDeal.id && p.deal2.id !== deleteDeal.id
      ));

      toast({
        title: 'Deals merged',
        description: `Merged data into "${keepDeal.title}"`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Merge failed',
        description: error.message,
      });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(deleteDeal.id);
        return next;
      });
    }
  };

  const unresolvedDuplicates = duplicates.filter(pair => {
    const pairKey = [pair.deal1.id, pair.deal2.id].sort().join('-');
    return !resolvedPairs.has(pairKey);
  });

  const handleClose = () => {
    onOpenChange(false);
    if (resolvedPairs.size > 0) {
      onSuccess();
    }
    // Reset state
    setDuplicates([]);
    setHasScanned(false);
    setResolvedPairs(new Set());
  };

  const formatValue = (value: number) => `$${value.toLocaleString()}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Deduplicate Deals
          </DialogTitle>
          <DialogDescription>
            Find and resolve potential duplicate deals in your CRM
          </DialogDescription>
        </DialogHeader>

        {!hasScanned ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Ready to scan {deals.length} deals</p>
              <p className="text-sm text-muted-foreground">
                We'll check for duplicates using title, value, stage, and lead source matching
              </p>
            </div>
            <Button onClick={findDuplicates} disabled={isScanning} className="mt-4">
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Find Duplicates
                </>
              )}
            </Button>
          </div>
        ) : unresolvedDuplicates.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-medium">No duplicates found!</p>
              <p className="text-sm text-muted-foreground">
                Your deal database looks clean
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Found {unresolvedDuplicates.length} potential duplicate pair(s)
              </p>
              
              <Accordion type="single" collapsible className="w-full">
                {unresolvedDuplicates.map((pair, index) => {
                  const pairKey = [pair.deal1.id, pair.deal2.id].sort().join('-');
                  const isProcessing = processingIds.has(pair.deal1.id) || processingIds.has(pair.deal2.id);

                  return (
                    <AccordionItem key={pairKey} value={pairKey}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <Badge 
                            variant={pair.matchScore >= 90 ? 'destructive' : pair.matchScore >= 80 ? 'default' : 'secondary'}
                          >
                            {pair.matchScore}%
                          </Badge>
                          <span className="font-medium truncate max-w-[200px]">
                            {pair.deal1.title}
                          </span>
                          <span className="text-muted-foreground">↔</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {pair.deal2.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({pair.matchType})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                          {/* Deal 1 */}
                          <div className="space-y-2">
                            <p className="font-medium">{pair.deal1.title}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>💰 {formatValue(pair.deal1.value)}</p>
                              <p>📊 {pair.deal1.stage.replace('_', ' ')}</p>
                              <p>📅 {new Date(pair.deal1.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => handleDeleteDeal(pair.deal1, pair)}
                                disabled={isProcessing}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="flex-1"
                                onClick={() => handleMergeDeals(pair.deal1, pair.deal2, pair)}
                                disabled={isProcessing}
                              >
                                <Merge className="h-3 w-3 mr-1" />
                                Keep & Merge
                              </Button>
                            </div>
                          </div>

                          {/* Deal 2 */}
                          <div className="space-y-2">
                            <p className="font-medium">{pair.deal2.title}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>💰 {formatValue(pair.deal2.value)}</p>
                              <p>📊 {pair.deal2.stage.replace('_', ' ')}</p>
                              <p>📅 {new Date(pair.deal2.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => handleDeleteDeal(pair.deal2, pair)}
                                disabled={isProcessing}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="flex-1"
                                onClick={() => handleMergeDeals(pair.deal2, pair.deal1, pair)}
                                disabled={isProcessing}
                              >
                                <Merge className="h-3 w-3 mr-1" />
                                Keep & Merge
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-center mt-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleKeepBoth(pair)}
                            disabled={isProcessing}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Keep Both (Not Duplicates)
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {resolvedPairs.size > 0 ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
