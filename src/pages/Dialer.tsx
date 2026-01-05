import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { useSearchParams } from "react-router-dom";
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
  Mic,
  MicOff,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreditsDisplay } from "@/components/dialer/CreditsDisplay";
import { PurchaseTab } from "@/components/dialer/PurchaseTab";
import { PowerDialer } from "@/components/dialer/PowerDialer";
import { CallRecordingPlayer } from "@/components/dialer/CallRecordingPlayer";
import { CallScriptManager } from "@/components/dialer/CallScriptManager";
import { CallScriptDisplay } from "@/components/dialer/CallScriptDisplay";
import { CallRecordingsTab } from "@/components/dialer/CallRecordingsTab";

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
  twilio_call_sid?: string | null;
  recording_url?: string | null;
  leads?: Lead;
}

interface PhoneNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  assigned_to: string | null;
}

export default function Dialer() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentCallLogId, setCurrentCallLogId] = useState<string | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [freeMinutesRemaining, setFreeMinutesRemaining] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [workspacePhoneNumbers, setWorkspacePhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState("dialer");

  // Handle purchase success/cancel from Stripe redirect
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    const purchaseType = searchParams.get('type');
    
    if (purchaseStatus === 'success') {
      if (purchaseType === 'call_minutes') {
        toast.success("Call minutes purchased successfully!");
      } else if (purchaseType === 'phone_number') {
        toast.success("Phone number purchased successfully!");
      } else {
        toast.success("Purchase completed successfully!");
      }
      // Refresh credits after successful purchase
      fetchCredits();
      fetchPhoneNumbers();
      // Clear URL params
      setSearchParams({});
      setActiveTab("purchase");
    } else if (purchaseStatus === 'cancelled') {
      toast.info("Purchase was cancelled");
      setSearchParams({});
      setActiveTab("purchase");
    }
  }, [searchParams]);

  // Twilio Device Hook
  const {
    isReady: dialerAvailable,
    isConnecting,
    callStatus,
    formattedDuration,
    makeCall,
    endCall,
    toggleMute,
    sendDigits,
    error: twilioError,
  } = useTwilioDevice({
    workspaceId: currentWorkspace?.id || null,
    onCallStatusChange: (status) => {
      console.log('Call status changed:', status);
    },
    onCallDisconnected: () => {
      // Refresh call logs when call ends
      fetchCallLogs();
    },
  });

  const isCallActive = callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'in_progress';

  // Fetch workspace phone numbers - filter by assigned_to for non-owners
  const fetchPhoneNumbers = async () => {
    if (!currentWorkspace?.id || !user?.id) return;

    const isOwner = currentWorkspace.owner_id === user.id;

    let query = supabase
      .from('workspace_phone_numbers')
      .select('id, phone_number, is_active, assigned_to')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_active', true);

    // SDRs only see numbers assigned to them or unassigned numbers
    if (!isOwner) {
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching phone numbers:', error);
      return;
    }

    // For SDRs, prioritize their assigned numbers
    const sortedNumbers = isOwner 
      ? data || []
      : (data || []).sort((a, b) => {
          if (a.assigned_to === user.id && b.assigned_to !== user.id) return -1;
          if (b.assigned_to === user.id && a.assigned_to !== user.id) return 1;
          return 0;
        });

    setWorkspacePhoneNumbers(sortedNumbers);
    if (sortedNumbers.length > 0 && !selectedCallerId) {
      setSelectedCallerId(sortedNumbers[0].phone_number);
    }
  };

  useEffect(() => {
    fetchPhoneNumbers();
  }, [currentWorkspace?.id, user?.id]);

  // Fetch credits balance
  const fetchCredits = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoadingCredits(true);
    try {
      const { data, error } = await supabase.functions.invoke('twilio', {
        body: { action: 'get_credits', workspace_id: currentWorkspace.id },
      });

      if (error) {
        console.error('Error fetching credits:', error);
        return;
      }

      setCreditsBalance(data?.credits_balance || 0);
      setFreeMinutesRemaining(data?.free_minutes_remaining ?? 1000);
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [currentWorkspace?.id]);

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
        recording_url,
        twilio_call_sid
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

  useEffect(() => {
    fetchCallLogs();
  }, [currentWorkspace?.id]);

  const handleInitiateCall = async () => {
    if (!phoneNumber || !currentWorkspace?.id) {
      toast.error("Please enter a phone number");
      return;
    }

    if (!selectedCallerId) {
      toast.error("Please select a caller ID or purchase a phone number");
      return;
    }

    if (!dialerAvailable) {
      toast.error("Phone system is not ready. Please wait...");
      return;
    }

    setIsLoading(true);

    try {
      const result = await makeCall(phoneNumber, selectedCallerId, selectedLead?.id);
      
      if (result?.callLogId) {
        setCurrentCallLogId(result.callLogId);
        toast.success("Call initiated successfully");

        // Update lead's last contacted time
        if (selectedLead) {
          await supabase
            .from('leads')
            .update({ last_contacted_at: new Date().toISOString() })
            .eq('id', selectedLead.id);
        }
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error("Failed to initiate call");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCall = async () => {
    setIsLoading(true);

    try {
      await endCall(callNotes);
      
      // Update call log with notes if we have a call log ID
      if (currentCallLogId && callNotes) {
        await supabase
          .from('call_logs')
          .update({ notes: callNotes })
          .eq('id', currentCallLogId);
      }

      toast.success("Call ended");
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setCurrentCallLogId(null);
      setCallNotes("");
      setIsLoading(false);
      setIsMuted(false);
    }
  };

  const handleToggleMute = () => {
    const newMuteState = toggleMute();
    setIsMuted(newMuteState);
  };

  const handleDialPadPress = (digit: string) => {
    if (isCallActive) {
      sendDigits(digit);
    } else {
      setPhoneNumber(prev => prev + digit);
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
      case 'ringing':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Ringing</Badge>;
      case 'in-progress':
      case 'in_progress':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">In Progress</Badge>;
      case 'busy':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Busy</Badge>;
      case 'no-answer':
      case 'missed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">No Answer</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCallStatusDisplay = () => {
    switch (callStatus) {
      case 'connecting':
        return { text: 'Connecting...', icon: <PhoneCall className="h-5 w-5 animate-pulse" /> };
      case 'ringing':
        return { text: 'Ringing...', icon: <PhoneCall className="h-5 w-5 animate-pulse" /> };
      case 'in_progress':
        return { text: 'Call in progress', icon: <PhoneCall className="h-5 w-5" /> };
      default:
        return { text: 'Call in progress', icon: <PhoneCall className="h-5 w-5" /> };
    }
  };

  if (workspaceLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Dialer" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

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
            <CreditsDisplay 
              credits={creditsBalance} 
              freeMinutesRemaining={freeMinutesRemaining}
              isLoading={isLoadingCredits} 
            />
          </div>

          {/* Check if user has access to power dialer (Beta or Alpha plan) */}
          {(() => {
            const hasPowerDialer = currentWorkspace?.subscription_tier === 'beta' || currentWorkspace?.subscription_tier === 'alpha';
            return (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                  <TabsTrigger value="scripts" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Scripts
                  </TabsTrigger>
                  <TabsTrigger value="recordings" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Recordings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="dialer" className="space-y-6">
                  {twilioError && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardContent className="flex items-center gap-3 py-4">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">Phone System Error</p>
                          <p className="text-sm text-muted-foreground">{twilioError}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isConnecting && (
                    <Card className="border-primary/50 bg-primary/5">
                      <CardContent className="flex items-center gap-3 py-4">
                        <PhoneCall className="h-5 w-5 text-primary animate-pulse" />
                        <div>
                          <p className="font-medium text-primary">Initializing Phone System</p>
                          <p className="text-sm text-muted-foreground">
                            Setting up your browser for calls...
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {workspacePhoneNumbers.length === 0 && !isConnecting && (
                    <Card className="border-warning/50 bg-warning/5">
                      <CardContent className="flex items-center gap-3 py-4">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        <div>
                          <p className="font-medium text-warning">No Phone Numbers</p>
                          <p className="text-sm text-muted-foreground">
                            You need to purchase a phone number to make calls. Go to the Purchase tab.
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

                        {/* Caller ID Selection */}
                        {workspacePhoneNumbers.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Caller ID</label>
                            <select
                              value={selectedCallerId}
                              onChange={(e) => setSelectedCallerId(e.target.value)}
                              className="w-full p-2 rounded-md border border-border bg-background text-sm"
                              disabled={isCallActive}
                            >
                              {workspacePhoneNumbers.map((pn) => (
                                <option key={pn.id} value={pn.phone_number}>
                                  {pn.phone_number}
                                  {pn.assigned_to === user?.id && ' (Your Number)'}
                                </option>
                              ))}
                            </select>
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
                              onClick={() => handleDialPadPress(num)}
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
                                {getCallStatusDisplay().icon}
                                <span className="font-medium">{getCallStatusDisplay().text}</span>
                              </div>
                              <p className="text-2xl font-mono">{formattedDuration}</p>
                            </div>

                            {/* Call Controls */}
                            <div className="flex justify-center gap-2">
                              <Button
                                variant={isMuted ? "destructive" : "outline"}
                                size="icon"
                                onClick={handleToggleMute}
                                title={isMuted ? "Unmute" : "Mute"}
                              >
                                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                              </Button>
                            </div>

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
                            disabled={isLoading || !phoneNumber || !dialerAvailable || !selectedCallerId}
                          >
                            <Phone className="h-5 w-5 mr-2" />
                            {isLoading ? "Connecting..." : isConnecting ? "Initializing..." : "Call"}
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
                                      <span>{Math.floor(log.duration_seconds / 60)}:{(log.duration_seconds % 60).toString().padStart(2, '0')}</span>
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
                  <PurchaseTab 
                    workspaceId={currentWorkspace.id} 
                    subscriptionTier={currentWorkspace.subscription_tier}
                    onCreditsUpdated={fetchCredits}
                  />
                </TabsContent>

                <TabsContent value="scripts">
                  <CallScriptManager workspaceId={currentWorkspace.id} />
                </TabsContent>

                <TabsContent value="recordings">
                  <CallRecordingsTab workspaceId={currentWorkspace.id} />
                </TabsContent>
              </Tabs>
            );
          })()}
        </div>
      </main>
    </DashboardLayout>
  );
}
