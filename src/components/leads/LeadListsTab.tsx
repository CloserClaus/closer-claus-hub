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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  List, 
  Trash2, 
  Users, 
  MoreVertical, 
  Pencil, 
  Eye,
  ArrowLeft,
  Building2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type LeadList = Tables<'lead_lists'>;
type ApolloLead = Tables<'apollo_leads'>;

interface LeadListWithCount extends LeadList {
  lead_list_items: { count: number }[];
}

export function LeadListsTab() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingList, setEditingList] = useState<LeadList | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // Fetch all lists
  const { data: lists, isLoading: listsLoading } = useQuery({
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
      return data as LeadListWithCount[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch leads in selected list
  const { data: listLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['lead-list-items', selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const { data, error } = await supabase
        .from('lead_list_items')
        .select(`
          id,
          added_at,
          apollo_lead:apollo_leads(*)
        `)
        .eq('lead_list_id', selectedListId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedListId,
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

  const updateListMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const { error } = await supabase
        .from('lead_lists')
        .update({ name, description: description || null, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      setIsEditOpen(false);
      setEditingList(null);
      toast.success('Lead list updated');
    },
    onError: (error) => {
      toast.error('Failed to update list: ' + error.message);
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
      if (selectedListId) setSelectedListId(null);
      toast.success('Lead list deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete list: ' + error.message);
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('lead_list_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-list-items', selectedListId] });
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      toast.success('Lead removed from list');
    },
    onError: (error) => {
      toast.error('Failed to remove lead: ' + error.message);
    },
  });

  const handleEditList = (list: LeadList) => {
    setEditingList(list);
    setNewListName(list.name);
    setNewListDescription(list.description || '');
    setIsEditOpen(true);
  };

  const selectedList = lists?.find(l => l.id === selectedListId);

  // Show list detail view
  if (selectedListId && selectedList) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedListId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {selectedList.name}
            </CardTitle>
            {selectedList.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedList.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {listLeads?.length || 0} leads
          </Badge>
        </CardHeader>
        <CardContent>
          {leadsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !listLeads || listLeads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No leads in this list</p>
              <p className="text-sm">Search for leads and add them to this list</p>
            </div>
          ) : (
            <div className="space-y-3">
              {listLeads.map((item) => {
                const lead = item.apollo_lead as ApolloLead | null;
                if (!lead) return null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">
                            {lead.first_name} {lead.last_name}
                          </h4>
                          {lead.title && (
                            <p className="text-sm text-muted-foreground">{lead.title}</p>
                          )}
                        </div>
                        {lead.enrichment_status === 'enriched' && (
                          <Badge variant="default" className="gap-1 text-xs">
                            <Sparkles className="h-3 w-3" />
                            Enriched
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {lead.company_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {lead.company_name}
                          </span>
                        )}
                        {(lead.city || lead.country) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {[lead.city, lead.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Added {format(new Date(item.added_at!), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeFromListMutation.mutate(item.id)}
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

  // Show lists overview
  if (listsLoading) {
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
    <>
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
                const itemCount = list.lead_list_items?.[0]?.count || 0;
                return (
                  <div
                    key={list.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedListId(list.id)}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedListId(list.id); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Leads
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditList(list); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this list?')) {
                              deleteListMutation.mutate(list.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete List
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit List Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead List</DialogTitle>
            <DialogDescription>
              Update the list name and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">List Name</Label>
              <Input
                id="edit-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingList && updateListMutation.mutate({
                id: editingList.id,
                name: newListName,
                description: newListDescription,
              })}
              disabled={!newListName.trim() || updateListMutation.isPending}
            >
              {updateListMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
