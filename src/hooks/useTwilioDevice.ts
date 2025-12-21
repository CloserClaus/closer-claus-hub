import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseTwilioDeviceOptions {
  workspaceId: string | null;
  onCallStatusChange?: (status: string) => void;
  onCallConnected?: (call: Call) => void;
  onCallDisconnected?: () => void;
}

interface TwilioDeviceState {
  device: Device | null;
  activeCall: Call | null;
  isReady: boolean;
  isConnecting: boolean;
  callStatus: string;
  callDuration: number;
  error: string | null;
}

export function useTwilioDevice(options: UseTwilioDeviceOptions) {
  const { workspaceId, onCallStatusChange, onCallConnected, onCallDisconnected } = options;
  const { toast } = useToast();

  const [state, setState] = useState<TwilioDeviceState>({
    device: null,
    activeCall: null,
    isReady: false,
    isConnecting: false,
    callStatus: 'idle',
    callDuration: 0,
    error: null,
  });

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);

  // Initialize the Twilio device
  const initializeDevice = useCallback(async () => {
    if (!workspaceId) {
      console.log('No workspace ID, skipping Twilio device initialization');
      return;
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Get access token from our edge function
      const { data, error } = await supabase.functions.invoke('twilio', {
        body: { action: 'get_access_token', workspace_id: workspaceId },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get access token');
      }

      if (!data?.token) {
        throw new Error('No access token received');
      }

      // Create the Twilio Device
      const device = new Device(data.token, {
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        allowIncomingWhileBusy: false,
        logLevel: 1, // Set to 0 for production
      });

      // Device event handlers
      device.on('registered', () => {
        console.log('Twilio device registered');
        setState(prev => ({ ...prev, isReady: true, isConnecting: false }));
      });

      device.on('unregistered', () => {
        console.log('Twilio device unregistered');
        setState(prev => ({ ...prev, isReady: false }));
      });

      device.on('error', (twilioError) => {
        console.error('Twilio device error:', twilioError);
        setState(prev => ({ 
          ...prev, 
          error: twilioError.message,
          isConnecting: false,
        }));
        toast({
          variant: 'destructive',
          title: 'Phone System Error',
          description: twilioError.message,
        });
      });

      device.on('incoming', (call) => {
        console.log('Incoming call from:', call.parameters.From);
        // Handle incoming calls if needed
        callRef.current = call;
        setState(prev => ({ 
          ...prev, 
          activeCall: call, 
          callStatus: 'incoming',
        }));
        onCallStatusChange?.('incoming');
      });

      device.on('tokenWillExpire', async () => {
        console.log('Token will expire, refreshing...');
        try {
          const { data } = await supabase.functions.invoke('twilio', {
            body: { action: 'get_access_token', workspace_id: workspaceId },
          });
          if (data?.token) {
            device.updateToken(data.token);
          }
        } catch (err) {
          console.error('Failed to refresh token:', err);
        }
      });

      // Register the device
      await device.register();
      deviceRef.current = device;
      setState(prev => ({ ...prev, device }));

    } catch (err) {
      console.error('Failed to initialize Twilio device:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize phone system';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isConnecting: false,
      }));
    }
  }, [workspaceId, toast, onCallStatusChange]);

  // Make an outbound call
  const makeCall = useCallback(async (
    toNumber: string, 
    fromNumber: string,
    leadId?: string
  ): Promise<{ callLogId?: string; callSid?: string } | null> => {
    if (!deviceRef.current || !state.isReady) {
      toast({
        variant: 'destructive',
        title: 'Phone Not Ready',
        description: 'Please wait for the phone system to initialize.',
      });
      return null;
    }

    if (callRef.current) {
      toast({
        variant: 'destructive',
        title: 'Call in Progress',
        description: 'Please end the current call before starting a new one.',
      });
      return null;
    }

    try {
      setState(prev => ({ ...prev, callStatus: 'connecting' }));
      onCallStatusChange?.('connecting');

      // First, initiate the call through our edge function to log it
      const { data: initiateData, error: initiateError } = await supabase.functions.invoke('twilio', {
        body: {
          action: 'initiate_call',
          to_number: toNumber,
          from_number: fromNumber,
          workspace_id: workspaceId,
          lead_id: leadId,
          record: true, // Enable server-side recording
        },
      });

      if (initiateError || !initiateData?.success) {
        throw new Error(initiateData?.error || initiateError?.message || 'Failed to initiate call');
      }

      // Connect using the Twilio Device (for browser audio)
      const callParams = {
        To: toNumber,
        From: fromNumber,
      };

      const call = await deviceRef.current.connect({ params: callParams });
      callRef.current = call;

      // Set up call event handlers
      call.on('accept', () => {
        console.log('Call accepted');
        callStartTimeRef.current = Date.now();
        setState(prev => ({ 
          ...prev, 
          activeCall: call, 
          callStatus: 'in_progress',
          callDuration: 0,
        }));
        onCallStatusChange?.('in_progress');
        onCallConnected?.(call);

        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
            setState(prev => ({ ...prev, callDuration: duration }));
          }
        }, 1000);
      });

      call.on('ringing', () => {
        console.log('Call ringing');
        setState(prev => ({ ...prev, callStatus: 'ringing' }));
        onCallStatusChange?.('ringing');
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        cleanupCall();
        onCallDisconnected?.();
      });

      call.on('cancel', () => {
        console.log('Call canceled');
        cleanupCall();
      });

      call.on('error', (error) => {
        console.error('Call error:', error);
        toast({
          variant: 'destructive',
          title: 'Call Error',
          description: error.message,
        });
        cleanupCall();
      });

      return {
        callLogId: initiateData.call_log_id,
        callSid: initiateData.call_sid,
      };

    } catch (err) {
      console.error('Failed to make call:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      toast({
        variant: 'destructive',
        title: 'Call Failed',
        description: errorMessage,
      });
      setState(prev => ({ ...prev, callStatus: 'idle' }));
      onCallStatusChange?.('idle');
      return null;
    }
  }, [state.isReady, workspaceId, toast, onCallStatusChange, onCallConnected, onCallDisconnected]);

  // End the current call
  const endCall = useCallback(async (notes?: string) => {
    if (!callRef.current) {
      return;
    }

    try {
      // Disconnect the browser call
      callRef.current.disconnect();

      // Update the call log with notes if provided
      if (notes) {
        // The cleanup will happen in the disconnect event handler
      }
    } catch (err) {
      console.error('Error ending call:', err);
    }
  }, []);

  // Answer an incoming call
  const answerCall = useCallback(() => {
    if (callRef.current && state.callStatus === 'incoming') {
      callRef.current.accept();
    }
  }, [state.callStatus]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    if (callRef.current && state.callStatus === 'incoming') {
      callRef.current.reject();
      cleanupCall();
    }
  }, [state.callStatus]);

  // Mute/unmute the call
  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const isMuted = callRef.current.isMuted();
      callRef.current.mute(!isMuted);
      return !isMuted;
    }
    return false;
  }, []);

  // Send DTMF tones
  const sendDigits = useCallback((digits: string) => {
    if (callRef.current) {
      callRef.current.sendDigits(digits);
    }
  }, []);

  // Cleanup call state
  const cleanupCall = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
    callRef.current = null;
    setState(prev => ({ 
      ...prev, 
      activeCall: null, 
      callStatus: 'idle',
      callDuration: 0,
    }));
    onCallStatusChange?.('idle');
  }, [onCallStatusChange]);

  // Destroy the device
  const destroyDevice = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.unregister();
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    cleanupCall();
    setState({
      device: null,
      activeCall: null,
      isReady: false,
      isConnecting: false,
      callStatus: 'idle',
      callDuration: 0,
      error: null,
    });
  }, [cleanupCall]);

  // Initialize on mount, cleanup on unmount
  useEffect(() => {
    if (workspaceId) {
      initializeDevice();
    }

    return () => {
      destroyDevice();
    };
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Format duration helper
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // State
    isReady: state.isReady,
    isConnecting: state.isConnecting,
    callStatus: state.callStatus,
    callDuration: state.callDuration,
    formattedDuration: formatDuration(state.callDuration),
    activeCall: state.activeCall,
    error: state.error,
    
    // Actions
    initializeDevice,
    makeCall,
    endCall,
    answerCall,
    rejectCall,
    toggleMute,
    sendDigits,
    destroyDevice,
  };
}
