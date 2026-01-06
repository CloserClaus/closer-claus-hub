import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, loading, setCurrentWorkspace } = useWorkspace();
  const { userRole } = useAuth();

  // Hide workspace switcher for agency owners - they only operate in their own workspace
  if (userRole === 'agency_owner') {
    return null;
  }

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
              {currentWorkspace?.name || 'Select workspace'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className={`cursor-pointer ${
              currentWorkspace?.id === workspace.id ? 'bg-sidebar-accent' : ''
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
        <DropdownMenuItem 
          className="cursor-pointer text-muted-foreground"
          onClick={() => navigate('/jobs')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Browse Jobs
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
