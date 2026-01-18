import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, List, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function LeadListsTab() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lead-lists', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('lead_lists')
        .select(`
          *,
          lead_list_items(count)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const createListMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Missing context');
      const { data, error } = await supabase
        .from('lead_lists')
        .insert({
          name: newListName,
          description: newListDescription || null,
          workspace_id: currentWorkspace.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      setIsCreateOpen(false);
      setNewListName('');
      setNewListDescription('');
      toast.success('Lead list created');
    },
    onError: (error) => {
      toast.error('Failed to create list: ' + error.message);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      // First delete all list items
      await supabase.from('lead_list_items').delete().eq('lead_list_id', listId);
      // Then delete the list
      const { error } = await supabase.from('lead_lists').delete().eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      toast.success('Lead list deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete list: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Lead Lists</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your leads into custom lists
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Lead List</DialogTitle>
              <DialogDescription>
                Create a new list to organize your leads
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">List Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Tech Startups Q1"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add a description..."
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createListMutation.mutate()}
                disabled={!newListName.trim() || createListMutation.isPending}
              >
                {createListMutation.isPending ? 'Creating...' : 'Create List'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!lists || lists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No lead lists yet</p>
            <p className="text-sm">Create a list to organize your leads</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => {
              const itemCount = (list.lead_list_items as any)?.[0]?.count || 0;
              return (
                <div
                  key={list.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <List className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{list.name}</h4>
                    {list.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {list.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(list.created_at!), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {itemCount} leads
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this list?')) {
                        deleteListMutation.mutate(list.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
