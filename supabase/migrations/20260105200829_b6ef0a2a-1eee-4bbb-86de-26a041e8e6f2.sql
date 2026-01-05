-- Create video_rooms table to track active video call sessions
CREATE TABLE public.video_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view video rooms for conversations they're part of
CREATE POLICY "Users can view video rooms for their conversations"
ON public.video_rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = video_rooms.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.left_at IS NULL
  )
);

-- Policy: Users can create video rooms for conversations they're part of
CREATE POLICY "Users can create video rooms for their conversations"
ON public.video_rooms
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = video_rooms.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.left_at IS NULL
  )
);

-- Policy: Users can update video rooms they created or are part of
CREATE POLICY "Users can update video rooms for their conversations"
ON public.video_rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = video_rooms.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.left_at IS NULL
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_video_rooms_updated_at
BEFORE UPDATE ON public.video_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for video_rooms so participants are notified of calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_rooms;

-- Create index for faster lookups
CREATE INDEX idx_video_rooms_conversation_id ON public.video_rooms(conversation_id);
CREATE INDEX idx_video_rooms_room_name ON public.video_rooms(room_name);