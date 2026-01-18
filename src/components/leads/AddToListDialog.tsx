import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { List, Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type LeadList = Tables<'lead_lists'>;

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onSuccess?: () => void;
}

export function AddToListDialog({
  open,
  onOpenChange,
  selectedLeadIds,
  onSuccess,
}: AddToListDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lead-lists', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: open && !!currentWorkspace?.id,
  });

  const addToListsMutation = useMutation({
    mutationFn: async () => {
      if (selectedLists.length === 0 || selectedLeadIds.length === 0) {
        throw new Error('No lists or leads selected');
      }

      // Create items for each selected list and lead combination
      const items = selectedLists.flatMap(listId =>
        selectedLeadIds.map(leadId => ({
          lead_list_id: listId,
          apollo_lead_id: leadId,
        }))
      );

      // Use upsert to avoid duplicates
      const { error } = await supabase
        .from('lead_list_items')
        .upsert(items, { 
          onConflict: 'lead_list_id,apollo_lead_id',
          ignoreDuplicates: true 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lead-list-items'] });
      toast.success(`Added ${selectedLeadIds.length} leads to ${selectedLists.length} list(s)`);
      setSelectedLists([]);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Failed to add leads to lists: ' + error.message);
    },
  });

  const toggleList = (listId: string) => {
    setSelectedLists(prev =>
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  const filteredLists = lists?.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Add to Lists
          </DialogTitle>
          <DialogDescription>
            Add {selectedLeadIds.length} selected lead{selectedLeadIds.length !== 1 ? 's' : ''} to one or more lists
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lists */}
          <ScrollArea className="h-[250px] rounded-md border">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : !filteredLists || filteredLists.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {lists?.length === 0 ? 'No lists created yet' : 'No matching lists'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredLists.map((list) => (
                  <div
                    key={list.id}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                      selectedLists.includes(list.id)
                        ? 'bg-primary/10'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => toggleList(list.id)}
                  >
                    <Checkbox
                      checked={selectedLists.includes(list.id)}
                      onCheckedChange={() => toggleList(list.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{list.name}</p>
                      {list.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {list.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedLists.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Selected:</span>
              {selectedLists.map(listId => {
                const list = lists?.find(l => l.id === listId);
                return list ? (
                  <Badge key={listId} variant="secondary" className="text-xs">
                    {list.name}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => addToListsMutation.mutate()}
            disabled={selectedLists.length === 0 || addToListsMutation.isPending}
          >
            {addToListsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to {selectedLists.length || ''} List{selectedLists.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
