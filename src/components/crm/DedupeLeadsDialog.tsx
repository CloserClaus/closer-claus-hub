import { useState, useMemo } from 'react';
import { Search, Loader2, Trash2, Check, X, AlertTriangle, Merge } from 'lucide-react';
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

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  linkedin_url?: string | null;
  company_domain?: string | null;
}

interface DuplicatePair {
  lead1: Lead;
  lead2: Lead;
  matchScore: number;
  matchType: string;
}

interface DedupeLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
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

// Normalize LinkedIn URL
function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.replace(/\?.*$/, '');
  return normalized;
}

// Extract domain from email
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : null;
}

export function DedupeLeadsDialog({
  open,
  onOpenChange,
  leads,
  workspaceId,
  onSuccess,
}: DedupeLeadsDialogProps) {
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

    for (let i = 0; i < leads.length; i++) {
      for (let j = i + 1; j < leads.length; j++) {
        const lead1 = leads[i];
        const lead2 = leads[j];
        const pairKey = [lead1.id, lead2.id].sort().join('-');

        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        let matchScore = 0;
        let matchType = '';

        // Exact email match
        if (lead1.email && lead2.email && lead1.email.toLowerCase() === lead2.email.toLowerCase()) {
          matchScore = 100;
          matchType = 'Exact email match';
        }
        // Exact phone match
        else if (lead1.phone && lead2.phone) {
          const phone1 = lead1.phone.replace(/\D/g, '');
          const phone2 = lead2.phone.replace(/\D/g, '');
          if (phone1 === phone2 && phone1.length >= 7) {
            matchScore = 100;
            matchType = 'Exact phone match';
          }
        }

        // LinkedIn URL match
        if (matchScore < 90) {
          const linkedin1 = normalizeLinkedIn(lead1.linkedin_url);
          const linkedin2 = normalizeLinkedIn(lead2.linkedin_url);
          if (linkedin1 && linkedin2 && linkedin1 === linkedin2) {
            matchScore = 90;
            matchType = 'LinkedIn URL match';
          }
        }

        // Same first name + same domain
        if (matchScore < 70) {
          const domain1 = extractDomain(lead1.email) || lead1.company_domain?.toLowerCase();
          const domain2 = extractDomain(lead2.email) || lead2.company_domain?.toLowerCase();
          if (
            lead1.first_name.toLowerCase() === lead2.first_name.toLowerCase() &&
            domain1 && domain2 && domain1 === domain2
          ) {
            matchScore = 70;
            matchType = 'Same first name + domain';
          }
        }

        // Fuzzy name match + same company
        if (matchScore < 60) {
          const fullName1 = `${lead1.first_name} ${lead1.last_name}`.toLowerCase();
          const fullName2 = `${lead2.first_name} ${lead2.last_name}`.toLowerCase();
          const nameDistance = levenshteinDistance(fullName1, fullName2);
          
          if (nameDistance <= 3) {
            const company1 = lead1.company?.toLowerCase() || '';
            const company2 = lead2.company?.toLowerCase() || '';
            if (company1 && company2 && (company1 === company2 || levenshteinDistance(company1, company2) <= 2)) {
              matchScore = 60;
              matchType = 'Similar name + same company';
            }
          }
        }

        if (matchScore >= 60) {
          pairs.push({ lead1, lead2, matchScore, matchType });
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
    const pairKey = [pair.lead1.id, pair.lead2.id].sort().join('-');
    setResolvedPairs(prev => new Set(prev).add(pairKey));
  };

  const handleDeleteLead = async (leadToDelete: Lead, pair: DuplicatePair) => {
    setProcessingIds(prev => new Set(prev).add(leadToDelete.id));

    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadToDelete.id);
      if (error) throw error;

      const pairKey = [pair.lead1.id, pair.lead2.id].sort().join('-');
      setResolvedPairs(prev => new Set(prev).add(pairKey));
      
      // Remove pairs involving the deleted lead
      setDuplicates(prev => prev.filter(p => 
        p.lead1.id !== leadToDelete.id && p.lead2.id !== leadToDelete.id
      ));

      toast({
        title: 'Lead deleted',
        description: `Removed ${leadToDelete.first_name} ${leadToDelete.last_name}`,
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
        next.delete(leadToDelete.id);
        return next;
      });
    }
  };

  const handleMergeLeads = async (keepLead: Lead, deleteLead: Lead, pair: DuplicatePair) => {
    setProcessingIds(prev => new Set(prev).add(deleteLead.id));

    try {
      // Merge data - fill in any missing fields from the deleted lead
      const updates: Record<string, any> = {};
      if (!keepLead.email && deleteLead.email) updates.email = deleteLead.email;
      if (!keepLead.phone && deleteLead.phone) updates.phone = deleteLead.phone;
      if (!keepLead.company && deleteLead.company) updates.company = deleteLead.company;
      if (!keepLead.linkedin_url && deleteLead.linkedin_url) updates.linkedin_url = deleteLead.linkedin_url;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', keepLead.id);
        if (updateError) throw updateError;
      }

      // Delete the other lead
      const { error: deleteError } = await supabase.from('leads').delete().eq('id', deleteLead.id);
      if (deleteError) throw deleteError;

      const pairKey = [pair.lead1.id, pair.lead2.id].sort().join('-');
      setResolvedPairs(prev => new Set(prev).add(pairKey));
      
      setDuplicates(prev => prev.filter(p => 
        p.lead1.id !== deleteLead.id && p.lead2.id !== deleteLead.id
      ));

      toast({
        title: 'Leads merged',
        description: `Merged data into ${keepLead.first_name} ${keepLead.last_name}`,
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
        next.delete(deleteLead.id);
        return next;
      });
    }
  };

  const unresolvedDuplicates = duplicates.filter(pair => {
    const pairKey = [pair.lead1.id, pair.lead2.id].sort().join('-');
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Deduplicate Leads
          </DialogTitle>
          <DialogDescription>
            Find and resolve potential duplicate leads in your CRM
          </DialogDescription>
        </DialogHeader>

        {!hasScanned ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Ready to scan {leads.length} leads</p>
              <p className="text-sm text-muted-foreground">
                We'll check for duplicates using email, phone, LinkedIn, name and company matching
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
                Your lead database looks clean
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
                  const pairKey = [pair.lead1.id, pair.lead2.id].sort().join('-');
                  const isProcessing = processingIds.has(pair.lead1.id) || processingIds.has(pair.lead2.id);

                  return (
                    <AccordionItem key={pairKey} value={pairKey}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <Badge 
                            variant={pair.matchScore >= 90 ? 'destructive' : pair.matchScore >= 70 ? 'default' : 'secondary'}
                          >
                            {pair.matchScore}%
                          </Badge>
                          <span className="font-medium">
                            {pair.lead1.first_name} {pair.lead1.last_name}
                          </span>
                          <span className="text-muted-foreground">↔</span>
                          <span className="font-medium">
                            {pair.lead2.first_name} {pair.lead2.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({pair.matchType})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                          {/* Lead 1 */}
                          <div className="space-y-2">
                            <p className="font-medium">{pair.lead1.first_name} {pair.lead1.last_name}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {pair.lead1.email && <p>📧 {pair.lead1.email}</p>}
                              {pair.lead1.phone && <p>📞 {pair.lead1.phone}</p>}
                              {pair.lead1.company && <p>🏢 {pair.lead1.company}</p>}
                              {pair.lead1.linkedin_url && <p>🔗 LinkedIn</p>}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => handleDeleteLead(pair.lead1, pair)}
                                disabled={isProcessing}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="flex-1"
                                onClick={() => handleMergeLeads(pair.lead1, pair.lead2, pair)}
                                disabled={isProcessing}
                              >
                                <Merge className="h-3 w-3 mr-1" />
                                Keep & Merge
                              </Button>
                            </div>
                          </div>

                          {/* Lead 2 */}
                          <div className="space-y-2">
                            <p className="font-medium">{pair.lead2.first_name} {pair.lead2.last_name}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {pair.lead2.email && <p>📧 {pair.lead2.email}</p>}
                              {pair.lead2.phone && <p>📞 {pair.lead2.phone}</p>}
                              {pair.lead2.company && <p>🏢 {pair.lead2.company}</p>}
                              {pair.lead2.linkedin_url && <p>🔗 LinkedIn</p>}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => handleDeleteLead(pair.lead2, pair)}
                                disabled={isProcessing}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="flex-1"
                                onClick={() => handleMergeLeads(pair.lead2, pair.lead1, pair)}
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
