import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CallRecordingPlayer } from "./CallRecordingPlayer";
import { 
  Search, Mic, User, Building2, Phone, Clock, Calendar, Sparkles, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface CallRecordingsTabProps {
  workspaceId: string;
}

interface CallRecording {
  id: string;
  phone_number: string;
  call_status: string;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  recording_url: string;
  caller_id: string;
  lead_id: string | null;
  caller_name: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company: string | null;
  ai_summary: string | null;
}

export function CallRecordingsTab({ workspaceId }: CallRecordingsTabProps) {
  const { user, userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: recordings, isLoading } = useQuery({
    queryKey: ['call-recordings', workspaceId, user?.id, userRole],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          id, phone_number, call_status, duration_seconds, notes, created_at,
          recording_url, caller_id, lead_id, ai_summary,
          leads ( first_name, last_name, company )
        `)
        .eq('workspace_id', workspaceId)
        .not('recording_url', 'is', null)
        .order('created_at', { ascending: false });

      if (userRole === 'sdr' && user?.id) {
        query = query.eq('caller_id', user.id);
      }

      const { data: callLogs, error } = await query;
      if (error) throw error;

      const callerIds = [...new Set(callLogs?.map(log => log.caller_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', callerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return callLogs?.map(log => ({
        id: log.id,
        phone_number: log.phone_number,
        call_status: log.call_status,
        duration_seconds: log.duration_seconds,
        notes: log.notes,
        created_at: log.created_at,
        recording_url: log.recording_url!,
        caller_id: log.caller_id,
        lead_id: log.lead_id,
        caller_name: profileMap.get(log.caller_id) || 'Unknown',
        lead_first_name: (log.leads as any)?.first_name || null,
        lead_last_name: (log.leads as any)?.last_name || null,
        lead_company: (log.leads as any)?.company || null,
        ai_summary: (log as any).ai_summary || null,
      })) as CallRecording[];
    },
    enabled: !!workspaceId && !!user,
  });

  const handleSummarize = async (callLogId: string) => {
    setSummarizingId(callLogId);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-call', {
        body: { call_log_id: callLogId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("AI summary generated!");
      queryClient.invalidateQueries({ queryKey: ['call-recordings'] });
    } catch (err: any) {
      console.error('Summarize error:', err);
      toast.error(err.message || "Failed to generate summary");
    } finally {
      setSummarizingId(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'busy':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Busy</Badge>;
      case 'no-answer':
      case 'missed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">No Answer</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRecordings = recordings?.filter(recording => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      recording.phone_number.includes(query) ||
      recording.caller_name?.toLowerCase().includes(query) ||
      recording.lead_first_name?.toLowerCase().includes(query) ||
      recording.lead_last_name?.toLowerCase().includes(query) ||
      recording.lead_company?.toLowerCase().includes(query)
    );
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />Call Recordings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (<Skeleton key={i} className="h-32 w-full" />))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Call Recordings
            <Badge variant="secondary" className="ml-2">{filteredRecordings.length}</Badge>
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone, name, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        {userRole === 'sdr' && (
          <p className="text-sm text-muted-foreground mt-2">Showing your call recordings only.</p>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          {filteredRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Mic className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No Recordings Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery ? "No recordings match your search criteria." : "Call recordings will appear here after you make calls."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecordings.map((recording) => (
                <div key={recording.id} className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{format(new Date(recording.created_at), 'MMM d, yyyy')}</span>
                          <span className="text-muted-foreground">at {format(new Date(recording.created_at), 'h:mm a')}</span>
                        </div>
                        {getStatusBadge(recording.call_status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{recording.caller_name || 'Unknown SDR'}</span>
                        </div>
                        {(recording.lead_first_name || recording.lead_last_name) && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{recording.lead_first_name} {recording.lead_last_name}</span>
                              {recording.lead_company && (
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />{recording.lead_company}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span className="font-mono">{recording.phone_number}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(recording.duration_seconds)}</span>
                        </div>
                      </div>

                      {recording.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{recording.notes}</p>
                      )}

                      {/* AI Summary */}
                      {recording.ai_summary ? (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-primary mb-1">AI Summary</p>
                            <p className="text-sm text-foreground">{recording.ai_summary}</p>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSummarize(recording.id)}
                          disabled={summarizingId === recording.id}
                          className="gap-2"
                        >
                          {summarizingId === recording.id ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Summarizing...</>
                          ) : (
                            <><Sparkles className="h-3.5 w-3.5" />AI Summary</>
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="lg:w-80">
                      <CallRecordingPlayer recordingUrl={recording.recording_url} callId={recording.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
