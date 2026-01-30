import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  assigned_to?: string | null;
}

interface BulkConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Lead[];
  workspaceId: string;
  onSuccess: () => void;
}

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
];

export function BulkConvertDialog({
  open,
  onOpenChange,
  selectedLeads,
  workspaceId,
  onSuccess,
}: BulkConvertDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [defaultValue, setDefaultValue] = useState('0');
  const [defaultStage, setDefaultStage] = useState<string>('new');

  const handleConvert = async () => {
    if (selectedLeads.length === 0) return;
    setIsProcessing(true);

    try {
      const deals = selectedLeads.map((lead) => ({
        workspace_id: workspaceId,
        lead_id: lead.id,
        assigned_to: lead.assigned_to || user?.id,
        title: `${lead.first_name} ${lead.last_name}${lead.company ? ` - ${lead.company}` : ''}`,
        value: parseFloat(defaultValue) || 0,
        stage: defaultStage as 'new' | 'contacted' | 'discovery' | 'meeting' | 'proposal',
      }));

      const { error } = await supabase.from('deals').insert(deals);

      if (error) throw error;

      toast({
        title: 'Leads converted',
        description: `Successfully converted ${selectedLeads.length} leads to deals`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Conversion failed',
        description: error.message || 'Failed to convert leads to deals',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Convert Leads to Deals
          </DialogTitle>
          <DialogDescription>
            Create deals for {selectedLeads.length} selected lead(s). Deals will be assigned to the same person as the lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="defaultValue">Default Deal Value ($)</Label>
            <Input
              id="defaultValue"
              type="number"
              min="0"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder="0"
              className="bg-muted border-border"
            />
            <p className="text-xs text-muted-foreground">
              You can update individual deal values later
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultStage">Initial Stage</Label>
            <Select value={defaultStage} onValueChange={setDefaultStage}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium mb-2">Preview</p>
            <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
              {selectedLeads.slice(0, 5).map((lead) => (
                <li key={lead.id}>
                  → {lead.first_name} {lead.last_name}{lead.company ? ` - ${lead.company}` : ''}
                </li>
              ))}
              {selectedLeads.length > 5 && (
                <li className="text-muted-foreground/70">
                  ... and {selectedLeads.length - 5} more
                </li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                Convert {selectedLeads.length} Lead{selectedLeads.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
