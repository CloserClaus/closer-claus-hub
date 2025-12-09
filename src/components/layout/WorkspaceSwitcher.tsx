import { useState, useEffect } from 'react';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Database } from '@/integrations/supabase/types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];

interface WorkspaceWithMembership extends Workspace {
  membership_id: string;
}

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      setLoading(true);
      
      // Fetch workspace memberships for the current user
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('id, workspace_id')
        .eq('user_id', user.id)
        .is('removed_at', null);

      if (membershipError) {
        console.error('Error fetching memberships:', membershipError);
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch workspace details
      const workspaceIds = memberships.map((m) => m.workspace_id);
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

      if (workspaceError) {
        console.error('Error fetching workspaces:', workspaceError);
        setLoading(false);
        return;
      }

      const workspacesWithMembership: WorkspaceWithMembership[] = (workspaceData || []).map((ws) => ({
        ...ws,
        membership_id: memberships.find((m) => m.workspace_id === ws.id)?.id || '',
      }));

      setWorkspaces(workspacesWithMembership);
      
      // Set the first workspace as active by default
      if (workspacesWithMembership.length > 0 && !activeWorkspace) {
        setActiveWorkspace(workspacesWithMembership[0]);
      }
      
      setLoading(false);
    };

    fetchWorkspaces();
  }, [user]);

  const handleSelectWorkspace = (workspace: WorkspaceWithMembership) => {
    setActiveWorkspace(workspace);
    // TODO: Dispatch workspace change event for other components to react
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>No workspaces</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 py-1.5 h-auto font-normal hover:bg-sidebar-accent"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="truncate text-sm">
              {activeWorkspace?.name || 'Select workspace'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSelectWorkspace(workspace)}
            className={`cursor-pointer ${
              activeWorkspace?.id === workspace.id ? 'bg-sidebar-accent' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="truncate">{workspace.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-muted-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Browse Jobs
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
