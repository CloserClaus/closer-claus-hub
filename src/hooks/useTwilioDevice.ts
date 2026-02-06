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

// Token refresh intervals
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes (more aggressive refresh)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_TOKEN_AGE = 55 * 60 * 1000; // Force refresh if token is older than 55 minutes

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
  
  // Connection status for UI feedback
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const workspaceIdRef = useRef<string | null>(workspaceId);
  const lastTokenRefreshRef = useRef<number>(0);

  // Keep workspaceId ref in sync
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

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
    // Clear the proactive token refresh timer
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
    
    // Clear health check timer
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (deviceRef.current) {
      deviceRef.current.unregister();
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    cleanupCall();
    setConnectionStatus('disconnected');
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

  // Initialize the Twilio device
  const initializeDevice = useCallback(async () => {
    if (!workspaceId) {
      console.log('No workspace ID, skipping Twilio device initialization');
      return;
    }

    // Prevent multiple simultaneous initialization attempts
    if (isInitializingRef.current) {
      console.log('Device initialization already in progress');
      return;
    }

    isInitializingRef.current = true;
    setConnectionStatus('connecting');

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
        setConnectionStatus('connected');
        lastTokenRefreshRef.current = Date.now();
        
        // Start proactive token refresh timer after successful registration
        if (tokenRefreshIntervalRef.current) {
          clearInterval(tokenRefreshIntervalRef.current);
        }
        tokenRefreshIntervalRef.current = setInterval(async () => {
          if (deviceRef.current) {
            try {
              console.log('Proactively refreshing token...');
              setConnectionStatus('reconnecting');
              const { data: refreshData } = await supabase.functions.invoke('twilio', {
                body: { action: 'get_access_token', workspace_id: workspaceId },
              });
              if (refreshData?.token) {
                deviceRef.current.updateToken(refreshData.token);
                lastTokenRefreshRef.current = Date.now();
                setConnectionStatus('connected');
                console.log('Token proactively refreshed successfully');
              }
            } catch (err) {
              console.error('Proactive token refresh failed:', err);
              setConnectionStatus('connected'); // Keep showing connected, retry will happen
            }
          }
        }, TOKEN_REFRESH_INTERVAL);
        
        // Start health check interval
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
        healthCheckIntervalRef.current = setInterval(async () => {
          // Check if token is too old and force refresh
          const tokenAge = Date.now() - lastTokenRefreshRef.current;
          if (tokenAge > MAX_TOKEN_AGE && deviceRef.current && workspaceIdRef.current) {
            console.log('Token too old, forcing refresh...');
            try {
              setConnectionStatus('reconnecting');
              const { data: refreshData } = await supabase.functions.invoke('twilio', {
                body: { action: 'get_access_token', workspace_id: workspaceIdRef.current },
              });
              if (refreshData?.token) {
                deviceRef.current.updateToken(refreshData.token);
                lastTokenRefreshRef.current = Date.now();
                setConnectionStatus('connected');
                console.log('Token force-refreshed due to age');
              }
            } catch (err) {
              console.error('Health check token refresh failed:', err);
            }
          }
        }, HEALTH_CHECK_INTERVAL);
      });

      device.on('unregistered', () => {
        console.log('Twilio device unregistered');
        setState(prev => ({ ...prev, isReady: false }));
        setConnectionStatus('disconnected');
      });

      device.on('error', (twilioError) => {
        console.error('Twilio device error:', twilioError);
        
        // Check if this is a token expiration error (20104)
        if (twilioError.code === 20104) {
          console.log('Token expired (20104), re-initializing device...');
          setConnectionStatus('reconnecting');
          toast({
            title: 'Reconnecting Phone System',
            description: 'Your session expired. Reconnecting automatically...',
          });
          
          // Destroy current device and re-initialize
          isInitializingRef.current = false;
          destroyDevice();
          setTimeout(() => {
            initializeDevice();
          }, 1000); // Small delay before retry
          return;
        }
        
        setState(prev => ({ 
          ...prev, 
          error: twilioError.message,
          isConnecting: false,
        }));
        setConnectionStatus('disconnected');
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
        setConnectionStatus('reconnecting');
        try {
          const { data: refreshData } = await supabase.functions.invoke('twilio', {
            body: { action: 'get_access_token', workspace_id: workspaceId },
          });
          if (refreshData?.token) {
            device.updateToken(refreshData.token);
            lastTokenRefreshRef.current = Date.now();
            setConnectionStatus('connected');
            console.log('Token refreshed via tokenWillExpire event');
          }
        } catch (err) {
          console.error('Failed to refresh token:', err);
          setConnectionStatus('connected'); // Best effort, keep trying
        }
      });

      // Register the device
      await device.register();
      deviceRef.current = device;
      lastTokenRefreshRef.current = Date.now();
      setState(prev => ({ ...prev, device }));

    } catch (err) {
      console.error('Failed to initialize Twilio device:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize phone system';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isConnecting: false,
      }));
      setConnectionStatus('disconnected');
    } finally {
      isInitializingRef.current = false;
    }
  }, [workspaceId, toast, onCallStatusChange, destroyDevice]);

  // Make an outbound call — single-leg flow via device.connect()
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

      // Connect using the Twilio Device (browser WebRTC).
      // This triggers the TwiML App webhook which will:
      //   1. Create the call log in the database
      //   2. Return <Dial> TwiML to place exactly ONE outbound PSTN call
      // No separate REST API call is made — one click = one call.
      const callParams: Record<string, string> = {
        To: toNumber,
        From: fromNumber,
      };
      if (workspaceId) {
        callParams.WorkspaceId = workspaceId;
      }
      if (leadId) {
        callParams.LeadId = leadId;
      }

      const call = await deviceRef.current.connect({ params: callParams });
      callRef.current = call;

      let resolvedCallLogId: string | undefined;

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

      // After connect, log the call via edge function (non-blocking for audio).
      // The call SID from the SDK is the parent call SID.
      const callSid = (call as any).parameters?.CallSid;
      if (callSid && workspaceId) {
        supabase.functions.invoke('twilio', {
          body: {
            action: 'log_browser_call',
            call_sid: callSid,
            to_number: toNumber,
            from_number: fromNumber,
            workspace_id: workspaceId,
            lead_id: leadId,
          },
        }).then(({ data }) => {
          if (data?.call_log_id) {
            resolvedCallLogId = data.call_log_id;
          }
        }).catch(err => {
          console.error('Failed to log call:', err);
        });
      }

      return {
        callLogId: resolvedCallLogId,
        callSid: callSid,
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
  }, [state.isReady, workspaceId, toast, onCallStatusChange, onCallConnected, onCallDisconnected, cleanupCall]);

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
  }, [state.callStatus, cleanupCall]);

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

  // Handle page visibility changes - refresh token when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && deviceRef.current && workspaceIdRef.current) {
        console.log('Tab became visible, refreshing token...');
        try {
          const { data } = await supabase.functions.invoke('twilio', {
            body: { action: 'get_access_token', workspace_id: workspaceIdRef.current },
          });
          if (data?.token && deviceRef.current) {
            deviceRef.current.updateToken(data.token);
            console.log('Token refreshed on visibility change');
          }
        } catch (err) {
          console.error('Token refresh on visibility failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
    connectionStatus,
    
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
