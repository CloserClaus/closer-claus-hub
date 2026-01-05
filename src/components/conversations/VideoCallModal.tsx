import { useEffect, useRef, useState } from 'react';
import { RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack } from 'twilio-video';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, Monitor, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTwilioVideo } from '@/hooks/useTwilioVideo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  roomName: string;
  participantNames: { id: string; name: string }[];
}

export function VideoCallModal({
  isOpen,
  onClose,
  conversationId,
  roomName,
  participantNames,
}: VideoCallModalProps) {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteVideoAttached, setRemoteVideoAttached] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);

  const {
    isConnecting,
    isConnected,
    error,
    localVideoTrack,
    remoteParticipants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    connectToRoom,
    disconnect,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useTwilioVideo({
    roomName,
    identity: user?.id || '',
    onParticipantConnected: (participant) => {
      console.log('Participant joined:', participant.identity);
      attachRemoteParticipant(participant);
    },
    onParticipantDisconnected: (participant) => {
      console.log('Participant left:', participant.identity);
      setRemoteVideoAttached(false);
      setRemoteIsScreenSharing(false);
    },
  });

  useEffect(() => {
    if (isOpen && roomName && user?.id) {
      connectToRoom();
    }

    return () => {
      if (!isOpen) {
        disconnect();
      }
    };
  }, [isOpen, roomName, user?.id]);

  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.attach(localVideoRef.current);
    }

    return () => {
      if (localVideoTrack && localVideoRef.current) {
        localVideoTrack.detach(localVideoRef.current);
      }
    };
  }, [localVideoTrack]);

  useEffect(() => {
    // Attach any existing remote participants
    remoteParticipants.forEach((participant) => {
      attachRemoteParticipant(participant);
    });
  }, [remoteParticipants]);

  const attachRemoteParticipant = (participant: RemoteParticipant) => {
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed && publication.track) {
        attachTrack(publication.track, publication.trackName);
      }
    });

    participant.on('trackSubscribed', (track, publication) => {
      attachTrack(track, publication.trackName);
    });

    participant.on('trackUnsubscribed', (track, publication) => {
      detachTrack(track, publication.trackName);
    });
  };

  const attachTrack = (track: RemoteTrack, trackName?: string) => {
    if (track.kind === 'video' && remoteVideoRef.current) {
      (track as RemoteVideoTrack).attach(remoteVideoRef.current);
      setRemoteVideoAttached(true);
      // Check if this is a screen share track
      if (trackName === 'screen-share') {
        setRemoteIsScreenSharing(true);
      }
    } else if (track.kind === 'audio') {
      const audioElement = (track as RemoteAudioTrack).attach();
      document.body.appendChild(audioElement);
    }
  };

  const detachTrack = (track: RemoteTrack, trackName?: string) => {
    if (track.kind === 'video') {
      (track as RemoteVideoTrack).detach().forEach((el) => el.remove());
      setRemoteVideoAttached(false);
      if (trackName === 'screen-share') {
        setRemoteIsScreenSharing(false);
      }
    } else if (track.kind === 'audio') {
      (track as RemoteAudioTrack).detach().forEach((el) => el.remove());
    }
  };

  const handleEndCall = async () => {
    disconnect();

    // Mark the room as ended
    await supabase
      .from('video_rooms')
      .update({ ended_at: new Date().toISOString() })
      .eq('room_name', roomName);

    onClose();
  };

  const getParticipantName = (participantId: string) => {
    const participant = participantNames.find((p) => p.id === participantId);
    return participant?.name || 'Participant';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Video Call</h2>
          {isScreenSharing && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
              Sharing Screen
            </span>
          )}
          {remoteIsScreenSharing && (
            <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-1 rounded-full">
              Viewing Screen Share
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={handleEndCall}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <p>Connecting to video call...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={connectToRoom}>Retry</Button>
            </div>
          </div>
        )}

        {isConnected && (
          <>
            {/* Remote Video (Large) */}
            <div className="absolute inset-0 flex items-center justify-center">
              {remoteVideoAttached ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full ${remoteIsScreenSharing ? 'object-contain' : 'object-cover'}`}
                />
              ) : remoteParticipants.length > 0 ? (
                <div className="text-center text-white">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarFallback className="text-2xl">
                      {getParticipantName(remoteParticipants[0].identity).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p>{getParticipantName(remoteParticipants[0].identity)}</p>
                  <p className="text-sm text-muted-foreground">Camera off</p>
                </div>
              ) : (
                <div className="text-center text-white">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Waiting for others to join...</p>
                </div>
              )}
            </div>

            {/* Local Video (Small, Picture-in-Picture) */}
            <div className="absolute bottom-24 right-4 w-48 h-36 bg-muted rounded-lg overflow-hidden border-2 border-border shadow-lg">
              {isVideoOff && !isScreenSharing ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover transform scale-x-[-1]'}`}
                />
              )}
              {isScreenSharing && (
                <div className="absolute top-1 left-1 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                  Screen
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleMute}
            disabled={!isConnected}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleVideo}
            disabled={!isConnected || isScreenSharing}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          <Button
            variant={isScreenSharing ? 'default' : 'secondary'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleScreenShare}
            disabled={!isConnected}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={handleEndCall}
            title="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
