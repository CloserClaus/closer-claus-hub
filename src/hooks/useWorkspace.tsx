import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  isOwner: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (userRole === 'agency_owner') {
        // Agency owners see workspaces they own
        const { data } = await supabase
          .from('workspaces')
          .select('id, name, owner_id')
          .eq('owner_id', user.id);

        const ws = data || [];
        setWorkspaces(ws);
        if (ws.length > 0 && !currentWorkspace) {
          setCurrentWorkspace(ws[0]);
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
            .select('id, name, owner_id')
            .in('id', workspaceIds);

          const ws = data || [];
          setWorkspaces(ws);
          if (ws.length > 0 && !currentWorkspace) {
            setCurrentWorkspace(ws[0]);
          }
        } else {
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }
      } else {
        setWorkspaces([]);
        setCurrentWorkspace(null);
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

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        loading,
        isOwner,
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
