import { useState } from 'react';
import { UserPlus, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

interface LeadAssignmentDropdownProps {
  leadId: string;
  currentAssignee: string | null;
  teamMembers: TeamMember[];
  onAssignmentChange: () => void;
}

export function LeadAssignmentDropdown({
  leadId,
  currentAssignee,
  teamMembers,
  onAssignmentChange,
}: LeadAssignmentDropdownProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAssign = async (userId: string) => {
    if (userId === currentAssignee) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          assigned_to: userId === 'unassigned' ? null : userId 
        })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: 'Lead assigned',
        description: userId === 'unassigned' 
          ? 'Lead returned to agency pool' 
          : 'Lead assigned to team member',
      });
      
      onAssignmentChange();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign lead',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getAssigneeName = () => {
    if (!currentAssignee) return 'Unassigned';
    const member = teamMembers.find(m => m.user_id === currentAssignee);
    return member?.profile.full_name || member?.profile.email || 'Unknown';
  };

  return (
    <Select
      value={currentAssignee || 'unassigned'}
      onValueChange={handleAssign}
      disabled={isUpdating}
    >
      <SelectTrigger 
        className="w-40 h-8 text-xs bg-muted border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {isUpdating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue placeholder="Assign to...">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {getAssigneeName()}
            </span>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value="unassigned">
          <span className="flex items-center gap-2">
            <UserPlus className="h-3 w-3" />
            Unassigned (Agency)
          </span>
        </SelectItem>
        {teamMembers.map((member) => (
          <SelectItem key={member.user_id} value={member.user_id}>
            {member.profile.full_name || member.profile.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
