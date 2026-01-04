import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SubscriptionTier = Database['public']['Enums']['subscription_tier'];

const WORKSPACE_STORAGE_KEY = 'selected_workspace_id';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  subscription_tier: SubscriptionTier | null;
  subscription_status: string | null;
  max_sdrs: number | null;
  rake_percentage: number | null;
  is_locked: boolean | null;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  isOwner: boolean;
  hasActiveSubscription: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  // Persist workspace selection to localStorage
  const setCurrentWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
    } catch (e) {
      console.warn('Failed to persist workspace to localStorage:', e);
    }
  }, []);

  // Get saved workspace ID from localStorage
  const getSavedWorkspaceId = useCallback((): string | null => {
    try {
      return localStorage.getItem(WORKSPACE_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }, []);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const savedWorkspaceId = getSavedWorkspaceId();

    try {
      if (userRole === 'agency_owner') {
        // Agency owners see workspaces they own
        const { data } = await supabase
          .from('workspaces')
          .select('id, name, owner_id, subscription_tier, subscription_status, max_sdrs, rake_percentage, is_locked')
          .eq('owner_id', user.id);

        const ws = (data || []) as Workspace[];
        setWorkspaces(ws);
        
        if (ws.length > 0) {
          // Try to restore saved workspace, otherwise use first
          const savedWorkspace = savedWorkspaceId ? ws.find(w => w.id === savedWorkspaceId) : null;
          const workspaceToSet = savedWorkspace || ws[0];
          
          if (!currentWorkspace || currentWorkspace.id !== workspaceToSet.id) {
            setCurrentWorkspaceState(workspaceToSet);
          } else {
            // Update current workspace with fresh data
            const updated = ws.find(w => w.id === currentWorkspace.id);
            if (updated) setCurrentWorkspaceState(updated);
          }
        }
      } else if (userRole === 'sdr') {
        // SDRs see workspaces they're members of
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .is('removed_at', null);

        if (memberships && memberships.length > 0) {
          const workspaceIds = memberships.map(m => m.workspace_id);
          const { data } = await supabase
            .from('workspaces')
            .select('id, name, owner_id, subscription_tier, subscription_status, max_sdrs, rake_percentage, is_locked')
            .in('id', workspaceIds);

          const ws = (data || []) as Workspace[];
          setWorkspaces(ws);
          
          if (ws.length > 0 && !currentWorkspace) {
            // Try to restore saved workspace, otherwise use first
            const savedWorkspace = savedWorkspaceId ? ws.find(w => w.id === savedWorkspaceId) : null;
            setCurrentWorkspaceState(savedWorkspace || ws[0]);
          }
        } else {
          setWorkspaces([]);
          setCurrentWorkspaceState(null);
        }
      } else {
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user, userRole]);

  const isOwner = currentWorkspace?.owner_id === user?.id;
  const hasActiveSubscription = currentWorkspace?.subscription_status === 'active';

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        loading,
        isOwner,
        hasActiveSubscription,
        setCurrentWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
