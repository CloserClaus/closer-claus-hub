import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
import { format } from 'date-fns';
import { CallRecordingPlayer } from '@/components/dialer/CallRecordingPlayer';
import { formatCallDuration } from './callStatusUtils';

interface CallLog {
  id: string;
  phone_number: string;
  call_status: string;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  lead_id: string | null;
  twilio_call_sid?: string | null;
  recording_url?: string | null;
  disposition?: string | null;
  direction?: string;
  leads?: { first_name: string | null; last_name: string | null } | null;
}

interface CallHistoryPanelProps {
  callLogs: CallLog[];
}

export function CallHistoryPanel({ callLogs }: CallHistoryPanelProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Calls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[450px]">
          <div className="space-y-3">
            {callLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No call history yet</p>
            ) : (
              callLogs.map((log) => {
                const leadName = log.leads?.first_name || log.leads?.last_name
                  ? `${log.leads?.first_name || ''} ${log.leads?.last_name || ''}`.trim()
                  : null;
                return (
                  <div key={log.id} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        {leadName && <p className="font-medium text-sm">{leadName}</p>}
                        <p className="font-mono text-sm text-muted-foreground">{log.phone_number}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {(log as any).direction === 'inbound' ? (
                          <><PhoneIncoming className="h-3.5 w-3.5 text-primary" /><span>Incoming</span></>
                        ) : (
                          <><PhoneOutgoing className="h-3.5 w-3.5 text-success" /><span>Outgoing</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{format(new Date(log.created_at), 'MMM d, h:mm a')}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatCallDuration(log.duration_seconds) || '0:00'}</span>
                      </div>
                    </div>
                    {log.recording_url && (
                      <CallRecordingPlayer recordingUrl={log.recording_url} callId={log.id} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
