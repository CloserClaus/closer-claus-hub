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

  const startScreenShare = useCallback(async () => {
    if (!room || isScreenSharing) return;

    try {
      // Get screen share stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      const screenVideoTrack = stream.getVideoTracks()[0];
      
      // Create a Twilio LocalVideoTrack from the screen share
      const localScreenTrack = new LocalVideoTrack(screenVideoTrack, {
        name: 'screen-share',
      });

      // Unpublish the camera video track and publish screen share
      if (originalVideoTrackRef.current) {
        room.localParticipant.unpublishTrack(originalVideoTrackRef.current);
      }
      
      await room.localParticipant.publishTrack(localScreenTrack);
      
      setScreenTrack(localScreenTrack);
      setLocalVideoTrack(localScreenTrack);
      setIsScreenSharing(true);

      // Handle when user stops sharing via browser UI
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      console.log('Screen sharing started');
    } catch (err) {
      console.error('Error starting screen share:', err);
      // User cancelled or error occurred
    }
  }, [room, isScreenSharing]);

  const stopScreenShare = useCallback(async () => {
    if (!room || !screenTrack) return;

    try {
      // Unpublish and stop the screen share track
      room.localParticipant.unpublishTrack(screenTrack);
      screenTrack.stop();

      // Re-publish the camera video track
      if (originalVideoTrackRef.current) {
        await room.localParticipant.publishTrack(originalVideoTrackRef.current);
        setLocalVideoTrack(originalVideoTrackRef.current);
      } else {
        // Create a new camera track if the original was lost
        const newCameraTrack = await createLocalVideoTrack({ width: 640, height: 480 });
        await room.localParticipant.publishTrack(newCameraTrack);
        setLocalVideoTrack(newCameraTrack);
        originalVideoTrackRef.current = newCameraTrack;
      }

      setScreenTrack(null);
      setIsScreenSharing(false);
      console.log('Screen sharing stopped');
    } catch (err) {
      console.error('Error stopping screen share:', err);
    }
  }, [room, screenTrack]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
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
