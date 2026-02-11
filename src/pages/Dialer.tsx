import { useState, useEffect, useRef } from "react";
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
  FileText,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  ExternalLink,
  Tag,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreditsDisplay } from "@/components/dialer/CreditsDisplay";
import { PurchaseTab } from "@/components/dialer/PurchaseTab";
import { PowerDialer } from "@/components/dialer/PowerDialer";
import { CallRecordingPlayer } from "@/components/dialer/CallRecordingPlayer";
import { CallScriptManager } from "@/components/dialer/CallScriptManager";
import { FloatingCallScript } from "@/components/dialer/FloatingCallScript";
import { CallRecordingsTab } from "@/components/dialer/CallRecordingsTab";
import { DialerSettingsTab } from "@/components/dialer/DialerSettingsTab";
import { CallDispositionDialog, CallDisposition } from "@/components/dialer/CallDispositionDialog";
import { LeadDetailSidebar } from "@/components/crm/LeadDetailSidebar";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  title: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  readiness_segment: string | null;
  latest_tags?: string[];
  latest_disposition?: string | null;
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
  disposition?: string | null;
  leads?: { first_name: string | null; last_name: string | null } | null;
}

interface PhoneNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  assigned_to: string | null;
}

export default function Dialer() {
  const { currentWorkspace, loading: workspaceLoading, hasActiveSubscription } = useWorkspace();
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
  const [showFloatingScript, setShowFloatingScript] = useState(true);
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [callDurationForDisposition, setCallDurationForDisposition] = useState(0);
  const dispositionHandledRef = useRef(false);
  const [crmLeadDetail, setCrmLeadDetail] = useState<any | null>(null);
  const [showCrmSidebar, setShowCrmSidebar] = useState(false);

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
    onCallDisconnected: (finalDuration?: number) => {
      // Refresh call logs when call ends
      fetchCallLogs();
      // Show disposition dialog if the recipient ended the call (not user-initiated)
      if (!dispositionHandledRef.current && (finalDuration ?? 0) > 0) {
        setCallDurationForDisposition(finalDuration || 0);
        setShowDispositionDialog(true);
      }
      dispositionHandledRef.current = false;
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
      setFreeMinutesRemaining(hasActiveSubscription ? (data?.free_minutes_remaining ?? 1000) : 0);
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
        .select('id, first_name, last_name, phone, company, email, title, last_contacted_at, notes, readiness_segment')
        .eq('workspace_id', currentWorkspace.id)
        .not('phone', 'is', null)
        .order('last_contacted_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      // Fetch latest call tags/disposition for each lead
      const leadIds = (data || []).map(l => l.id);
      let tagsByLead: Record<string, { tags: string[] | null; disposition: string | null }> = {};
      
      if (leadIds.length > 0) {
        const { data: callData } = await supabase
          .from('call_logs')
          .select('lead_id, tags, disposition')
          .in('lead_id', leadIds)
          .not('tags', 'is', null)
          .order('created_at', { ascending: false });

        if (callData) {
          for (const call of callData) {
            if (call.lead_id && !tagsByLead[call.lead_id]) {
              tagsByLead[call.lead_id] = { tags: call.tags, disposition: call.disposition };
            }
          }
        }
      }

      const enrichedLeads = (data || []).map(lead => ({
        ...lead,
        latest_tags: tagsByLead[lead.id]?.tags || [],
        latest_disposition: tagsByLead[lead.id]?.disposition || null,
      }));

      setLeads(enrichedLeads);
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
          twilio_call_sid,
          disposition,
          leads(first_name, last_name)
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
    // Mark as user-initiated so onCallDisconnected doesn't show a duplicate dialog
    dispositionHandledRef.current = true;
    // Parse duration from formatted string (MM:SS)
    const parts = formattedDuration.split(':');
    const durationInSeconds = parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0');
    setCallDurationForDisposition(durationInSeconds);
    setShowDispositionDialog(true);
  };

  const handleDispositionSubmit = async (data: { disposition: CallDisposition; notes: string; tags: string[]; scheduleCallback?: Date }) => {
    setIsLoading(true);
    setShowDispositionDialog(false);

    try {
      await endCall(data.notes);
      
      // Update call log with disposition, tags, and notes
      if (currentCallLogId) {
        await supabase
          .from('call_logs')
          .update({ 
            notes: data.notes,
            disposition: data.disposition,
            tags: data.tags,
          })
          .eq('id', currentCallLogId);
      }

      // Update lead notes in CRM
      if (selectedLead?.id && data.notes) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('notes')
          .eq('id', selectedLead.id)
          .single();
        
        const newNote = `[${new Date().toLocaleDateString()}] ${data.disposition}: ${data.notes}`;
        const updatedNotes = existingLead?.notes 
          ? `${existingLead.notes}\n\n${newNote}`
          : newNote;
        
        await supabase
          .from('leads')
          .update({ notes: updatedNotes })
          .eq('id', selectedLead.id);
      }

      // Schedule callback if requested
      if (data.scheduleCallback && user && currentWorkspace && selectedLead) {
        await supabase
          .from('scheduled_callbacks')
          .insert({
            workspace_id: currentWorkspace.id,
            lead_id: selectedLead.id,
            scheduled_for: data.scheduleCallback.toISOString(),
            reason: data.disposition,
            notes: data.notes || null,
            created_by: user.id,
          });
        toast.success(`Follow-up scheduled for ${format(data.scheduleCallback, 'MMM d, h:mm a')}`);
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

  const handleSkipDisposition = async () => {
    setShowDispositionDialog(false);
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

  const getCallStatusBadge = (status: string, durationSeconds?: number | null, disposition?: string | null) => {
    // Only show "Picked Up" when a real human conversation occurred
    // Use disposition to distinguish: interested, not_interested, meeting_booked, callback = real human
    // left_voicemail, gatekeeper, no_answer, wrong_number = NOT a real pickup
    const humanDispositions = ['interested', 'not_interested', 'meeting_booked', 'callback'];
    const wasPickedUp = disposition 
      ? humanDispositions.includes(disposition)
      : (status === 'completed' || status === 'in-progress' || status === 'in_progress') && (durationSeconds ?? 0) > 120;
    
    if (wasPickedUp) {
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
          <PhoneCall className="h-3 w-3" />
          Picked Up
        </Badge>
      );
    }

    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
            <PhoneOutgoing className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'initiated':
      case 'ringing':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
            <PhoneOutgoing className="h-3 w-3" />
            Attempted
          </Badge>
        );
      case 'in-progress':
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
            <PhoneCall className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case 'busy':
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
            <PhoneOff className="h-3 w-3" />
            Busy
          </Badge>
        );
      case 'no-answer':
      case 'no_answer':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <PhoneMissed className="h-3 w-3" />
            No Answer
          </Badge>
        );
      case 'missed':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <PhoneIncoming className="h-3 w-3" />
            Missed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCallDuration = (seconds: number | null) => {
    if (!seconds || seconds === 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    const isOwner = false; // Can't determine without workspace
    return (
      <DashboardLayout>
        <DashboardHeader title="Dialer" />
        <main className="flex-1 p-6">
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Join a company first to access the dialer. Browse jobs to find opportunities.
            </p>
            <Button onClick={() => window.location.href = '/jobs'}>
              <Building2 className="h-4 w-4 mr-2" />
              Browse Jobs
            </Button>
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
            const isOwner = currentWorkspace?.owner_id === user?.id;
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
                  {isOwner && (
                    <TabsTrigger value="purchase" className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Purchase
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="scripts" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Scripts
                  </TabsTrigger>
                  <TabsTrigger value="recordings" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Recordings
                  </TabsTrigger>
                  {isOwner && (
                    <TabsTrigger value="settings" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Dialer Settings
                    </TabsTrigger>
                  )}
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
                            {isOwner 
                              ? "You need to purchase a phone number to make calls. Go to the Purchase tab."
                              : "You do not have any assigned numbers. Request the agency you are working with to assign a number to start making calls."
                            }
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

                        {/* Caller ID Selection - Always visible */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Caller ID</label>
                          {workspacePhoneNumbers.length > 0 ? (
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
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full p-2 rounded-md border border-border bg-muted text-sm text-muted-foreground">
                                No numbers available
                              </div>
                              {isOwner && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => setActiveTab("purchase")}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Get a Phone Number
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

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
                            {/* Floating Script Toggle Button */}
                            {!showFloatingScript && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFloatingScript(true)}
                                className="w-full"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Show Call Script
                              </Button>
                            )}

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
                        ) : !hasActiveSubscription ? (
                          <div className="space-y-3">
                            <Button
                              size="lg"
                              className="w-full"
                              disabled
                            >
                              <Lock className="h-5 w-5 mr-2" />
                              Subscription Required
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                              Activate a subscription to start making calls and unlock 1,000 free minutes/mo.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.location.href = '/subscription'}
                            >
                              View Plans
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
                                <div
                                  key={lead.id}
                                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                    selectedLead?.id === lead.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <button
                                      onClick={() => handleSelectLead(lead)}
                                      disabled={isCallActive}
                                      className="flex-1 text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                                        {lead.readiness_segment && (
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                            <Tag className="h-2.5 w-2.5" />
                                            {lead.readiness_segment}
                                          </Badge>
                                        )}
                                        {lead.latest_disposition && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                            {lead.latest_disposition.replace('_', ' ')}
                                          </Badge>
                                        )}
                                      </div>
                                      {lead.latest_tags && lead.latest_tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {lead.latest_tags.map((tag) => (
                                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/50">
                                              <Tag className="h-2 w-2 mr-0.5" />
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {lead.company && (
                                        <p className="text-sm text-muted-foreground">{lead.company}</p>
                                      )}
                                      {lead.notes && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 line-clamp-1">
                                          <MessageSquare className="h-3 w-3 shrink-0" />
                                          {lead.notes.split('\n').pop()?.substring(0, 60)}
                                        </p>
                                      )}
                                      {lead.last_contacted_at && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                          <Clock className="h-3 w-3" />
                                          Last called {format(new Date(lead.last_contacted_at), 'MMM d, h:mm a')}
                                        </p>
                                      )}
                                    </button>
                                    <div className="flex flex-col items-end gap-1 ml-2">
                                      <p className="text-sm font-mono text-muted-foreground">{lead.phone}</p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Fetch full lead data and open sidebar
                                          (async () => {
                                            const { data } = await supabase
                                              .from('leads')
                                              .select('*')
                                              .eq('id', lead.id)
                                              .single();
                                            if (data) {
                                              setCrmLeadDetail(data);
                                              setShowCrmSidebar(true);
                                            }
                                          })();
                                        }}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                        title="View in CRM"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        CRM
                                      </button>
                                    </div>
                                  </div>
                                </div>
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
                              callLogs.map((log) => {
                                const leadName = log.leads?.first_name || log.leads?.last_name
                                  ? `${log.leads?.first_name || ''} ${log.leads?.last_name || ''}`.trim()
                                  : null;
                                return (
                                  <div key={log.id} className="p-3 rounded-lg border border-border space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        {leadName && (
                                          <p className="font-medium text-sm">{leadName}</p>
                                        )}
                                        <p className="font-mono text-sm text-muted-foreground">{log.phone_number}</p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        {getCallStatusBadge(log.call_status, log.duration_seconds, log.disposition)}
                                        {log.disposition && (
                                          <span className="text-xs text-muted-foreground capitalize">
                                            {log.disposition.replace('_', ' ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <PhoneOutgoing className="h-3 w-3" />
                                        <span>{format(new Date(log.created_at), 'MMM d, h:mm a')}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatCallDuration(log.duration_seconds) || '0:00'}</span>
                                      </div>
                                    </div>
                                    {log.recording_url && (
                                      <CallRecordingPlayer 
                                        recordingUrl={log.recording_url} 
                                        callId={log.id} 
                                      />
                                    )}
                                  </div>
                                );
                              })
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
                      phoneNumbers={workspacePhoneNumbers}
                      selectedCallerId={selectedCallerId}
                      onCallerIdChange={setSelectedCallerId}
                      makeCall={makeCall}
                      endTwilioCall={endCall}
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

                <TabsContent value="settings">
                  <DialerSettingsTab 
                    workspaceId={currentWorkspace.id}
                    onNumbersUpdated={fetchPhoneNumbers}
                  />
                </TabsContent>
              </Tabs>
            );
          })()}
        </div>

        {/* Floating Call Script */}
        <FloatingCallScript
          workspaceId={currentWorkspace.id}
          lead={selectedLead}
          isVisible={showFloatingScript && isCallActive}
          onClose={() => setShowFloatingScript(false)}
        />

        {/* Call Disposition Dialog */}
        <CallDispositionDialog
          open={showDispositionDialog}
          onOpenChange={(open) => {
            if (!open) handleSkipDisposition();
          }}
          leadName={selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : 'Unknown'}
          callDuration={callDurationForDisposition}
          existingNotes={callNotes}
          onSubmit={handleDispositionSubmit}
        />

        {/* CRM Lead Detail Sidebar */}
        <LeadDetailSidebar
          lead={crmLeadDetail}
          open={showCrmSidebar}
          onClose={() => setShowCrmSidebar(false)}
          onEdit={() => {}}
          onDelete={() => {}}
          isAgencyOwner={currentWorkspace?.owner_id === user?.id}
        />
      </main>
    </DashboardLayout>
  );
}
