import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Phone,
  PhoneOff,
  PhoneCall,
  User,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  selected?: boolean;
}

interface PowerDialerProps {
  workspaceId: string;
  dialerAvailable: boolean | null;
  onCreditsUpdated: () => void;
}

type DialerStatus = 'idle' | 'dialing' | 'in_call' | 'paused' | 'completed';
type CallOutcome = 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'skipped';

interface DialedLead extends Lead {
  outcome?: CallOutcome;
  notes?: string;
  callDuration?: number;
}

export function PowerDialer({ workspaceId, dialerAvailable, onCreditsUpdated }: PowerDialerProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [dialerStatus, setDialerStatus] = useState<DialerStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [dialedLeads, setDialedLeads] = useState<DialedLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCallLogId, setCurrentCallLogId] = useState<string | null>(null);
  const [currentCallHippoId, setCurrentCallHippoId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch leads with phone numbers
  useEffect(() => {
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, company, email')
        .eq('workspace_id', workspaceId)
        .not('phone', 'is', null)
        .order('last_contacted_at', { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      setLeads((data || []).map(lead => ({ ...lead, selected: false })));
    };

    fetchLeads();
  }, [workspaceId]);

  // Call duration timer
  useEffect(() => {
    if (dialerStatus === 'in_call') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dialerStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleLeadSelection = (leadId: string) => {
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, selected: !lead.selected } : lead
    ));
  };

  const selectAllLeads = () => {
    setLeads(prev => prev.map(lead => ({ ...lead, selected: true })));
  };

  const deselectAllLeads = () => {
    setLeads(prev => prev.map(lead => ({ ...lead, selected: false })));
  };

  const startPowerDialer = () => {
    const selected = leads.filter(l => l.selected);
    if (selected.length === 0) {
      toast.error("Please select at least one lead to dial");
      return;
    }
    
    setSelectedLeads(selected);
    setCurrentIndex(0);
    setDialedLeads([]);
    setDialerStatus('dialing');
    dialNextLead(selected, 0);
  };

  const dialNextLead = useCallback(async (leadsList: Lead[], index: number) => {
    if (index >= leadsList.length) {
      setDialerStatus('completed');
      setCurrentLead(null);
      toast.success("Power dialer completed!");
      return;
    }

    const lead = leadsList[index];
    setCurrentLead(lead);
    setCurrentIndex(index);
    setCallDuration(0);
    setCallNotes("");

    // Auto-dial the lead
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to make calls");
        setDialerStatus('paused');
        return;
      }

      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'initiate_call',
            phoneNumber: lead.phone,
            workspaceId,
            leadId: lead.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to initiate call");
        handleCallOutcome('no_answer');
        return;
      }

      setCurrentCallLogId(data.log?.id || null);
      setCurrentCallHippoId(data.call?.call_id || data.call?.id || null);
      setDialerStatus('in_call');

      // Update lead's last contacted time
      await supabase
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead.id);

    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error("Failed to initiate call");
      handleCallOutcome('no_answer');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const handleCallOutcome = async (outcome: CallOutcome) => {
    if (!currentLead) return;

    // End the call if still active
    if (dialerStatus === 'in_call' && currentCallLogId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'end_call',
                callId: currentCallHippoId,
                callLogId: currentCallLogId,
                notes: callNotes,
              }),
            }
          );
        }
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }

    // Record the outcome
    setDialedLeads(prev => [...prev, {
      ...currentLead,
      outcome,
      notes: callNotes,
      callDuration,
    }]);

    // Move to next lead
    const nextIndex = currentIndex + 1;
    setCurrentCallLogId(null);
    setCurrentCallHippoId(null);
    
    if (nextIndex >= selectedLeads.length) {
      setDialerStatus('completed');
      setCurrentLead(null);
      toast.success("Power dialer completed!");
      onCreditsUpdated();
    } else {
      setDialerStatus('dialing');
      dialNextLead(selectedLeads, nextIndex);
    }
  };

  const skipCurrentLead = () => {
    handleCallOutcome('skipped');
  };

  const pauseDialer = async () => {
    // End current call if active
    if (dialerStatus === 'in_call' && currentCallLogId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'end_call',
                callId: currentCallHippoId,
                callLogId: currentCallLogId,
                notes: callNotes,
              }),
            }
          );
        }
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    setDialerStatus('paused');
  };

  const resumeDialer = () => {
    setDialerStatus('dialing');
    dialNextLead(selectedLeads, currentIndex);
  };

  const resetDialer = () => {
    setDialerStatus('idle');
    setCurrentIndex(0);
    setCurrentLead(null);
    setSelectedLeads([]);
    setDialedLeads([]);
    setCallDuration(0);
    setCallNotes("");
    setCurrentCallLogId(null);
    setCurrentCallHippoId(null);
  };

  const getOutcomeIcon = (outcome: CallOutcome) => {
    switch (outcome) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'no_answer':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'busy':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'voicemail':
        return <Phone className="h-4 w-4 text-muted-foreground" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const progress = selectedLeads.length > 0 
    ? ((dialedLeads.length) / selectedLeads.length) * 100 
    : 0;

  if (dialerAvailable === false) {
    return (
      <Card className="border-warning/50 bg-warning/5">
        <CardContent className="flex items-center gap-3 py-8 justify-center">
          <AlertCircle className="h-6 w-6 text-warning" />
          <div className="text-center">
            <p className="font-medium text-warning">Power Dialer Not Available</p>
            <p className="text-sm text-muted-foreground">
              CallHippo API key needs to be configured to use the power dialer.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Power Dialer</h2>
            <p className="text-sm text-muted-foreground">Automatically dial through your lead list</p>
          </div>
        </div>
        {dialerStatus !== 'idle' && (
          <Badge variant={dialerStatus === 'in_call' ? 'default' : 'secondary'} className="text-sm">
            {dialerStatus === 'dialing' && 'Dialing...'}
            {dialerStatus === 'in_call' && 'In Call'}
            {dialerStatus === 'paused' && 'Paused'}
            {dialerStatus === 'completed' && 'Completed'}
          </Badge>
        )}
      </div>

      {dialerStatus === 'idle' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Select Leads to Dial
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllLeads}>
                    Select All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={deselectAllLeads}>
                    Clear
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {leads.filter(l => l.selected).length} of {leads.length} leads selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {leads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No leads with phone numbers found
                    </p>
                  ) : (
                    leads.map((lead) => (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          lead.selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleLeadSelection(lead.id)}
                      >
                        <Checkbox 
                          checked={lead.selected} 
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {lead.first_name} {lead.last_name}
                          </p>
                          {lead.company && (
                            <p className="text-sm text-muted-foreground truncate">{lead.company}</p>
                          )}
                        </div>
                        <p className="text-sm font-mono text-muted-foreground">{lead.phone}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Start Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Ready to Dial
              </CardTitle>
              <CardDescription>
                Review your selection and start the power dialer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Leads selected</span>
                  <span className="font-semibold">{leads.filter(l => l.selected).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated time</span>
                  <span className="font-semibold">
                    ~{Math.ceil(leads.filter(l => l.selected).length * 2)} mins
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <p className="font-medium text-sm">How it works:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Calls are placed automatically one after another</li>
                  <li>• Mark each call outcome (connected, no answer, etc.)</li>
                  <li>• Add notes during or after each call</li>
                  <li>• Pause or skip leads at any time</li>
                </ul>
              </div>

              <Button 
                size="lg" 
                className="w-full"
                onClick={startPowerDialer}
                disabled={leads.filter(l => l.selected).length === 0}
              >
                <Play className="h-5 w-5 mr-2" />
                Start Power Dialer
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Call */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Current Call</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} of {selectedLeads.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {currentLead && dialerStatus !== 'completed' ? (
                <>
                  {/* Lead Info */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-full bg-primary/10">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">
                          {currentLead.first_name} {currentLead.last_name}
                        </p>
                        {currentLead.company && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>{currentLead.company}</span>
                          </div>
                        )}
                        <p className="font-mono text-primary mt-1">{currentLead.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Call Status */}
                  {dialerStatus === 'in_call' && (
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-success mb-2">
                        <PhoneCall className="h-6 w-6 animate-pulse" />
                        <span className="font-medium text-lg">Call in progress</span>
                      </div>
                      <p className="text-3xl font-mono">{formatDuration(callDuration)}</p>
                    </div>
                  )}

                  {dialerStatus === 'dialing' && (
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-primary mb-2">
                        <Phone className="h-6 w-6 animate-bounce" />
                        <span className="font-medium text-lg">Dialing...</span>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <Textarea
                    placeholder="Call notes..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    rows={3}
                  />

                  {/* Outcome Buttons */}
                  {dialerStatus === 'in_call' && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Mark outcome and move to next:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          className="border-success text-success hover:bg-success/10"
                          onClick={() => handleCallOutcome('connected')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Connected
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleCallOutcome('no_answer')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          No Answer
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleCallOutcome('busy')}
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Busy
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleCallOutcome('voicemail')}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Voicemail
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex gap-2">
                    {dialerStatus === 'paused' ? (
                      <Button className="flex-1" onClick={resumeDialer}>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1" onClick={pauseDialer}>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    <Button variant="outline" onClick={skipCurrentLead}>
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip
                    </Button>
                    <Button variant="destructive" onClick={resetDialer}>
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Session Complete!</h3>
                  <p className="text-muted-foreground mb-6">
                    You've dialed through {dialedLeads.length} leads
                  </p>
                  <Button onClick={resetDialer}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start New Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialed Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Call Log
              </CardTitle>
              <CardDescription>
                {dialedLeads.filter(l => l.outcome === 'connected').length} connected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {dialedLeads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Calls will appear here
                    </p>
                  ) : (
                    dialedLeads.map((lead, idx) => (
                      <div key={lead.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">
                            {lead.first_name} {lead.last_name}
                          </span>
                          {lead.outcome && getOutcomeIcon(lead.outcome)}
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span className="capitalize">{lead.outcome?.replace('_', ' ')}</span>
                          {lead.callDuration && lead.callDuration > 0 && (
                            <span>{formatDuration(lead.callDuration)}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
