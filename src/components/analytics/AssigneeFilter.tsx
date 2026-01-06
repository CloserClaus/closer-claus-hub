import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  user_id: string;
  full_name: string | null;
}

interface AssigneeFilterProps {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
}

export function AssigneeFilter({ workspaceId, value, onChange }: AssigneeFilterProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .is('removed_at', null);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        setMembers(
          profiles?.map(p => ({
            user_id: p.id,
            full_name: p.full_name,
          })) || []
        );
      }
      setLoading(false);
    };

    if (workspaceId) {
      fetchMembers();
    }
  }, [workspaceId]);

  if (loading || members.length === 0) {
    return null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <Users className="h-4 w-4 mr-2" />
        <SelectValue placeholder="All Team Members" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Team Members</SelectItem>
        {members.map((member) => (
          <SelectItem key={member.user_id} value={member.user_id}>
            {member.full_name || 'Unknown'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
