import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

export interface ImportProgress {
  current: number;
  total: number;
  status: 'idle' | 'importing' | 'complete' | 'error';
  message?: string;
}

export function useImportToCRM() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });

  const resetImportProgress = useCallback(() => {
    setImportProgress({
      current: 0,
      total: 0,
      status: 'idle',
    });
  }, []);

  const importMutation = useMutation({
    mutationFn: async (apolloLeadIds: string[]) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      if (!user?.id) throw new Error('Not authenticated');

      // Get the Apollo leads data
      const { data: apolloLeads, error: fetchError } = await supabase
        .from('apollo_leads')
        .select('*')
        .in('id', apolloLeadIds)
        .eq('workspace_id', currentWorkspace.id)
        .eq('enrichment_status', 'enriched');

      if (fetchError) throw fetchError;
      if (!apolloLeads || apolloLeads.length === 0) {
        throw new Error('No enriched leads found to import');
      }

      setImportProgress({
        current: 0,
        total: apolloLeads.length,
        status: 'importing',
      });

      const importedLeads: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < apolloLeads.length; i++) {
        const lead = apolloLeads[i];

        try {
          // Check if lead already exists in CRM
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('apollo_lead_id', lead.id)
            .eq('workspace_id', currentWorkspace.id)
            .maybeSingle();

          if (existingLead) {
            // Skip already imported leads
            setImportProgress(prev => ({
              ...prev,
              current: i + 1,
            }));
            continue;
          }

          // Import to CRM leads table
          const { data: crmLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              workspace_id: currentWorkspace.id,
              created_by: user.id,
              first_name: lead.first_name || 'Unknown',
              last_name: lead.last_name || 'Unknown',
              email: lead.email,
              phone: lead.phone,
              company: lead.company_name,
              title: lead.title,
              linkedin_url: lead.linkedin_url,
              company_domain: lead.company_domain,
              company_linkedin_url: lead.company_linkedin_url,
              industry: lead.industry,
              employee_count: lead.employee_count,
              seniority: lead.seniority,
              department: lead.department,
              city: lead.city,
              state: lead.state,
              country: lead.country,
              source: 'apollo',
              apollo_lead_id: lead.id,
              // Readiness fields from evaluation
              readiness_score: lead.readiness_score,
              readiness_segment: lead.readiness_verdict,
              readiness_notes: lead.readiness_signals?.join('; ') || null,
            })
            .select()
            .single();

          if (insertError) {
            errors.push(`Failed to import ${lead.first_name} ${lead.last_name}: ${insertError.message}`);
          } else {
            importedLeads.push(crmLead);
          }
        } catch (err) {
          errors.push(`Error importing ${lead.first_name} ${lead.last_name}`);
        }

        setImportProgress(prev => ({
          ...prev,
          current: i + 1,
        }));
      }

      return {
        imported_count: importedLeads.length,
        skipped_count: apolloLeads.length - importedLeads.length - errors.length,
        error_count: errors.length,
        imported_leads: importedLeads,
        errors,
      };
    },
    onSuccess: (data) => {
      setImportProgress({
        current: data.imported_count,
        total: data.imported_count,
        status: 'complete',
        message: `Successfully imported ${data.imported_count} lead${data.imported_count !== 1 ? 's' : ''} to CRM!${data.skipped_count > 0 ? ` (${data.skipped_count} already existed)` : ''}`,
      });

      toast.success(
        `Imported ${data.imported_count} leads to CRM${data.skipped_count > 0 ? ` (${data.skipped_count} skipped)` : ''}`
      );

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['apollo-leads'] });
    },
    onError: (error) => {
      setImportProgress(prev => ({
        ...prev,
        status: 'error',
        message: error.message,
      }));
      toast.error('Import failed: ' + error.message);
    },
  });

  const importLeads = async (apolloLeadIds: string[]) => {
    await importMutation.mutateAsync(apolloLeadIds);
  };

  return {
    importLeads,
    isImporting: importMutation.isPending,
    importProgress,
    resetImportProgress,
  };
}
