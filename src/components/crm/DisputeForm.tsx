import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const disputeSchema = z.object({
  reason: z.string().trim().min(10, 'Please provide a detailed reason (at least 10 characters)').max(1000, 'Reason must be less than 1000 characters'),
});

type DisputeFormData = z.infer<typeof disputeSchema>;

interface Deal {
  id: string;
  workspace_id: string;
  title: string;
  value: number;
}

interface DisputeFormProps {
  deal: Deal;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DisputeForm({ deal, onSuccess, onCancel }: DisputeFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<DisputeFormData>({
    resolver: zodResolver(disputeSchema),
    defaultValues: {
      reason: '',
    },
  });

  const onSubmit = async (data: DisputeFormData) => {
    if (!user) return;
    setSaving(true);

    try {
      // Create the dispute
      const { data: newDispute, error } = await supabase
        .from('disputes')
        .insert({
          deal_id: deal.id,
          workspace_id: deal.workspace_id,
          raised_by: user.id,
          reason: data.reason,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'dispute_created',
            dispute_id: newDispute.id,
            workspace_id: deal.workspace_id,
            deal_id: deal.id,
            raised_by: user.id,
            reason: data.reason,
          },
        });
      } catch (notifError) {
        console.error('Failed to send dispute notification:', notifError);
      }

      toast({
        title: 'Dispute filed',
        description: 'Your dispute has been submitted for review.',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to file dispute',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">Filing a Dispute</p>
              <p className="text-sm text-muted-foreground">
                You're filing a dispute for the deal "{deal.title}" (${Number(deal.value).toLocaleString()}). 
                Please provide a clear and detailed explanation of the issue.
              </p>
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Dispute *</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={5}
                  placeholder="Explain why you're disputing this deal. Include any relevant details about incorrect attribution, commission calculations, or other issues..."
                  className="bg-muted border-border"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} variant="destructive">
            {saving ? 'Filing...' : 'File Dispute'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
