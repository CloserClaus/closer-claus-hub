import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Phone, 
  PhoneOff, 
  Clock, 
  User, 
  Building2, 
  Search,
  PhoneCall,
  AlertCircle,
  ShoppingCart,
  Zap,
  Lock,
  Mic
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreditsDisplay } from "@/components/dialer/CreditsDisplay";
import { PurchaseTab } from "@/components/dialer/PurchaseTab";
import { PowerDialer } from "@/components/dialer/PowerDialer";
import { CallRecorder } from "@/components/dialer/CallRecorder";
import { CallRecordingPlayer } from "@/components/dialer/CallRecordingPlayer";
import { CallScriptManager } from "@/components/dialer/CallScriptManager";
import { CallScriptDisplay } from "@/components/dialer/CallScriptDisplay";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  title: string | null;
}

interface CallLog {
  id: string;
  phone_number: string;
  call_status: string;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  lead_id: string | null;
  callhippo_call_id?: string | null;
  recording_url?: string | null;
  leads?: Lead;
}

export default function Dialer() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCallLog, setCurrentCallLog] = useState<CallLog | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dialerAvailable, setDialerAvailable] = useState<boolean | null>(null);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Fetch credits balance
  const fetchCredits = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoadingCredits(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_credits', workspaceId: currentWorkspace.id }),
        }
      );

      const data = await response.json();
      setCreditsBalance(data.credits?.credits_balance || 0);
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [currentWorkspace?.id]);

  // Check if dialer is configured
  useEffect(() => {
    const checkDialerStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'get_call_status', callId: 'test' }),
          }
        );

        const data = await response.json();
        // Check the configured flag in the response
        setDialerAvailable(data.configured === true);
      } catch {
        setDialerAvailable(false);
      }
    };

    checkDialerStatus();
  }, []);

  // Fetch leads for quick dial
  useEffect(() => {
    const fetchLeads = async () => {
      if (!currentWorkspace?.id) return;

      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, company, email, title')
        .eq('workspace_id', currentWorkspace.id)
        .not('phone', 'is', null)
        .order('last_contacted_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      setLeads(data || []);
    };

    fetchLeads();
  }, [currentWorkspace?.id]);

  // Fetch call logs
  useEffect(() => {
    const fetchCallLogs = async () => {
      if (!currentWorkspace?.id) return;

      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id,
          phone_number,
          call_status,
          duration_seconds,
          notes,
          created_at,
          lead_id,
          recording_url
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching call logs:', error);
        return;
      }

      setCallLogs(data || []);
    };

    fetchCallLogs();
  }, [currentWorkspace?.id, isCallActive]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInitiateCall = async () => {
    if (!phoneNumber || !currentWorkspace?.id) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to make calls");
        return;
      }

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
            phoneNumber,
            workspaceId: currentWorkspace.id,
            leadId: selectedLead?.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          toast.error("Dialer not configured. Please add CallHippo API key.");
        } else {
          toast.error(data.error || "Failed to initiate call");
        }
        return;
      }

      setIsCallActive(true);
      setCurrentCallLog(data.log);
      setCallDuration(0);
      toast.success("Call initiated successfully");

      // Update lead's last contacted time
      if (selectedLead) {
        await supabase
          .from('leads')
          .update({ last_contacted_at: new Date().toISOString() })
          .eq('id', selectedLead.id);
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error("Failed to initiate call");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCall = async () => {
    if (!currentCallLog) {
      setIsCallActive(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'end_call',
            callId: currentCallLog.callhippo_call_id,
            callLogId: currentCallLog.id,
            notes: callNotes,
          }),
        }
      );

      if (response.ok) {
        toast.success("Call ended");
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsCallActive(false);
      setCurrentCallLog(null);
      setCallNotes("");
      setCallDuration(0);
      setIsLoading(false);
    }
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setPhoneNumber(lead.phone || "");
  };

  const dialPadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.first_name.toLowerCase().includes(query) ||
      lead.last_name.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query) ||
      lead.phone?.includes(query)
    );
  });

  const getCallStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'initiated':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Initiated</Badge>;
      case 'missed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Missed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Dialer" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Please select a workspace to access the dialer.</p>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Dialer" />
      <main className="flex-1 p-6">
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dialer</h1>
          <p className="text-muted-foreground">Make outbound calls to your leads</p>
        </div>
        <CreditsDisplay credits={creditsBalance} isLoading={isLoadingCredits} />
      </div>

      {/* Check if user has access to power dialer (Beta or Alpha plan) */}
      {(() => {
        const hasPowerDialer = currentWorkspace?.subscription_tier === 'beta' || currentWorkspace?.subscription_tier === 'alpha';
        return (
          <Tabs defaultValue="dialer" className="space-y-6">
            <TabsList>
              <TabsTrigger value="dialer" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Manual Dialer
              </TabsTrigger>
              <TabsTrigger 
                value="power-dialer" 
                className="flex items-center gap-2"
                disabled={!hasPowerDialer}
              >
                <Zap className="h-4 w-4" />
                Power Dialer
                {!hasPowerDialer && <Lock className="h-3 w-3 ml-1" />}
              </TabsTrigger>
              <TabsTrigger value="purchase" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Purchase
              </TabsTrigger>
            </TabsList>

        <TabsContent value="dialer" className="space-y-6">
          {dialerAvailable === false && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium text-warning">Dialer Not Configured</p>
                  <p className="text-sm text-muted-foreground">
                    CallHippo API key needs to be added to enable calling functionality.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dial Pad */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Dial Pad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLead && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">{selectedLead.first_name} {selectedLead.last_name}</span>
                    </div>
                    {selectedLead.company && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{selectedLead.company}</span>
                      </div>
                    )}
                  </div>
                )}

                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-center text-xl font-mono"
                  disabled={isCallActive}
                />

                <div className="grid grid-cols-3 gap-2">
                  {dialPadNumbers.map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      size="lg"
                      onClick={() => setPhoneNumber(prev => prev + num)}
                      disabled={isCallActive}
                      className="text-lg font-medium"
                    >
                      {num}
                    </Button>
                  ))}
                </div>

                {isCallActive ? (
                  <div className="space-y-4">
                    {/* Call Script Display */}
                    <CallScriptDisplay 
                      workspaceId={currentWorkspace.id} 
                      lead={selectedLead}
                    />

                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-success mb-2">
                        <PhoneCall className="h-5 w-5 animate-pulse" />
                        <span className="font-medium">Call in progress</span>
                      </div>
                      <p className="text-2xl font-mono">{formatDuration(callDuration)}</p>
                    </div>

                    {/* Call Recording Controls */}
                    {currentCallLog && (
                      <div className="flex justify-center">
                        <CallRecorder
                          callLogId={currentCallLog.id}
                          workspaceId={currentWorkspace.id}
                          onRecordingComplete={(url) => {
                            setCurrentCallLog(prev => prev ? { ...prev, recording_url: url } : null);
                          }}
                        />
                      </div>
                    )}

                    <Textarea
                      placeholder="Call notes..."
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      rows={3}
                    />

                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-full"
                      onClick={handleEndCall}
                      disabled={isLoading}
                    >
                      <PhoneOff className="h-5 w-5 mr-2" />
                      End Call
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleInitiateCall}
                    disabled={isLoading || !phoneNumber || dialerAvailable === false}
                  >
                    <Phone className="h-5 w-5 mr-2" />
                    {isLoading ? "Connecting..." : "Call"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Dial - Leads */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Quick Dial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredLeads.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No leads with phone numbers found
                      </p>
                    ) : (
                      filteredLeads.map((lead) => (
                        <button
                          key={lead.id}
                          onClick={() => handleSelectLead(lead)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedLead?.id === lead.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-accent/50'
                          }`}
                          disabled={isCallActive}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                              {lead.company && (
                                <p className="text-sm text-muted-foreground">{lead.company}</p>
                              )}
                            </div>
                            <p className="text-sm font-mono text-muted-foreground">{lead.phone}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Call History */}
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
                      <p className="text-center text-muted-foreground py-8">
                        No call history yet
                      </p>
                    ) : (
                      callLogs.map((log) => (
                        <div key={log.id} className="p-3 rounded-lg border border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-sm">{log.phone_number}</p>
                            {getCallStatusBadge(log.call_status)}
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{format(new Date(log.created_at), 'MMM d, h:mm a')}</span>
                            {log.duration_seconds && log.duration_seconds > 0 && (
                              <span>{formatDuration(log.duration_seconds)}</span>
                            )}
                          </div>
                          {log.recording_url && (
                            <CallRecordingPlayer 
                              recordingUrl={log.recording_url} 
                              callId={log.id} 
                            />
                          )}
                          {log.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{log.notes}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="power-dialer">
          {hasPowerDialer ? (
            <PowerDialer 
              workspaceId={currentWorkspace.id}
              dialerAvailable={dialerAvailable}
              onCreditsUpdated={fetchCredits}
            />
          ) : (
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Power Dialer</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Automatically dial through your lead list with one click. 
                  Power Dialer is available on Beta and Alpha plans.
                </p>
                <Button onClick={() => window.location.href = '/subscription'}>
                  Upgrade to Beta Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="purchase">
          <div className="space-y-6">
            <PurchaseTab 
              workspaceId={currentWorkspace.id} 
              onCreditsUpdated={fetchCredits}
            />
            <CallScriptManager workspaceId={currentWorkspace.id} />
          </div>
        </TabsContent>
        </Tabs>
        );
      })()}
        </div>
      </main>
    </DashboardLayout>
  );
}
