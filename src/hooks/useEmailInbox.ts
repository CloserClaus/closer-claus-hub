import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

export interface EmailInbox {
  id: string;
  provider_id: string;
  workspace_id: string;
  email_address: string;
  external_inbox_id: string | null;
  status: string;
  assigned_to: string | null;
  provider_type: string;
  provider_name: string | null;
  provider_status: string;
}

export interface EmailProvider {
  id: string;
  workspace_id: string;
  provider_type: string;
  provider_name: string | null;
  status: string;
  last_validated_at: string | null;
  created_at: string;
  inboxes: EmailInbox[];
}

export function useEmailInbox() {
  const { user } = useAuth();
  const { currentWorkspace, isOwner } = useWorkspace();
  const [assignedInbox, setAssignedInbox] = useState<EmailInbox | null>(null);
  const [allInboxes, setAllInboxes] = useState<EmailInbox[]>([]);
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    // Fetch providers
    const { data: providerData } = await supabase
      .from('email_providers')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    // Fetch inboxes
    const { data: inboxData } = await supabase
      .from('email_inboxes')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    const rawProviders = (providerData as any[]) || [];
    const rawInboxes = (inboxData as any[]) || [];

    // Merge provider info into inboxes
    const enrichedInboxes: EmailInbox[] = rawInboxes.map((inbox) => {
      const provider = rawProviders.find((p) => p.id === inbox.provider_id);
      return {
        ...inbox,
        provider_type: provider?.provider_type || 'other',
        provider_name: provider?.provider_name || provider?.provider_type || 'Unknown',
        provider_status: provider?.status || 'disconnected',
      };
    });

    // Build providers with nested inboxes
    const enrichedProviders: EmailProvider[] = rawProviders.map((p) => ({
      ...p,
      inboxes: enrichedInboxes.filter((i) => i.provider_id === p.id),
    }));

    setProviders(enrichedProviders);
    setAllInboxes(enrichedInboxes);

    // Find assigned inbox for current user
    const myInbox = enrichedInboxes.find(
      (i) => i.assigned_to === user.id && i.status === 'active' && i.provider_status === 'connected'
    );
    setAssignedInbox(myInbox || null);

    setLoading(false);
  }, [currentWorkspace, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const canSendEmail = !!assignedInbox;

  return {
    assignedInbox,
    allInboxes,
    providers,
    loading,
    canSendEmail,
    isOwner,
    refresh: fetchData,
  };
}
