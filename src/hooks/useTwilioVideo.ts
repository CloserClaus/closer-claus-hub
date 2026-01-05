import { useState, useCallback, useRef, useEffect } from 'react';
import { connect, Room, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack } from 'twilio-video';
import { supabase } from '@/integrations/supabase/client';

interface UseTwilioVideoProps {
  roomName: string;
  identity: string;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
}

export function useTwilioVideo({
  roomName,
  identity,
  onParticipantConnected,
  onParticipantDisconnected,
}: UseTwilioVideoProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const connectToRoom = useCallback(async () => {
    if (!roomName || !identity) {
      setError('Room name and identity are required');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get token from edge function
      const { data, error: tokenError } = await supabase.functions.invoke('video-token', {
        body: { room_name: roomName, identity },
      });

      if (tokenError || !data?.token) {
        throw new Error(tokenError?.message || 'Failed to get video token');
      }

      console.log('Connecting to Twilio Video room:', roomName);

      // Connect to the room
      const connectedRoom = await connect(data.token, {
        name: roomName,
        audio: true,
        video: { width: 640, height: 480 },
      });

      console.log('Connected to room:', connectedRoom.name);

      setRoom(connectedRoom);
      setIsConnected(true);

      // Get local tracks
      connectedRoom.localParticipant.videoTracks.forEach((publication) => {
        if (publication.track) {
          setLocalVideoTrack(publication.track as LocalVideoTrack);
        }
      });

      connectedRoom.localParticipant.audioTracks.forEach((publication) => {
        if (publication.track) {
          setLocalAudioTrack(publication.track as LocalAudioTrack);
        }
      });

      // Handle existing participants
      connectedRoom.participants.forEach((participant) => {
        setRemoteParticipants((prev) => [...prev, participant]);
        onParticipantConnected?.(participant);
      });

      // Handle new participants
      connectedRoom.on('participantConnected', (participant) => {
        console.log('Participant connected:', participant.identity);
        setRemoteParticipants((prev) => [...prev, participant]);
        onParticipantConnected?.(participant);
      });

      // Handle participant disconnect
      connectedRoom.on('participantDisconnected', (participant) => {
        console.log('Participant disconnected:', participant.identity);
        setRemoteParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
        onParticipantDisconnected?.(participant);
      });

      // Handle room disconnection
      connectedRoom.on('disconnected', (room, error) => {
        if (error) {
          console.error('Room disconnected with error:', error);
        }
        setIsConnected(false);
        setRoom(null);
        setRemoteParticipants([]);
      });

    } catch (err) {
      console.error('Error connecting to video room:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to video room');
    } finally {
      setIsConnecting(false);
    }
  }, [roomName, identity, onParticipantConnected, onParticipantDisconnected]);

  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setRemoteParticipants([]);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
    }
  }, [room]);

  const toggleMute = useCallback(() => {
    if (localAudioTrack) {
      if (isMuted) {
        localAudioTrack.enable();
      } else {
        localAudioTrack.disable();
      }
      setIsMuted(!isMuted);
    }
  }, [localAudioTrack, isMuted]);

  const toggleVideo = useCallback(() => {
    if (localVideoTrack) {
      if (isVideoOff) {
        localVideoTrack.enable();
      } else {
        localVideoTrack.disable();
      }
      setIsVideoOff(!isVideoOff);
    }
  }, [localVideoTrack, isVideoOff]);

  // Attach local video to element
  const attachLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    if (element && localVideoTrack) {
      localVideoTrack.attach(element);
    }
  }, [localVideoTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    isConnecting,
    isConnected,
    error,
    localVideoTrack,
    localAudioTrack,
    remoteParticipants,
    isMuted,
    isVideoOff,
    connectToRoom,
    disconnect,
    toggleMute,
    toggleVideo,
    attachLocalVideo,
  };
}
