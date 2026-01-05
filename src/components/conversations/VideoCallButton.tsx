import { useState, useEffect } from 'react';
import { Video, VideoOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VideoCallButtonProps {
  conversationId: string;
  onStartCall: () => void;
  onJoinCall: (roomName: string) => void;
}

export function VideoCallButton({ conversationId, onStartCall, onJoinCall }: VideoCallButtonProps) {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<{ id: string; room_name: string; created_by: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkActiveRoom();
    
    // Subscribe to video_rooms changes
    const channel = supabase
      .channel(`video-rooms-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_rooms',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          checkActiveRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const checkActiveRoom = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('video_rooms')
      .select('id, room_name, created_by')
      .eq('conversation_id', conversationId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveRoom(data);
    } else {
      setActiveRoom(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  if (activeRoom) {
    const isCreator = activeRoom.created_by === user?.id;
    return (
      <Button
        variant={isCreator ? 'secondary' : 'default'}
        size="sm"
        onClick={() => onJoinCall(activeRoom.room_name)}
        className={isCreator ? '' : 'animate-pulse bg-green-600 hover:bg-green-700'}
      >
        <Video className="h-4 w-4 mr-2" />
        {isCreator ? 'Rejoin Call' : 'Join Call'}
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={onStartCall}>
      <Video className="h-5 w-5" />
    </Button>
  );
}
