import { useState } from 'react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  User,
  Building2,
  DollarSign,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  lead_id: string | null;
  deal_id: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
}

interface Deal {
  id: string;
  title: string;
}

interface TaskListProps {
  tasks: Task[];
  leads: Lead[];
  deals: Deal[];
  onEdit: (task: Task) => void;
  onRefresh: () => void;
  isAgencyOwner: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning',
  high: 'bg-destructive/20 text-destructive',
};

export function TaskList({
  tasks,
  leads,
  deals,
  onEdit,
  onRefresh,
  isAgencyOwner,
}: TaskListProps) {
  const { toast } = useToast();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const getLead = (leadId: string | null) =>
    leads.find((l) => l.id === leadId);

  const getDeal = (dealId: string | null) =>
    deals.find((d) => d.id === dealId);

  const getDueDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM d');
  };

  const getDueDateColor = (dateString: string, status: string) => {
    if (status === 'completed') return 'text-muted-foreground';
    const date = new Date(dateString);
    if (isPast(date) && !isToday(date)) return 'text-destructive';
    if (isToday(date)) return 'text-warning';
    return 'text-muted-foreground';
  };

  const toggleComplete = async (task: Task) => {
    setProcessingIds((prev) => new Set(prev).add(task.id));

    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: newStatus === 'completed' ? 'Task completed' : 'Task reopened',
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update task',
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);

      if (error) throw error;

      toast({ title: 'Task deleted' });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete task',
      });
    }
  };

  // Group tasks by status
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Sort pending by due date (overdue first)
  pendingTasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
        <p className="text-muted-foreground">
          Create your first task to start tracking follow-ups
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            To Do ({pendingTasks.length})
          </h3>
          <div className="space-y-2">
            {pendingTasks.map((task) => {
              const lead = getLead(task.lead_id);
              const deal = getDeal(task.deal_id);
              const isProcessing = processingIds.has(task.id);

              return (
                <Card
                  key={task.id}
                  className={cn(
                    'glass hover:glow-sm transition-all',
                    isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && 'border-destructive/50'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleComplete(task)}
                        disabled={isProcessing}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem onClick={() => onEdit(task)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {isAgencyOwner && (
                                <DropdownMenuItem
                                  onClick={() => deleteTask(task.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <div
                            className={cn(
                              'flex items-center gap-1 text-xs',
                              getDueDateColor(task.due_date, task.status)
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {getDueDateLabel(task.due_date)}
                            {' • '}
                            {format(new Date(task.due_date), 'h:mm a')}
                          </div>
                          <Badge className={cn('text-xs', PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </Badge>
                          {lead && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <User className="h-3 w-3" />
                              {lead.first_name} {lead.last_name}
                            </Badge>
                          )}
                          {deal && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <DollarSign className="h-3 w-3" />
                              {deal.title}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.slice(0, 5).map((task) => {
              const isProcessing = processingIds.has(task.id);

              return (
                <Card key={task.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => toggleComplete(task)}
                        disabled={isProcessing}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-muted-foreground line-through">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {format(new Date(task.due_date), 'MMM d')}
                        </p>
                      </div>
                      {isAgencyOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {completedTasks.length > 5 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{completedTasks.length - 5} more completed tasks
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
