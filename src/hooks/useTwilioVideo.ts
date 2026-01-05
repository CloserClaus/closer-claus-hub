import { useState, useCallback, useRef, useEffect } from 'react';
import { connect, Room, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, createLocalVideoTrack } from 'twilio-video';
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
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const originalVideoTrackRef = useRef<LocalVideoTrack | null>(null);

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
          originalVideoTrackRef.current = publication.track as LocalVideoTrack;
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
    // Stop screen share if active
    if (screenTrack) {
      screenTrack.stop();
      setScreenTrack(null);
      setIsScreenSharing(false);
    }
    
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setRemoteParticipants([]);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
    }
  }, [room, screenTrack]);

  const toggleMute = useCallback(() => {
    if (localAudioTrack) {
      const newMutedState = !isMuted;
      if (newMutedState) {
        localAudioTrack.disable();
      } else {
        localAudioTrack.enable();
      }
      setIsMuted(newMutedState);
    }
  }, [localAudioTrack, isMuted]);

  const toggleVideo = useCallback(async () => {
    if (!room) return;
    
    const newVideoOffState = !isVideoOff;
    
    if (newVideoOffState) {
      // Turn off camera
      if (originalVideoTrackRef.current) {
        originalVideoTrackRef.current.disable();
      }
    } else {
      // Turn on camera - need to re-enable the track
      if (originalVideoTrackRef.current) {
        originalVideoTrackRef.current.enable();
        setLocalVideoTrack(originalVideoTrackRef.current);
      }
    }
    setIsVideoOff(newVideoOffState);
  }, [room, isVideoOff]);

  const stopScreenShare = useCallback(async () => {
    if (!room) return;

    const currentScreenTrack = screenTrack;
    if (!currentScreenTrack) {
      setIsScreenSharing(false);
      return;
    }

    try {
      // Set state early to prevent re-entry
      setIsScreenSharing(false);
      setScreenTrack(null);

      room.localParticipant.unpublishTrack(currentScreenTrack);
      currentScreenTrack.stop();

      // Restore camera publish only if user wants camera on
      const cameraTrack = originalVideoTrackRef.current;

      if (!isVideoOff && cameraTrack) {
        cameraTrack.enable();
        await room.localParticipant.publishTrack(cameraTrack);
        setLocalVideoTrack(cameraTrack);
      } else if (!isVideoOff && !cameraTrack) {
        const newCameraTrack = await createLocalVideoTrack({ width: 640, height: 480 });
        await room.localParticipant.publishTrack(newCameraTrack);
        originalVideoTrackRef.current = newCameraTrack;
        setLocalVideoTrack(newCameraTrack);
      } else {
        // Keep local preview consistent (avatar will show when isVideoOff)
        setLocalVideoTrack(cameraTrack);
      }

      console.log('Screen sharing stopped');
    } catch (err) {
      console.error('Error stopping screen share:', err);
      setIsScreenSharing(false);
      setScreenTrack(null);
    }
  }, [room, screenTrack, isVideoOff]);

  const startScreenShare = useCallback(async () => {
    if (!room || isScreenSharing) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      const screenVideoTrack = stream.getVideoTracks()[0];

      const localScreenTrack = new LocalVideoTrack(screenVideoTrack, {
        name: 'screen-share',
      });

      // Replace camera publish with screen share publish
      if (originalVideoTrackRef.current) {
        room.localParticipant.unpublishTrack(originalVideoTrackRef.current);
      }

      await room.localParticipant.publishTrack(localScreenTrack);

      setScreenTrack(localScreenTrack);
      setLocalVideoTrack(localScreenTrack);
      setIsScreenSharing(true);

      // If user stops sharing via browser UI, mirror it in-app.
      screenVideoTrack.onended = () => {
        void stopScreenShare();
      };

      console.log('Screen sharing started');
    } catch (err) {
      console.error('Error starting screen share:', err);
    }
  }, [room, isScreenSharing, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      void stopScreenShare();
    } else {
      void startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

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
      if (screenTrack) {
        screenTrack.stop();
      }
      if (room) {
        room.disconnect();
      }
    };
  }, [room, screenTrack]);

  return {
    room,
    isConnecting,
    isConnected,
    error,
    localVideoTrack,
    localAudioTrack,
    screenTrack,
    remoteParticipants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    connectToRoom,
    disconnect,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    attachLocalVideo,
  };
}
