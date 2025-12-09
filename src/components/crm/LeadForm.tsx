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
import { useToast } from '@/hooks/use-toast';

const leadSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(50),
  last_name: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  company: z.string().trim().max(100).optional().or(z.literal('')),
  title: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
}

interface LeadFormProps {
  lead: Lead | null;
  workspaceId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeadForm({ lead, workspaceId, onSuccess, onCancel }: LeadFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      first_name: lead?.first_name || '',
      last_name: lead?.last_name || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      company: lead?.company || '',
      title: lead?.title || '',
      notes: lead?.notes || '',
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const leadData = {
        workspace_id: workspaceId,
        created_by: user.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        title: data.title || null,
        notes: data.notes || null,
      };

      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', lead.id);

        if (error) throw error;
        toast({ title: 'Lead updated' });
      } else {
        const { error } = await supabase.from('leads').insert(leadData);

        if (error) throw error;
        toast({ title: 'Lead created' });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save lead',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
            {saving ? 'Saving...' : lead ? 'Update Lead' : 'Add Lead'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
