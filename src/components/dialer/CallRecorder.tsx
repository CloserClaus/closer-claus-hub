import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square } from "lucide-react";
import { toast } from "sonner";

interface CallRecorderProps {
  callLogId: string;
  workspaceId: string;
  onRecordingComplete: (recordingUrl: string) => void;
}

export function CallRecorder({ callLogId, workspaceId, onRecordingComplete }: CallRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create the audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Upload to Supabase Storage
        const fileName = `${workspaceId}/${callLogId}_${Date.now()}.webm`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('call-recordings')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading recording:', uploadError);
          toast.error('Failed to save recording');
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('call-recordings')
          .getPublicUrl(fileName);

        const recordingUrl = urlData.publicUrl;

        // Update call log with recording URL
        const { error: updateError } = await supabase
          .from('call_logs')
          .update({ recording_url: recordingUrl })
          .eq('id', callLogId);

        if (updateError) {
          console.error('Error updating call log:', updateError);
          toast.error('Failed to link recording to call');
          return;
        }

        toast.success('Recording saved');
        onRecordingComplete(recordingUrl);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please grant permission.');
    }
  }, [callLogId, workspaceId, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-mono text-destructive">
              {formatDuration(recordingDuration)}
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop Recording
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={startRecording}
          className="gap-2"
        >
          <Mic className="h-4 w-4" />
          Record Call
        </Button>
      )}
    </div>
  );
}
