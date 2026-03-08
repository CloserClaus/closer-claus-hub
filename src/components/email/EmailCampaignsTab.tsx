import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2, ChevronDown, Play, Pause, Eye, Calendar, Mail as MailIcon, Users, ArrowRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface SequenceStep {
  delay_days: number;
  subject: string;
  body: string;
}

interface SavedSequence {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  status: string;
  sending_inbox_id: string | null;
  sending_window_start: string | null;
  sending_window_end: string | null;
  sending_timezone: string | null;
  random_delay_min_seconds: number | null;
  random_delay_max_seconds: number | null;
  daily_send_cap: number | null;
  steps: SequenceStep[];
  // computed stats
  total_leads: number;
  emails_sent: number;
  replies: number;
  bounces: number;
  active_count: number;
  paused_count: number;
  completed_count: number;
}

const VARIABLES = [
  { key: '{{first_name}}', label: 'First Name' },
  { key: '{{last_name}}', label: 'Last Name' },
  { key: '{{company}}', label: 'Company' },
  { key: '{{title}}', label: 'Title' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Phone' },
];

export function EmailCampaignsTab() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { allInboxes } = useEmailInbox();
  const { toast } = useToast();
  const [sequences, setSequences] = useState<SavedSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState<SavedSequence | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<SavedSequence | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<any[]>([]);

  // Builder state
  const [seqName, setSeqName] = useState('');
  const [sendingInboxId, setSendingInboxId] = useState('');
  const [sendingWindowStart, setSendingWindowStart] = useState('08:00');
  const [sendingWindowEnd, setSendingWindowEnd] = useState('18:00');
  const [sendingTimezone, setSendingTimezone] = useState('America/New_York');
  const [randomDelayMin, setRandomDelayMin] = useState(45);
  const [randomDelayMax, setRandomDelayMax] = useState(120);
  const [dailySendCap, setDailySendCap] = useState(50);
  const [steps, setSteps] = useState<SequenceStep[]>([
    { delay_days: 0, subject: '', body: '' },
    { delay_days: 3, subject: '', body: '' },
  ]);

  useEffect(() => {
    if (currentWorkspace) fetchSequences();
  }, [currentWorkspace]);

  const fetchSequences = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data: seqs } = await supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    const result: SavedSequence[] = [];
    if (seqs) {
      for (const seq of seqs as any[]) {
        const { data: stepsData } = await supabase
          .from('follow_up_sequence_steps')
          .select('delay_days, subject, body')
          .eq('sequence_id', seq.id)
          .order('step_order', { ascending: true });

        // Get campaign stats from active_follow_ups
        const { data: followUps } = await supabase
          .from('active_follow_ups')
          .select('status')
          .eq('sequence_id', seq.id);

        const fups = (followUps as any[]) || [];

        // Get email stats
        const { data: emailStats } = await supabase
          .from('email_logs')
          .select('status')
          .eq('sequence_id', seq.id)
          .eq('workspace_id', currentWorkspace.id);

        const emails = (emailStats as any[]) || [];

        result.push({
          ...seq,
          steps: (stepsData as SequenceStep[]) || [],
          total_leads: fups.length,
          emails_sent: emails.length,
          replies: emails.filter(e => e.status === 'replied').length,
          bounces: emails.filter(e => e.status === 'bounced').length,
          active_count: fups.filter(f => f.status === 'active').length,
          paused_count: fups.filter(f => f.status === 'paused').length,
          completed_count: fups.filter(f => f.status === 'completed').length,
        });
      }
    }
    setSequences(result);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingSequence(null);
    setSeqName(''); setSendingInboxId('');
    setSendingWindowStart('08:00'); setSendingWindowEnd('18:00');
    setSendingTimezone('America/New_York');
    setRandomDelayMin(45); setRandomDelayMax(120); setDailySendCap(50);
    setSteps([{ delay_days: 0, subject: '', body: '' }, { delay_days: 3, subject: '', body: '' }]);
    setShowBuilder(true);
  };

  const openEdit = (seq: SavedSequence) => {
    setEditingSequence(seq);
    setSeqName(seq.name);
    setSendingInboxId(seq.sending_inbox_id || '');
    setSendingWindowStart(seq.sending_window_start || '08:00');
    setSendingWindowEnd(seq.sending_window_end || '18:00');
    setSendingTimezone(seq.sending_timezone || 'America/New_York');
    setRandomDelayMin(seq.random_delay_min_seconds ?? 45);
    setRandomDelayMax(seq.random_delay_max_seconds ?? 120);
    setDailySendCap(seq.daily_send_cap ?? 50);
    setSteps(seq.steps.length > 0 ? [...seq.steps] : [{ delay_days: 0, subject: '', body: '' }]);
    setShowBuilder(true);
  };

  const handleDuplicate = async (seq: SavedSequence) => {
    if (!currentWorkspace || !user) return;
    try {
      const { data: newSeq, error } = await supabase
        .from('follow_up_sequences')
        .insert({ workspace_id: currentWorkspace.id, created_by: user.id, name: `${seq.name} (Copy)` } as any)
        .select('id').single();
      if (error) throw error;
      const stepsToInsert = seq.steps.map((s, i) => ({
        sequence_id: newSeq.id, step_order: i, delay_days: s.delay_days, subject: s.subject, body: s.body,
      }));
      await supabase.from('follow_up_sequence_steps').insert(stepsToInsert);
      toast({ title: 'Sequence duplicated' });
      fetchSequences();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (seqId: string) => {
    setDeleting(true);
    try {
      // Clean up active follow-ups and reset lead states before deleting
      const { data: activeFups } = await supabase
        .from('active_follow_ups')
        .select('lead_id')
        .eq('sequence_id', seqId)
        .in('status', ['active', 'paused']);
      
      if (activeFups && activeFups.length > 0) {
        await supabase
          .from('active_follow_ups')
          .update({ status: 'completed', completed_at: new Date().toISOString() } as any)
          .eq('sequence_id', seqId)
          .in('status', ['active', 'paused']);
        
        const leadIds = [...new Set((activeFups as any[]).map(f => f.lead_id))];
        for (const leadId of leadIds) {
          await supabase.from('leads').update({ email_sending_state: 'idle' } as any).eq('id', leadId);
        }
      }

      await supabase.from('follow_up_sequence_steps').delete().eq('sequence_id', seqId);
      await supabase.from('follow_up_sequences').delete().eq('id', seqId);
      toast({ title: 'Sequence deleted' });
      if (selectedCampaign?.id === seqId) setSelectedCampaign(null);
      setDeleteConfirmId(null);
      fetchSequences();
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkspace || !user || !seqName.trim()) return;
    setSaving(true);
    try {
      let sequenceId: string;
      const seqPayload = {
        name: seqName,
        sending_inbox_id: sendingInboxId || null,
        sending_window_start: sendingWindowStart,
        sending_window_end: sendingWindowEnd,
        sending_timezone: sendingTimezone,
        random_delay_min_seconds: randomDelayMin,
        random_delay_max_seconds: randomDelayMax,
        daily_send_cap: dailySendCap,
      } as any;

      if (editingSequence) {
        await supabase.from('follow_up_sequences').update(seqPayload).eq('id', editingSequence.id);
        await supabase.from('follow_up_sequence_steps').delete().eq('sequence_id', editingSequence.id);
        sequenceId = editingSequence.id;
      } else {
        const { data, error } = await supabase
          .from('follow_up_sequences')
          .insert({ ...seqPayload, workspace_id: currentWorkspace.id, created_by: user.id } as any)
          .select('id').single();
        if (error) throw error;
        sequenceId = data.id;
      }

      const stepsToInsert = steps.map((s, i) => ({
        sequence_id: sequenceId, step_order: i, delay_days: s.delay_days, subject: s.subject, body: s.body,
      }));
      await supabase.from('follow_up_sequence_steps').insert(stepsToInsert);

      toast({ title: editingSequence ? 'Sequence updated' : 'Sequence created' });
      setShowBuilder(false);
      fetchSequences();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally { setSaving(false); }
  };

  const viewCampaignDetail = async (seq: SavedSequence) => {
    setSelectedCampaign(seq);
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('active_follow_ups')
      .select('*, leads:lead_id(first_name, last_name, email, company)')
      .eq('sequence_id', seq.id)
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setCampaignLeads((data as any[]) || []);
  };

  const handleToggleCampaignStatus = async (seqId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await supabase.from('follow_up_sequences').update({ status: newStatus } as any).eq('id', seqId);
    // Also pause/resume all active follow-ups for this sequence
    if (newStatus === 'paused') {
      await supabase.from('active_follow_ups').update({ status: 'paused' } as any).eq('sequence_id', seqId).eq('status', 'active');
    } else {
      await supabase.from('active_follow_ups').update({ status: 'active', next_send_at: new Date().toISOString() } as any).eq('sequence_id', seqId).eq('status', 'paused');
    }
    toast({ title: `Campaign ${newStatus}` });
    fetchSequences();
  };

  const addStep = () => {
    const lastDay = steps[steps.length - 1]?.delay_days || 0;
    setSteps([...steps, { delay_days: lastDay + 3, subject: '', body: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: any) => {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  };

  const insertVariable = (index: number, variable: string) => {
    const updated = [...steps];
    updated[index].body += variable;
    setSteps(updated);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'secondary' },
      active: { label: 'Active', variant: 'default' },
      paused: { label: 'Paused', variant: 'outline' },
      completed: { label: 'Completed', variant: 'secondary' },
    };
    const c = configs[status] || configs.draft;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  if (selectedCampaign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>← Back</Button>
          <div>
            <h2 className="text-lg font-semibold">{selectedCampaign.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedCampaign.total_leads} leads enrolled</p>
          </div>
          {getStatusBadge(selectedCampaign.status)}
          <Button
            variant="outline" size="sm"
            onClick={() => handleToggleCampaignStatus(selectedCampaign.id, selectedCampaign.status)}
          >
            {selectedCampaign.status === 'active' ? <><Pause className="h-3.5 w-3.5 mr-1" />Pause</> : <><Play className="h-3.5 w-3.5 mr-1" />Resume</>}
          </Button>
        </div>

        {/* Campaign Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Emails Sent', value: selectedCampaign.emails_sent },
            { label: 'Replies', value: selectedCampaign.replies },
            { label: 'Bounces', value: selectedCampaign.bounces },
            { label: 'Active', value: selectedCampaign.active_count },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Per-lead progress */}
        <Card>
          <CardHeader><CardTitle className="text-base">Lead Progress</CardTitle></CardHeader>
          <CardContent>
            {campaignLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No leads enrolled in this campaign yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Email</TableHead>
                    <TableHead>Stop Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignLeads.map((cl: any) => (
                    <TableRow key={cl.id}>
                      <TableCell className="font-medium">
                        {cl.leads?.first_name} {cl.leads?.last_name}
                        <p className="text-xs text-muted-foreground">{cl.leads?.company}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Step {cl.current_step + 1} / {selectedCampaign.steps.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cl.status === 'active' ? 'default' : cl.status === 'completed' ? 'secondary' : cl.status === 'replied' ? 'default' : 'outline'}
                          className={cl.status === 'replied' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                          {cl.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cl.next_send_at ? format(new Date(cl.next_send_at), 'MMM d, h:mm a') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cl.status === 'replied' ? 'Reply detected' :
                         cl.status === 'error' ? 'Send error' :
                         cl.status === 'completed' ? 'All steps sent' :
                         cl.status === 'paused' ? 'Manually paused' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Create and manage email sequences with campaign tracking</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Sequence</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No campaigns created yet</p>
            <Button onClick={openCreate} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" />Create Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sequences.map((seq) => (
            <Card key={seq.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => viewCampaignDetail(seq)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{seq.name}</h3>
                      <Badge variant="secondary" className="text-xs">{seq.steps.length} steps</Badge>
                      {getStatusBadge(seq.status)}
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Leads</p>
                        <p className="font-medium">{seq.total_leads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Sent</p>
                        <p className="font-medium">{seq.emails_sent}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Replies</p>
                        <p className="font-medium">{seq.replies}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Bounce Rate</p>
                        <p className="font-medium">{seq.emails_sent > 0 ? ((seq.bounces / seq.emails_sent) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(seq)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(seq)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(seq.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sequence Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSequence ? 'Edit Sequence' : 'Create Sequence'}</DialogTitle>
          </DialogHeader>

          {editingSequence && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Warning: Modifying a sequence that is currently active will affect all leads currently enrolled. They will receive the new steps.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sequence Name</Label>
                <Input value={seqName} onChange={(e) => setSeqName(e.target.value)} placeholder="e.g. Cold Outreach v1" />
              </div>
              <div className="space-y-2">
                <Label>Sending Inbox</Label>
                <Select value={sendingInboxId} onValueChange={setSendingInboxId}>
                  <SelectTrigger><SelectValue placeholder="Auto (assigned inbox)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (SDR's assigned inbox)</SelectItem>
                    {allInboxes.filter((i: any) => i.status === 'active').map((inbox: any) => (
                      <SelectItem key={inbox.id} value={inbox.id}>{inbox.email_address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Send Window Start</Label>
                <Input type="time" value={sendingWindowStart} onChange={(e) => setSendingWindowStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Send Window End</Label>
                <Input type="time" value={sendingWindowEnd} onChange={(e) => setSendingWindowEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={sendingTimezone} onValueChange={setSendingTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Europe/London'].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Random Delay (min sec)</Label>
                <Input type="number" min={0} value={randomDelayMin} onChange={(e) => setRandomDelayMin(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Random Delay (max sec)</Label>
                <Input type="number" min={0} value={randomDelayMax} onChange={(e) => setRandomDelayMax(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Daily Send Cap</Label>
                <Input type="number" min={1} value={dailySendCap} onChange={(e) => setDailySendCap(parseInt(e.target.value) || 50)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-medium">Email Steps</Label>
            </div>

            {steps.map((step, i) => (
              <Card key={i} className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{i + 1}</div>
                      <span className="text-sm font-medium">Email {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Day</Label>
                        <Input type="number" min={0} value={step.delay_days}
                          onChange={(e) => updateStep(i, 'delay_days', parseInt(e.target.value) || 0)} className="w-16 h-8 text-sm" />
                      </div>
                      {steps.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStep(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input value={step.subject} onChange={(e) => updateStep(i, 'subject', e.target.value)} placeholder="Subject line" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Body</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs h-6">Insert Variable<ChevronDown className="h-3 w-3 ml-1" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {VARIABLES.map((v) => (
                            <DropdownMenuItem key={v.key} onClick={() => insertVariable(i, v.key)}>
                              {v.label} <span className="ml-auto text-xs text-muted-foreground">{v.key}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Textarea value={step.body} onChange={(e) => updateStep(i, 'body', e.target.value)} placeholder="Email body..." className="min-h-[80px]" />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addStep} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />Add Step
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !seqName.trim() || steps.some(s => !s.subject.trim() || !s.body.trim())}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSequence ? 'Save Changes' : 'Create Sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Delete Campaign"
        description="This will permanently delete this campaign sequence, stop all active follow-ups, and reset affected leads. This action cannot be undone."
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        isProcessing={deleting}
      />
    </div>
  );
}
