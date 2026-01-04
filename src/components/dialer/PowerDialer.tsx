import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  RotateCcw,
  Search,
  Save,
  FolderOpen,
  Trash2,
  BarChart3,
  CalendarClock,
  MessageSquarePlus,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { CallScriptDisplay } from "./CallScriptDisplay";
import { SessionDispositionReport } from "./SessionDispositionReport";
import { format, addHours, addDays, startOfTomorrow, setHours, setMinutes } from "date-fns";

interface LeadDeal {
  id: string;
  stage: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  selected?: boolean;
  deals?: LeadDeal[] | null;
  last_contacted_at?: string | null;
}

interface SavedSequence {
  id: string;
  name: string;
  lead_ids: string[];
  created_at: string;
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

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const RECENTLY_CALLED_OPTIONS = [
  { value: 'all', label: 'All Leads' },
  { value: '24h', label: 'Not called in 24h' },
  { value: '48h', label: 'Not called in 48h' },
  { value: '72h', label: 'Not called in 72h' },
  { value: '7d', label: 'Not called in 7 days' },
];

const QUICK_NOTES = [
  { label: 'Left voicemail', text: 'Left voicemail with callback request.' },
  { label: 'Not interested', text: 'Not interested at this time.' },
  { label: 'Call back later', text: 'Requested callback at a later time.' },
  { label: 'Wrong number', text: 'Wrong number / invalid contact.' },
  { label: 'Interested', text: 'Showed interest, follow up needed.' },
  { label: 'Meeting booked', text: 'Meeting scheduled successfully.' },
  { label: 'Needs info', text: 'Requested more information via email.' },
  { label: 'Gatekeeper', text: 'Spoke with gatekeeper, need to call back.' },
];

const CALLBACK_OPTIONS = [
  { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
  { label: 'In 2 hours', getValue: () => addHours(new Date(), 2) },
  { label: 'Tomorrow 9 AM', getValue: () => setMinutes(setHours(startOfTomorrow(), 9), 0) },
  { label: 'Tomorrow 2 PM', getValue: () => setMinutes(setHours(startOfTomorrow(), 14), 0) },
  { label: 'In 2 days', getValue: () => addDays(new Date(), 2) },
  { label: 'In 1 week', getValue: () => addDays(new Date(), 7) },
];

interface ScheduledCallback {
  id: string;
  lead_id: string;
  scheduled_for: string;
  reason: string | null;
  notes: string | null;
  status: string;
  lead?: Lead;
}

const getStageLabel = (stage: string): string => {
  const found = PIPELINE_STAGES.find(s => s.value === stage);
  return found ? found.label : stage;
};

export function PowerDialer({ workspaceId, dialerAvailable, onCreditsUpdated }: PowerDialerProps) {
  const { user } = useAuth();
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
  const [currentTwilioCallSid, setCurrentTwilioCallSid] = useState<string | null>(null);
  
  // Filter states
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentlyCalledFilter, setRecentlyCalledFilter] = useState<string>('all');
  
  // Saved sequences state
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [sequenceName, setSequenceName] = useState('');
  
  // Callback scheduling state
  const [scheduledCallbacks, setScheduledCallbacks] = useState<ScheduledCallback[]>([]);
  const [sessionCallbacks, setSessionCallbacks] = useState<ScheduledCallback[]>([]);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<CallOutcome | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch leads with phone numbers and their associated deals
  useEffect(() => {
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, 
          first_name, 
          last_name, 
          phone, 
          company, 
          email,
          last_contacted_at,
          deals!deals_lead_id_fkey(id, stage)
        `)
        .eq('workspace_id', workspaceId)
        .not('phone', 'is', null)
        .order('last_contacted_at', { ascending: true, nullsFirst: true })
        .limit(200);

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      setLeads((data || []).map(lead => ({ ...lead, selected: false })));
    };

    fetchLeads();
  }, [workspaceId]);

  // Fetch saved sequences
  useEffect(() => {
    const fetchSequences = async () => {
      const { data, error } = await supabase
        .from('dialer_sequences')
        .select('id, name, lead_ids, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSavedSequences(data);
      }
    };

    fetchSequences();
  }, [workspaceId]);

  // Fetch scheduled callbacks
  useEffect(() => {
    const fetchCallbacks = async () => {
      const { data, error } = await supabase
        .from('scheduled_callbacks')
        .select('id, lead_id, scheduled_for, reason, notes, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(20);

      if (!error && data) {
        // Enrich with lead data
        const leadIds = data.map(cb => cb.lead_id);
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, first_name, last_name, phone, company, email')
          .in('id', leadIds);
        
        const leadsMap = new Map(leadData?.map(l => [l.id, l]) || []);
        setScheduledCallbacks(data.map(cb => ({
          ...cb,
          lead: leadsMap.get(cb.lead_id)
        })));
      }
    };

    fetchCallbacks();
  }, [workspaceId]);

  // Filtered leads based on stage, search, and recently called
  const filteredLeads = useMemo(() => {
    const now = new Date();
    
    return leads.filter(lead => {
      // Stage filter
      if (stageFilter !== 'all') {
        if (stageFilter === 'no_deal') {
          if (lead.deals && lead.deals.length > 0) return false;
        } else {
          const hasMatchingStage = lead.deals?.some(d => d.stage === stageFilter);
          if (!hasMatchingStage) return false;
        }
      }
      
      // Recently called filter
      if (recentlyCalledFilter !== 'all' && lead.last_contacted_at) {
        const lastContacted = new Date(lead.last_contacted_at);
        const hoursDiff = (now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60);
        
        switch (recentlyCalledFilter) {
          case '24h':
            if (hoursDiff < 24) return false;
            break;
          case '48h':
            if (hoursDiff < 48) return false;
            break;
          case '72h':
            if (hoursDiff < 72) return false;
            break;
          case '7d':
            if (hoursDiff < 168) return false;
            break;
        }
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(query);
        const matchesCompany = lead.company?.toLowerCase().includes(query) || false;
        const matchesPhone = lead.phone?.includes(query) || false;
        if (!matchesName && !matchesCompany && !matchesPhone) return false;
      }
      
      return true;
    });
  }, [leads, stageFilter, searchQuery, recentlyCalledFilter]);

  // Calculate session analytics
  const sessionAnalytics = useMemo(() => {
    if (dialedLeads.length === 0) return null;

    const totalCalls = dialedLeads.length;
    const connected = dialedLeads.filter(l => l.outcome === 'connected').length;
    const noAnswer = dialedLeads.filter(l => l.outcome === 'no_answer').length;
    const busy = dialedLeads.filter(l => l.outcome === 'busy').length;
    const voicemail = dialedLeads.filter(l => l.outcome === 'voicemail').length;
    const skipped = dialedLeads.filter(l => l.outcome === 'skipped').length;
    
    const connectRate = totalCalls > 0 ? (connected / totalCalls) * 100 : 0;
    
    const callsWithDuration = dialedLeads.filter(l => l.callDuration && l.callDuration > 0);
    const totalDuration = callsWithDuration.reduce((sum, l) => sum + (l.callDuration || 0), 0);
    const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;
    
    // Calls over 2 minutes (quality calls)
    const qualityCalls = dialedLeads.filter(l => l.callDuration && l.callDuration >= 120).length;
    const qualityRate = connected > 0 ? (qualityCalls / connected) * 100 : 0;

    return {
      totalCalls,
      connected,
      noAnswer,
      busy,
      voicemail,
      skipped,
      connectRate,
      avgDuration,
      qualityCalls,
      qualityRate,
    };
  }, [dialedLeads]);

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

  // Select all currently filtered leads
  const selectAllFilteredLeads = () => {
    const filteredIds = new Set(filteredLeads.map(l => l.id));
    setLeads(prev => prev.map(lead => ({
      ...lead,
      selected: filteredIds.has(lead.id) ? true : lead.selected
    })));
  };

  const deselectAllLeads = () => {
    setLeads(prev => prev.map(lead => ({ ...lead, selected: false })));
  };

  // Save current selection as a sequence
  const saveSequence = async () => {
    const selectedIds = leads.filter(l => l.selected).map(l => l.id);
    if (selectedIds.length === 0) {
      toast.error("Please select at least one lead to save");
      return;
    }
    if (!sequenceName.trim()) {
      toast.error("Please enter a sequence name");
      return;
    }
    if (!user) {
      toast.error("Please log in to save sequences");
      return;
    }

    const { data, error } = await supabase
      .from('dialer_sequences')
      .insert({
        workspace_id: workspaceId,
        name: sequenceName.trim(),
        lead_ids: selectedIds,
        created_by: user.id,
      })
      .select('id, name, lead_ids, created_at')
      .single();

    if (error) {
      toast.error("Failed to save sequence");
      console.error(error);
      return;
    }

    setSavedSequences(prev => [data, ...prev]);
    setSequenceName('');
    setSaveDialogOpen(false);
    toast.success(`Sequence "${data.name}" saved`);
  };

  // Load a saved sequence
  const loadSequence = (sequence: SavedSequence) => {
    const sequenceIdSet = new Set(sequence.lead_ids);
    setLeads(prev => prev.map(lead => ({
      ...lead,
      selected: sequenceIdSet.has(lead.id)
    })));
    setLoadDialogOpen(false);
    toast.success(`Loaded "${sequence.name}" (${sequence.lead_ids.length} leads)`);
  };

  // Delete a saved sequence
  const deleteSequence = async (sequenceId: string) => {
    const { error } = await supabase
      .from('dialer_sequences')
      .delete()
      .eq('id', sequenceId);

    if (error) {
      toast.error("Failed to delete sequence");
      return;
    }

    setSavedSequences(prev => prev.filter(s => s.id !== sequenceId));
    toast.success("Sequence deleted");
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
    setSessionCallbacks([]);
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
      
      // Get workspace phone numbers for caller ID
      const { data: phoneNumbers } = await supabase
        .from('workspace_phone_numbers')
        .select('phone_number')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .limit(1);

      const fromNumber = phoneNumbers?.[0]?.phone_number;
      if (!fromNumber) {
        toast.error("No phone number configured. Please purchase a number first.");
        setDialerStatus('paused');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'initiate_call',
            to_number: lead.phone,
            from_number: fromNumber,
            workspace_id: workspaceId,
            lead_id: lead.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to initiate call");
        handleCallOutcome('no_answer');
        return;
      }

      setCurrentCallLogId(data.call_log_id || null);
      setCurrentTwilioCallSid(data.call_sid || null);
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

  const handleCallOutcome = async (outcome: CallOutcome, skipCallbackPrompt = false) => {
    if (!currentLead) return;

    // For non-connected outcomes, show callback scheduling dialog (unless skipping)
    if (!skipCallbackPrompt && ['no_answer', 'busy', 'voicemail'].includes(outcome)) {
      setPendingOutcome(outcome);
      setShowCallbackDialog(true);
      return;
    }

    // End the call if still active
    if (dialerStatus === 'in_call' && currentTwilioCallSid) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'end_call',
                call_sid: currentTwilioCallSid,
                call_log_id: currentCallLogId,
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
    setCurrentTwilioCallSid(null);
    
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

  const scheduleCallback = async (scheduledFor: Date) => {
    if (!currentLead || !user || !pendingOutcome) return;

    const { data, error } = await supabase
      .from('scheduled_callbacks')
      .insert({
        workspace_id: workspaceId,
        lead_id: currentLead.id,
        scheduled_for: scheduledFor.toISOString(),
        reason: pendingOutcome,
        notes: callNotes || null,
        created_by: user.id,
      })
      .select('id, lead_id, scheduled_for, reason, notes, status')
      .single();

    if (error) {
      console.error('Error scheduling callback:', error);
      toast.error("Failed to schedule callback");
    } else {
      toast.success(`Callback scheduled for ${format(scheduledFor, 'MMM d, h:mm a')}`);
      
      // Add to session callbacks for report
      const newCallback: ScheduledCallback = {
        ...data,
        lead: currentLead,
      };
      setSessionCallbacks(prev => [...prev, newCallback]);
      
      // Refresh callbacks list
      const { data: callbacksData } = await supabase
        .from('scheduled_callbacks')
        .select('id, lead_id, scheduled_for, reason, notes, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(20);
      
      if (callbacksData) {
        const leadIds = callbacksData.map(cb => cb.lead_id);
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, first_name, last_name, phone, company, email')
          .in('id', leadIds);
        
        const leadsMap = new Map(leadData?.map(l => [l.id, l]) || []);
        setScheduledCallbacks(callbacksData.map(cb => ({
          ...cb,
          lead: leadsMap.get(cb.lead_id)
        })));
      }
    }

    // Continue with the outcome
    setShowCallbackDialog(false);
    handleCallOutcome(pendingOutcome, true);
    setPendingOutcome(null);
  };

  const skipCallback = () => {
    if (pendingOutcome) {
      setShowCallbackDialog(false);
      handleCallOutcome(pendingOutcome, true);
      setPendingOutcome(null);
    }
  };

  const insertQuickNote = (text: string) => {
    setCallNotes(prev => prev ? `${prev}\n${text}` : text);
  };

  const dialScheduledCallback = (callback: ScheduledCallback) => {
    if (!callback.lead) return;
    
    // Add the lead to selection and start dialing
    setLeads(prev => prev.map(l => 
      l.id === callback.lead_id ? { ...l, selected: true } : l
    ));
    
    const leadToDial = leads.find(l => l.id === callback.lead_id);
    if (leadToDial) {
      setSelectedLeads([leadToDial]);
      setCurrentIndex(0);
      setDialedLeads([]);
      setDialerStatus('dialing');
      dialNextLead([leadToDial], 0);
      
      // Mark callback as completed
      supabase
        .from('scheduled_callbacks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', callback.id)
        .then(() => {
          setScheduledCallbacks(prev => prev.filter(c => c.id !== callback.id));
        });
    }
  };

  const skipCurrentLead = () => {
    handleCallOutcome('skipped');
  };

  const pauseDialer = async () => {
    // End current call if active
    if (dialerStatus === 'in_call' && currentTwilioCallSid) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'end_call',
                call_sid: currentTwilioCallSid,
                call_log_id: currentCallLogId,
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
    setSessionCallbacks([]);
    setCallDuration(0);
    setCallNotes("");
    setCurrentCallLogId(null);
    setCurrentTwilioCallSid(null);
  };

  const exportSessionReport = () => {
    const lines: string[] = [
      'Power Dialer Session Report',
      `Date: ${format(new Date(), 'PPpp')}`,
      `Total Calls: ${dialedLeads.length}`,
      '',
      'Outcome Summary:',
      `  Connected: ${dialedLeads.filter(l => l.outcome === 'connected').length}`,
      `  No Answer: ${dialedLeads.filter(l => l.outcome === 'no_answer').length}`,
      `  Busy: ${dialedLeads.filter(l => l.outcome === 'busy').length}`,
      `  Voicemail: ${dialedLeads.filter(l => l.outcome === 'voicemail').length}`,
      `  Skipped: ${dialedLeads.filter(l => l.outcome === 'skipped').length}`,
      '',
      'Call Details:',
    ];

    dialedLeads.forEach((lead, idx) => {
      lines.push(`${idx + 1}. ${lead.first_name} ${lead.last_name} - ${lead.outcome?.replace('_', ' ')} - ${lead.callDuration ? formatDuration(lead.callDuration) : 'N/A'}`);
      if (lead.notes) {
        lines.push(`   Notes: ${lead.notes}`);
      }
    });

    if (sessionCallbacks.length > 0) {
      lines.push('');
      lines.push('Scheduled Callbacks:');
      sessionCallbacks.forEach((cb) => {
        lines.push(`  - ${cb.lead?.first_name} ${cb.lead?.last_name}: ${format(new Date(cb.scheduled_for), 'PPpp')} (${cb.reason})`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `power-dialer-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
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
              Twilio needs to be configured to use the power dialer.
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
        <>
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
                  <Button size="sm" variant="outline" onClick={selectAllFilteredLeads}>
                    Select All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={deselectAllLeads}>
                    Clear
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {leads.filter(l => l.selected).length} selected ({filteredLeads.length} of {leads.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Filter by stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="no_deal">No Deal</SelectItem>
                      {PIPELINE_STAGES.map(stage => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={recentlyCalledFilter} onValueChange={setRecentlyCalledFilter}>
                    <SelectTrigger className="w-full sm:w-[170px]">
                      <SelectValue placeholder="Recently called" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECENTLY_CALLED_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {filteredLeads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {leads.length === 0 
                        ? "No leads with phone numbers found"
                        : "No leads match your filters"}
                    </p>
                  ) : (
                    filteredLeads.map((lead) => (
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {lead.first_name} {lead.last_name}
                            </p>
                            {lead.deals && lead.deals.length > 0 ? (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {getStageLabel(lead.deals[0].stage)}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                No Deal
                              </Badge>
                            )}
                          </div>
                          {lead.company && (
                            <p className="text-sm text-muted-foreground truncate">{lead.company}</p>
                          )}
                        </div>
                        <p className="text-sm font-mono text-muted-foreground hidden sm:block">{lead.phone}</p>
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

              {/* Save/Load Sequence Buttons */}
              <div className="flex gap-2">
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      disabled={leads.filter(l => l.selected).length === 0}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save List
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Call Sequence</DialogTitle>
                      <DialogDescription>
                        Save your current selection as a reusable call list.
                      </DialogDescription>
                    </DialogHeader>
                    <Input
                      placeholder="Sequence name..."
                      value={sequenceName}
                      onChange={(e) => setSequenceName(e.target.value)}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveSequence}>
                        <Save className="h-4 w-4 mr-2" />
                        Save ({leads.filter(l => l.selected).length} leads)
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Load List
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Load Saved Sequence</DialogTitle>
                      <DialogDescription>
                        Select a saved call list to load.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2">
                        {savedSequences.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            No saved sequences yet
                          </p>
                        ) : (
                          savedSequences.map((seq) => (
                            <div
                              key={seq.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                            >
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => loadSequence(seq)}
                              >
                                <p className="font-medium">{seq.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {seq.lead_ids.length} leads
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSequence(seq.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
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

        {/* Scheduled Callbacks - Idle State */}
        {scheduledCallbacks.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-primary" />
                Scheduled Callbacks
              </CardTitle>
              <CardDescription>
                {scheduledCallbacks.length} callback{scheduledCallbacks.length !== 1 ? 's' : ''} waiting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {scheduledCallbacks.slice(0, 8).map((callback) => (
                  <div
                    key={callback.id}
                    className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors bg-card"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">
                        {callback.lead?.first_name} {callback.lead?.last_name}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize shrink-0 ml-1">
                        {callback.reason?.replace('_', ' ')}
                      </Badge>
                    </div>
                    {callback.lead?.company && (
                      <p className="text-xs text-muted-foreground truncate">{callback.lead.company}</p>
                    )}
                    <p className="text-xs text-primary font-medium mt-1 mb-2">
                      {format(new Date(callback.scheduled_for), 'MMM d, h:mm a')}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => dialScheduledCallback(callback)}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call Now
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </>
      ) : dialerStatus === 'completed' ? (
        <SessionDispositionReport
          dialedLeads={dialedLeads}
          sessionCallbacks={sessionCallbacks}
          onStartNewSession={resetDialer}
          onExportReport={exportSessionReport}
        />
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
              {currentLead ? (
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

                  {/* Call Script Display - shows during active calls */}
                  {(dialerStatus === 'in_call' || dialerStatus === 'dialing') && (
                    <CallScriptDisplay 
                      workspaceId={workspaceId} 
                      lead={{
                        ...currentLead,
                        title: null // Power dialer leads don't have title in selection
                      }} 
                    />
                  )}

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

                  {/* Quick Notes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquarePlus className="h-4 w-4" />
                      <span>Quick Notes</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_NOTES.map((note) => (
                        <Button
                          key={note.label}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => insertQuickNote(note.text)}
                        >
                          {note.label}
                        </Button>
                      ))}
                    </div>
                  </div>

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
                <div className="text-center py-8 text-muted-foreground">
                  No active call
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

          {/* Scheduled Callbacks - show in sidebar when there are callbacks */}
          {scheduledCallbacks.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-5 w-5 text-primary" />
                  Scheduled Callbacks
                </CardTitle>
                <CardDescription>
                  {scheduledCallbacks.length} upcoming callback{scheduledCallbacks.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {scheduledCallbacks.slice(0, 6).map((callback) => (
                    <div
                      key={callback.id}
                      className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">
                          {callback.lead?.first_name} {callback.lead?.last_name}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {callback.reason?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {format(new Date(callback.scheduled_for), 'MMM d, h:mm a')}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() => dialScheduledCallback(callback)}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Call Now
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Callback Scheduling Dialog */}
      <Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Schedule Callback
            </DialogTitle>
            <DialogDescription>
              {currentLead && (
                <>Schedule a follow-up call with {currentLead.first_name} {currentLead.last_name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {CALLBACK_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  className="justify-start"
                  onClick={() => scheduleCallback(option.getValue())}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={skipCallback}
              className="w-full sm:w-auto"
            >
              Skip & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
