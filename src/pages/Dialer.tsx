import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, PhoneCall, AlertCircle, ShoppingCart, Zap, Lock, FileText, Mic, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreditsDisplay } from "@/components/dialer/CreditsDisplay";
import { PurchaseTab } from "@/components/dialer/PurchaseTab";
import { PowerDialer } from "@/components/dialer/PowerDialer";
import { CallScriptManager } from "@/components/dialer/CallScriptManager";
import { FloatingCallScript } from "@/components/dialer/FloatingCallScript";
import { CallRecordingsTab } from "@/components/dialer/CallRecordingsTab";
import { DialerSettingsTab } from "@/components/dialer/DialerSettingsTab";
import { CallDispositionDialog, CallDisposition } from "@/components/dialer/CallDispositionDialog";
import { LeadDetailSidebar } from "@/components/crm/LeadDetailSidebar";
import { DialPad } from "@/components/dialer/DialPadComponent";
import { QuickDialList } from "@/components/dialer/QuickDialList";
import { CallHistoryPanel } from "@/components/dialer/CallHistoryPanel";

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

  // Demo mode state - allows simulated calls without a real phone number
  const [demoCallActive, setDemoCallActive] = useState(false);
  const [demoCallStatus, setDemoCallStatus] = useState<string>('idle');
  const [demoCallDuration, setDemoCallDuration] = useState(0);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle purchase success/cancel from Stripe redirect
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    const purchaseType = searchParams.get('type');
    if (purchaseStatus === 'success') {
      if (purchaseType === 'call_minutes') toast.success("Call minutes purchased successfully!");
      else if (purchaseType === 'phone_number') toast.success("Phone number purchased successfully!");
      else toast.success("Purchase completed successfully!");
      fetchCredits();
      fetchPhoneNumbers();
      setSearchParams({});
      setActiveTab("purchase");
    } else if (purchaseStatus === 'cancelled') {
      toast.info("Purchase was cancelled");
      setSearchParams({});
      setActiveTab("purchase");
    }
  }, [searchParams]);

  const {
    isReady: dialerAvailable, isConnecting, callStatus, formattedDuration,
    makeCall, endCall, toggleMute, sendDigits, error: twilioError,
  } = useTwilioDevice({
    workspaceId: currentWorkspace?.id || null,
    onCallStatusChange: (status) => console.log('Call status changed:', status),
    onCallDisconnected: (finalDuration?: number) => {
      fetchCallLogs();
      if (!dispositionHandledRef.current && (finalDuration ?? 0) > 0) {
        setCallDurationForDisposition(finalDuration || 0);
        setShowDispositionDialog(true);
      }
      dispositionHandledRef.current = false;
    },
  });

  // Demo call timer
  useEffect(() => {
    if (demoCallActive && demoCallStatus === 'in_progress') {
      demoTimerRef.current = setInterval(() => {
        setDemoCallDuration(prev => prev + 1);
      }, 1000);
    } else if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
    }
    return () => { if (demoTimerRef.current) clearInterval(demoTimerRef.current); };
  }, [demoCallActive, demoCallStatus]);

  const isDemoMode = workspacePhoneNumbers.length === 0 || !dialerAvailable;
  const isCallActive = demoCallActive || callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'in_progress';
  const effectiveCallStatus = demoCallActive ? demoCallStatus : callStatus;
  const effectiveFormattedDuration = demoCallActive 
    ? `${Math.floor(demoCallDuration / 60).toString().padStart(2, '0')}:${(demoCallDuration % 60).toString().padStart(2, '0')}` 
    : formattedDuration;
  const isOwner = currentWorkspace?.owner_id === user?.id;

  const fetchPhoneNumbers = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    let query = supabase.from('workspace_phone_numbers').select('id, phone_number, is_active, assigned_to')
      .eq('workspace_id', currentWorkspace.id).eq('is_active', true);
    if (!isOwner) query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
    const { data, error } = await query;
    if (error) { console.error('Error fetching phone numbers:', error); return; }
    const sortedNumbers = isOwner ? data || [] : (data || []).sort((a, b) => {
      if (a.assigned_to === user.id && b.assigned_to !== user.id) return -1;
      if (b.assigned_to === user.id && a.assigned_to !== user.id) return 1;
      return 0;
    });
    setWorkspacePhoneNumbers(sortedNumbers);
    if (sortedNumbers.length > 0 && !selectedCallerId) setSelectedCallerId(sortedNumbers[0].phone_number);
  };

  useEffect(() => { fetchPhoneNumbers(); }, [currentWorkspace?.id, user?.id]);

  const fetchCredits = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoadingCredits(true);
    try {
      const { data, error } = await supabase.functions.invoke('twilio', { body: { action: 'get_credits', workspace_id: currentWorkspace.id } });
      if (error) { console.error('Error fetching credits:', error); return; }
      setCreditsBalance(data?.credits_balance || 0);
      setFreeMinutesRemaining(hasActiveSubscription ? (data?.free_minutes_remaining ?? 1000) : 0);
    } catch (error) { console.error('Error fetching credits:', error); }
    finally { setIsLoadingCredits(false); }
  };

  useEffect(() => { fetchCredits(); }, [currentWorkspace?.id]);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!currentWorkspace?.id) return;
      const { data, error } = await supabase.from('leads')
        .select('id, first_name, last_name, phone, company, email, title, last_contacted_at, notes, readiness_segment')
        .eq('workspace_id', currentWorkspace.id).not('phone', 'is', null)
        .order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(50);
      if (error) { console.error('Error fetching leads:', error); return; }

      const leadIds = (data || []).map(l => l.id);
      let tagsByLead: Record<string, { tags: string[] | null; disposition: string | null }> = {};
      if (leadIds.length > 0) {
        const { data: callData } = await supabase.from('call_logs').select('lead_id, tags, disposition')
          .in('lead_id', leadIds).not('tags', 'is', null).order('created_at', { ascending: false });
        if (callData) {
          for (const call of callData) {
            if (call.lead_id && !tagsByLead[call.lead_id]) tagsByLead[call.lead_id] = { tags: call.tags, disposition: call.disposition };
          }
        }
      }
      setLeads((data || []).map(lead => ({ ...lead, latest_tags: tagsByLead[lead.id]?.tags || [], latest_disposition: tagsByLead[lead.id]?.disposition || null })));
    };
    fetchLeads();
  }, [currentWorkspace?.id]);

  const fetchCallLogs = async () => {
    if (!currentWorkspace?.id) return;
    const { data, error } = await supabase.from('call_logs')
      .select(`id, phone_number, call_status, duration_seconds, notes, created_at, lead_id, recording_url, twilio_call_sid, disposition, leads(first_name, last_name)`)
      .eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false }).limit(20);
    if (error) { console.error('Error fetching call logs:', error); return; }
    setCallLogs(data || []);
  };

  useEffect(() => { fetchCallLogs(); }, [currentWorkspace?.id]);

  const handleInitiateCall = async () => {
    if (!phoneNumber || !currentWorkspace?.id) { toast.error("Please enter a phone number"); return; }
    
    // Demo mode: simulate a call without Twilio
    if (isDemoMode) {
      setDemoCallActive(true);
      setDemoCallStatus('connecting');
      toast.success("Connecting call...");
      setTimeout(() => {
        setDemoCallStatus('ringing');
        toast.info("Ringing...");
        setTimeout(() => {
          setDemoCallStatus('in_progress');
          setDemoCallDuration(0);
          toast.success("Call connected!");
        }, 2000);
      }, 1500);
      return;
    }

    if (!selectedCallerId) { toast.error("Please select a caller ID or purchase a phone number"); return; }
    if (!dialerAvailable) { toast.error("Phone system is not ready. Please wait..."); return; }
    setIsLoading(true);
    try {
      const result = await makeCall(phoneNumber, selectedCallerId, selectedLead?.id);
      if (result?.callLogId) {
        setCurrentCallLogId(result.callLogId);
        toast.success("Call initiated successfully");
        if (selectedLead) await supabase.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', selectedLead.id);
      }
    } catch (error) { console.error('Error initiating call:', error); toast.error("Failed to initiate call"); }
    finally { setIsLoading(false); }
  };

  const handleEndCall = async () => {
    if (demoCallActive) {
      const duration = demoCallDuration;
      setDemoCallActive(false);
      setDemoCallStatus('idle');
      setDemoCallDuration(0);
      setCallDurationForDisposition(duration);
      setShowDispositionDialog(true);
      return;
    }
    dispositionHandledRef.current = true;
    const parts = formattedDuration.split(':');
    setCallDurationForDisposition(parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0'));
    setShowDispositionDialog(true);
  };

  const handleDispositionSubmit = async (data: { disposition: CallDisposition; notes: string; tags: string[]; scheduleCallback?: Date }) => {
    setIsLoading(true);
    setShowDispositionDialog(false);
    try {
      await endCall(data.notes);
      if (currentCallLogId) await supabase.from('call_logs').update({ notes: data.notes, disposition: data.disposition, tags: data.tags }).eq('id', currentCallLogId);
      if (selectedLead?.id && data.notes) {
        const { data: existingLead } = await supabase.from('leads').select('notes').eq('id', selectedLead.id).single();
        const newNote = `[${new Date().toLocaleDateString()}] ${data.disposition}: ${data.notes}`;
        const updatedNotes = existingLead?.notes ? `${existingLead.notes}\n\n${newNote}` : newNote;
        await supabase.from('leads').update({ notes: updatedNotes }).eq('id', selectedLead.id);
      }
      if (data.scheduleCallback && user && currentWorkspace && selectedLead) {
        await supabase.from('scheduled_callbacks').insert({ workspace_id: currentWorkspace.id, lead_id: selectedLead.id, scheduled_for: data.scheduleCallback.toISOString(), reason: data.disposition, notes: data.notes || null, created_by: user.id });
        toast.success(`Follow-up scheduled for ${format(data.scheduleCallback, 'MMM d, h:mm a')}`);
      }
      toast.success("Call ended");
    } catch (error) { console.error('Error ending call:', error); }
    finally { setCurrentCallLogId(null); setCallNotes(""); setIsLoading(false); setIsMuted(false); }
  };

  const handleSkipDisposition = async () => {
    setShowDispositionDialog(false);
    setIsLoading(true);
    try {
      await endCall(callNotes);
      if (currentCallLogId && callNotes) await supabase.from('call_logs').update({ notes: callNotes }).eq('id', currentCallLogId);
      toast.success("Call ended");
    } catch (error) { console.error('Error ending call:', error); }
    finally { setCurrentCallLogId(null); setCallNotes(""); setIsLoading(false); setIsMuted(false); }
  };

  const handleToggleMute = () => { setIsMuted(toggleMute()); };
  const handleDialPadPress = (digit: string) => { if (isCallActive) sendDigits(digit); else setPhoneNumber(prev => prev + digit); };
  const handleSelectLead = (lead: Lead) => { setSelectedLead(lead); setPhoneNumber(lead.phone || ""); };

  if (workspaceLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Dialer" />
        <main className="flex-1 p-3 md:p-6">
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
        <main className="flex-1 p-3 md:p-6">
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Join a company first to access the dialer. Browse jobs to find opportunities.
            </p>
            <Button onClick={() => window.location.href = '/jobs'}>
              <Building2 className="h-4 w-4 mr-2" />Browse Jobs
            </Button>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  const hasPowerDialer = currentWorkspace?.subscription_tier === 'beta' || currentWorkspace?.subscription_tier === 'alpha';

  return (
    <DashboardLayout>
      <DashboardHeader title="Dialer" />
      <main className="flex-1 p-3 md:p-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl md:text-3xl font-bold">Dialer</h1>
              <p className="text-sm md:text-base text-muted-foreground">Make outbound calls to your leads</p>
            </div>
            <CreditsDisplay credits={creditsBalance} freeMinutesRemaining={freeMinutesRemaining} isLoading={isLoadingCredits} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="overflow-x-auto scrollbar-hide w-full justify-start">
              <TabsTrigger value="dialer" className="flex items-center gap-2 whitespace-nowrap">
                <Phone className="h-4 w-4" /><span className="hidden sm:inline">Manual</span> Dialer
              </TabsTrigger>
              <TabsTrigger value="power-dialer" className="flex items-center gap-2 whitespace-nowrap" disabled={!hasPowerDialer}>
                <Zap className="h-4 w-4" />Power Dialer{!hasPowerDialer && <Lock className="h-3 w-3 ml-1" />}
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="purchase" className="flex items-center gap-2 whitespace-nowrap">
                  <ShoppingCart className="h-4 w-4" />Purchase
                </TabsTrigger>
              )}
              <TabsTrigger value="scripts" className="flex items-center gap-2 whitespace-nowrap">
                <FileText className="h-4 w-4" />Scripts
              </TabsTrigger>
              <TabsTrigger value="recordings" className="flex items-center gap-2 whitespace-nowrap">
                <Mic className="h-4 w-4" />Recordings
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="settings" className="flex items-center gap-2 whitespace-nowrap">
                  <Phone className="h-4 w-4" />Dialer Settings
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
                      <p className="text-sm text-muted-foreground">Setting up your browser for calls...</p>
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
                <DialPad
                  phoneNumber={phoneNumber}
                  setPhoneNumber={setPhoneNumber}
                  selectedLead={selectedLead}
                  selectedCallerId={selectedCallerId}
                  setSelectedCallerId={setSelectedCallerId}
                  workspacePhoneNumbers={workspacePhoneNumbers}
                  isCallActive={isCallActive}
                  isLoading={isLoading}
                  isConnecting={isConnecting}
                  dialerAvailable={dialerAvailable}
                  hasActiveSubscription={hasActiveSubscription}
                  callStatus={callStatus}
                  formattedDuration={formattedDuration}
                  isMuted={isMuted}
                  callNotes={callNotes}
                  setCallNotes={setCallNotes}
                  showFloatingScript={showFloatingScript}
                  setShowFloatingScript={setShowFloatingScript}
                  onInitiateCall={handleInitiateCall}
                  onEndCall={handleEndCall}
                  onToggleMute={handleToggleMute}
                  onDialPadPress={handleDialPadPress}
                  onGoToPurchase={() => setActiveTab("purchase")}
                  isOwner={!!isOwner}
                  userId={user?.id}
                />

                <QuickDialList
                  leads={leads}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedLead={selectedLead}
                  isCallActive={isCallActive}
                  onSelectLead={handleSelectLead}
                  onOpenCrmSidebar={(lead) => { setCrmLeadDetail(lead); setShowCrmSidebar(true); }}
                />

                <CallHistoryPanel callLogs={callLogs} />
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
                    <div className="p-4 rounded-full bg-primary/10 mb-4"><Zap className="h-8 w-8 text-primary" /></div>
                    <h3 className="text-xl font-semibold mb-2">Power Dialer</h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Automatically dial through your lead list with one click. Power Dialer is available on Beta and Alpha plans.
                    </p>
                    <Button onClick={() => window.location.href = '/subscription'}>Upgrade to Beta Plan</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="purchase">
              <PurchaseTab workspaceId={currentWorkspace.id} subscriptionTier={currentWorkspace.subscription_tier} onCreditsUpdated={fetchCredits} />
            </TabsContent>

            <TabsContent value="scripts">
              <CallScriptManager workspaceId={currentWorkspace.id} />
            </TabsContent>

            <TabsContent value="recordings">
              <CallRecordingsTab workspaceId={currentWorkspace.id} />
            </TabsContent>

            <TabsContent value="settings">
              <DialerSettingsTab workspaceId={currentWorkspace.id} onNumbersUpdated={fetchPhoneNumbers} />
            </TabsContent>
          </Tabs>
        </div>

        <FloatingCallScript workspaceId={currentWorkspace.id} lead={selectedLead} isVisible={showFloatingScript && isCallActive} onClose={() => setShowFloatingScript(false)} />

        <CallDispositionDialog
          open={showDispositionDialog}
          onOpenChange={(open) => { if (!open) handleSkipDisposition(); }}
          leadName={selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : 'Unknown'}
          callDuration={callDurationForDisposition}
          existingNotes={callNotes}
          onSubmit={handleDispositionSubmit}
        />

        <LeadDetailSidebar
          lead={crmLeadDetail}
          open={showCrmSidebar}
          onClose={() => setShowCrmSidebar(false)}
          onEdit={() => {}}
          onDelete={() => {}}
          isAgencyOwner={!!isOwner}
        />
      </main>
    </DashboardLayout>
  );
}
