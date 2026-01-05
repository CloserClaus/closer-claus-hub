import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const PIPELINE_STAGES = [
  { value: 'new' as const, label: 'New' },
  { value: 'contacted' as const, label: 'Contacted' },
  { value: 'discovery' as const, label: 'Discovery' },
  { value: 'meeting' as const, label: 'Meeting' },
  { value: 'proposal' as const, label: 'Proposal' },
  { value: 'closed_won' as const, label: 'Closed Won' },
  { value: 'closed_lost' as const, label: 'Closed Lost' },
];

type PipelineStage = 'new' | 'contacted' | 'discovery' | 'meeting' | 'proposal' | 'closed_won' | 'closed_lost';

const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  value: z.coerce.number().min(0, 'Value must be positive'),
  stage: z.string(),
  lead_id: z.string().optional().or(z.literal('')),
  expected_close_date: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

type DealFormData = z.infer<typeof dealSchema>;

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  lead_id: string | null;
  expected_close_date: string | null;
  notes: string | null;
}

interface DealFormProps {
  deal: Deal | null;
  workspaceId: string;
  leads: Lead[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function DealForm({ deal, workspaceId, leads, onSuccess, onCancel }: DealFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: deal?.title || '',
      value: deal?.value || 0,
      stage: deal?.stage || 'new',
      lead_id: deal?.lead_id || '',
      expected_close_date: deal?.expected_close_date || '',
      notes: deal?.notes || '',
    },
  });

  const onSubmit = async (data: DealFormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const dealData = {
        workspace_id: workspaceId,
        assigned_to: user.id,
        title: data.title,
        value: data.value,
        stage: data.stage as PipelineStage,
        lead_id: data.lead_id || null,
        expected_close_date: data.expected_close_date || null,
        notes: data.notes || null,
        closed_at: ['closed_won', 'closed_lost'].includes(data.stage) ? new Date().toISOString() : null,
      };

      if (deal) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', deal.id);

        if (error) throw error;

        // Log activity
        await supabase.from('deal_activities').insert({
          deal_id: deal.id,
          user_id: user.id,
          activity_type: 'update',
          description: `Deal updated`,
        });

        // Create commission if changed to closed_won
        if (data.stage === 'closed_won' && deal.stage !== 'closed_won') {
          try {
            await supabase.functions.invoke('create-commission', {
              body: { dealId: deal.id, workspaceId },
            });
          } catch (commErr) {
            console.error('Failed to create commission:', commErr);
          }
        }

        toast({ title: 'Deal updated' });
      } else {
        const { data: newDeal, error } = await supabase
          .from('deals')
          .insert(dealData)
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await supabase.from('deal_activities').insert({
          deal_id: newDeal.id,
          user_id: user.id,
          activity_type: 'create',
          description: `Deal created with value $${data.value.toLocaleString()}`,
        });

        // Create commission if created as closed_won
        if (data.stage === 'closed_won') {
          try {
            await supabase.functions.invoke('create-commission', {
              body: { dealId: newDeal.id, workspaceId },
            });
          } catch (commErr) {
            console.error('Failed to create commission:', commErr);
          }
        }

        toast({ title: 'Deal created' });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save deal',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deal Title *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Enterprise SaaS Implementation" {...field} className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Value ($)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PIPELINE_STAGES.map(stage => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="lead_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Associated Lead</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} defaultValue={field.value || "none"}>
                <FormControl>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select a lead (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {leads.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.first_name} {lead.last_name}
                      {lead.company && ` (${lead.company})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expected_close_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected Close Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
