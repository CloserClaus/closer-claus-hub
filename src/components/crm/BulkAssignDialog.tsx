import { useState, useMemo } from 'react';
import { UserPlus, Loader2, Info } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  readiness_segment?: string | null;
  assigned_to?: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  teamMembers: TeamMember[];
  workspaceId: string;
  onSuccess: () => void;
}

const TAG_OPTIONS = [
  { value: 'hot', label: 'Hot 🔥' },
  { value: 'warm', label: 'Warm ☀️' },
  { value: 'cool', label: 'Cool ❄️' },
  { value: 'cold', label: 'Cold 🧊' },
];

export function BulkAssignDialog({
  open,
  onOpenChange,
  leads,
  teamMembers,
  workspaceId,
  onSuccess,
}: BulkAssignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSDR, setSelectedSDR] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  // Check if any leads have tags
  const taggedLeads = useMemo(() => {
    return leads.filter(l => l.readiness_segment && TAG_OPTIONS.some(t => t.value === l.readiness_segment));
  }, [leads]);

  const hasTaggedLeads = taggedLeads.length > 0;

  // Get unassigned leads for assignment
  const unassignedLeads = useMemo(() => {
    return leads.filter(l => !l.assigned_to);
  }, [leads]);

  // Get leads matching the selected tag (or all if no tag selected)
  const eligibleLeads = useMemo(() => {
    if (!selectedTag) {
      return unassignedLeads;
    }
    return unassignedLeads.filter(l => l.readiness_segment === selectedTag);
  }, [unassignedLeads, selectedTag]);

  // Get tag distribution for equal distribution
  const tagDistribution = useMemo(() => {
    const distribution: Record<string, Lead[]> = {};
    TAG_OPTIONS.forEach(tag => {
      distribution[tag.value] = unassignedLeads.filter(l => l.readiness_segment === tag.value);
    });
    distribution['untagged'] = unassignedLeads.filter(l => !l.readiness_segment || !TAG_OPTIONS.some(t => t.value === l.readiness_segment));
    return distribution;
  }, [unassignedLeads]);

  const handleAssign = async () => {
    if (!selectedSDR) {
      toast({
        variant: 'destructive',
        title: 'Select an SDR',
        description: 'Please select a team member to assign leads to',
      });
      return;
    }

    const qty = parseInt(quantity) || eligibleLeads.length;
    if (qty <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid quantity',
        description: 'Please enter a valid number of leads to assign',
      });
      return;
    }

    setIsProcessing(true);

    try {
      let leadsToAssign: Lead[] = [];

      if (selectedTag) {
        // Assign from specific tag
        leadsToAssign = eligibleLeads.slice(0, qty);
      } else if (hasTaggedLeads && !selectedTag) {
        // Distribute equally across tags
        const perTag = Math.ceil(qty / Object.keys(tagDistribution).filter(k => tagDistribution[k].length > 0).length);
        let remaining = qty;
        
        for (const tag of Object.keys(tagDistribution)) {
          if (remaining <= 0) break;
          const available = tagDistribution[tag];
          const toTake = Math.min(perTag, remaining, available.length);
          leadsToAssign.push(...available.slice(0, toTake));
          remaining -= toTake;
        }
      } else {
        // No tags, just take first N
        leadsToAssign = unassignedLeads.slice(0, qty);
      }

      if (leadsToAssign.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No leads to assign',
          description: 'There are no matching leads available for assignment',
        });
        setIsProcessing(false);
        return;
      }

      const leadIds = leadsToAssign.map(l => l.id);

      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: selectedSDR })
        .in('id', leadIds);

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('send-lead-assignment-email', {
          body: {
            sdrId: selectedSDR,
            leadIds,
            workspaceId,
            assignedBy: user?.id,
          },
        });
      } catch (emailError) {
        console.error('Failed to send lead assignment email:', emailError);
      }

      toast({
        title: 'Leads assigned',
        description: `Successfully assigned ${leadsToAssign.length} leads`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assignment failed',
        description: error.message || 'Failed to assign leads',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedSDR('');
    setQuantity('');
    setSelectedTag('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Advanced Lead Assignment
          </DialogTitle>
          <DialogDescription>
            Assign leads to a team member with quantity and tag filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sdr">Assign to SDR *</Label>
            <Select value={selectedSDR} onValueChange={setSelectedSDR}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profile.full_name || member.profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Number of Leads</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={eligibleLeads.length}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Max: ${eligibleLeads.length}`}
              className="bg-muted border-border"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to assign all {eligibleLeads.length} eligible leads
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag">Filter by Tag</Label>
            <Select 
              value={selectedTag} 
              onValueChange={setSelectedTag}
              disabled={!hasTaggedLeads}
            >
              <SelectTrigger className={`bg-muted border-border ${!hasTaggedLeads ? 'opacity-50' : ''}`}>
                <SelectValue placeholder={hasTaggedLeads ? "All tags (distribute equally)" : "No tagged leads"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All tags (distribute equally)</SelectItem>
                {TAG_OPTIONS.map((tag) => {
                  const count = tagDistribution[tag.value]?.length || 0;
                  return (
                    <SelectItem key={tag.value} value={tag.value} disabled={count === 0}>
                      {tag.label} ({count} available)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {!hasTaggedLeads && (
              <p className="text-xs text-muted-foreground">
                No leads have been tagged yet. Tags will be available after leads are evaluated.
              </p>
            )}
          </div>

          {hasTaggedLeads && !selectedTag && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Equal distribution will assign leads evenly across all tag categories.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium mb-1">Available Leads</p>
            <p className="text-2xl font-bold text-primary">{eligibleLeads.length}</p>
            <p className="text-xs text-muted-foreground">
              {unassignedLeads.length} total unassigned
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isProcessing || !selectedSDR}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>Assign Leads</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
