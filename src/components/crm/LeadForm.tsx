import { useState, useEffect } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

const leadSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(50),
  last_name: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  company: z.string().trim().max(100).optional().or(z.literal('')),
  title: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  // Apollo enrichment fields
  linkedin_url: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  company_domain: z.string().trim().max(255).optional().or(z.literal('')),
  company_linkedin_url: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).optional().or(z.literal('')),
  industry: z.string().trim().max(100).optional().or(z.literal('')),
  department: z.string().trim().max(100).optional().or(z.literal('')),
  seniority: z.string().trim().max(100).optional().or(z.literal('')),
  employee_count: z.string().trim().max(50).optional().or(z.literal('')),
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
  linkedin_url?: string | null;
  company_domain?: string | null;
  company_linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  industry?: string | null;
  department?: string | null;
  seniority?: string | null;
  employee_count?: string | null;
}

interface LeadFormProps {
  lead: Lead | null;
  workspaceId: string;
  defaultAssignee?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeadForm({ lead, workspaceId, defaultAssignee, onSuccess, onCancel }: LeadFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      linkedin_url: lead?.linkedin_url || '',
      company_domain: lead?.company_domain || '',
      company_linkedin_url: lead?.company_linkedin_url || '',
      city: lead?.city || '',
      state: lead?.state || '',
      country: lead?.country || '',
      industry: lead?.industry || '',
      department: lead?.department || '',
      seniority: lead?.seniority || '',
      employee_count: lead?.employee_count || '',
    },
  });

  // Reset form when lead prop changes (for editing)
  useEffect(() => {
    form.reset({
      first_name: lead?.first_name || '',
      last_name: lead?.last_name || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      company: lead?.company || '',
      title: lead?.title || '',
      notes: lead?.notes || '',
      linkedin_url: lead?.linkedin_url || '',
      company_domain: lead?.company_domain || '',
      company_linkedin_url: lead?.company_linkedin_url || '',
      city: lead?.city || '',
      state: lead?.state || '',
      country: lead?.country || '',
      industry: lead?.industry || '',
      department: lead?.department || '',
      seniority: lead?.seniority || '',
      employee_count: lead?.employee_count || '',
    });
    
    // Auto-expand advanced fields if any are populated
    if (lead && (lead.linkedin_url || lead.company_domain || lead.city || lead.state || 
        lead.country || lead.industry || lead.department || lead.seniority || lead.employee_count)) {
      setShowAdvanced(true);
    }
  }, [lead, form]);

  const checkForDuplicates = async (email: string | null, phone: string | null): Promise<{ isDuplicate: boolean; matchedField?: string; existingLead?: { first_name: string; last_name: string; company: string | null } }> => {
    if (!email && !phone) return { isDuplicate: false };

    // Build OR conditions for email and phone matches
    let query = supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone, company')
      .eq('workspace_id', workspaceId);

    if (lead) {
      // Exclude the current lead when editing
      query = query.neq('id', lead.id);
    }

    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (phone) conditions.push(`phone.eq.${phone}`);

    if (conditions.length === 1) {
      if (email) query = query.eq('email', email);
      else if (phone) query = query.eq('phone', phone);
    } else {
      query = query.or(`email.eq.${email},phone.eq.${phone}`);
    }

    const { data: existingLeads } = await query.limit(1);

    if (existingLeads && existingLeads.length > 0) {
      const existing = existingLeads[0];
      const matchedField = existing.email === email ? 'email' : 'phone';
      return { 
        isDuplicate: true, 
        matchedField, 
        existingLead: { first_name: existing.first_name, last_name: existing.last_name, company: existing.company } 
      };
    }

    return { isDuplicate: false };
  };

  const onSubmit = async (data: LeadFormData) => {
    if (!user) return;
    setSaving(true);

    try {
      // Check for duplicates before creating/updating
      const duplicateCheck = await checkForDuplicates(
        data.email || null,
        data.phone || null
      );

      if (duplicateCheck.isDuplicate && duplicateCheck.existingLead) {
        const existingName = `${duplicateCheck.existingLead.first_name} ${duplicateCheck.existingLead.last_name}`;
        toast({
          variant: 'destructive',
          title: 'Duplicate Lead Found',
          description: `A lead with this ${duplicateCheck.matchedField} already exists: ${existingName}${duplicateCheck.existingLead.company ? ` (${duplicateCheck.existingLead.company})` : ''}`,
        });
        setSaving(false);
        return;
      }

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
        linkedin_url: data.linkedin_url || null,
        company_domain: data.company_domain || null,
        company_linkedin_url: data.company_linkedin_url || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        industry: data.industry || null,
        department: data.department || null,
        seniority: data.seniority || null,
        employee_count: data.employee_count || null,
        // Auto-assign to creator if defaultAssignee provided (for SDRs)
        ...(defaultAssignee && !lead ? { assigned_to: defaultAssignee } : {}),
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
          name="linkedin_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn URL</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://linkedin.com/in/..." className="bg-muted border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span>Additional Details</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Domain</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="example.com" className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Technology, Finance..." className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Sales, Marketing..." className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seniority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seniority</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="C-Level, VP, Manager..." className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="employee_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Size</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="1-10, 11-50, 51-200..." className="bg-muted border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
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
              name="company_linkedin_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company LinkedIn URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://linkedin.com/company/..." className="bg-muted border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

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
