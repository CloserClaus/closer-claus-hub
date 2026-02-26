import { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Loader2, Calendar, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface SequenceStep {
  delay_days: number;
  subject: string;
  body: string;
}

interface SavedSequence {
  id: string;
  name: string;
  is_default: boolean;
  steps: SequenceStep[];
}

interface FollowUpSequenceModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onSequenceStarted?: () => void;
}

const DEFAULT_SEQUENCES: { name: string; steps: SequenceStep[] }[] = [
  {
    name: '3-Day Follow-Up',
    steps: [
      { delay_days: 0, subject: 'Following up — {{first_name}}', body: 'Hi {{first_name}},\n\nJust wanted to follow up on our recent conversation. Would love to hear your thoughts.\n\nBest,' },
      { delay_days: 3, subject: 'Quick check-in', body: 'Hi {{first_name}},\n\nI wanted to circle back and see if you had a chance to think about our discussion. Happy to answer any questions.\n\nBest,' },
    ],
  },
  {
    name: '5-Day Follow-Up',
    steps: [
      { delay_days: 0, subject: 'Following up — {{first_name}}', body: 'Hi {{first_name}},\n\nGreat connecting with you. Wanted to share some additional thoughts on how we can help {{company}}.\n\nBest,' },
      { delay_days: 3, subject: 'A few more thoughts', body: 'Hi {{first_name}},\n\nI had a few additional ideas I wanted to share with you regarding our conversation.\n\nWould you be open to a quick follow-up?\n\nBest,' },
      { delay_days: 5, subject: 'Last follow-up', body: 'Hi {{first_name}},\n\nI don\'t want to be a bother — just wanted to check in one last time. Let me know if the timing isn\'t right and I\'ll check back later.\n\nBest,' },
    ],
  },
];

export function FollowUpSequenceModal({ open, onClose, lead, onSequenceStarted }: FollowUpSequenceModalProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('preset');
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [customSteps, setCustomSteps] = useState<SequenceStep[]>([
    { delay_days: 0, subject: '', body: '' },
    { delay_days: 3, subject: '', body: '' },
  ]);
  const [customName, setCustomName] = useState('');
  const [connections, setConnections] = useState<{ id: string; provider: string; provider_name: string | null }[]>([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  useEffect(() => {
    if (open && currentWorkspace) {
      fetchSequences();
      fetchConnections();
    }
  }, [open, currentWorkspace]);

  const fetchConnections = async () => {
    if (!currentWorkspace || !user) return;
    const { data } = await supabase
      .from('email_connections')
      .select('id, provider, provider_name')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .eq('is_active', true);
    const conns = (data as any[]) || [];
    setConnections(conns);
    if (conns.length === 1) setSelectedConnection(conns[0].id);
  };

  const fetchSequences = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data: seqs } = await supabase
      .from('follow_up_sequences')
      .select('id, name, is_default')
      .eq('workspace_id', currentWorkspace.id);

    const sequences: SavedSequence[] = [];
    if (seqs) {
      for (const seq of seqs as any[]) {
        const { data: steps } = await supabase
          .from('follow_up_sequence_steps')
          .select('delay_days, subject, body')
          .eq('sequence_id', seq.id)
          .order('step_order', { ascending: true });
        sequences.push({ ...seq, steps: (steps as SequenceStep[]) || [] });
      }
    }
    setSavedSequences(sequences);
    setLoading(false);
  };

  const startSequence = async (name: string, steps: SequenceStep[]) => {
    if (!lead.email) {
      toast({ variant: 'destructive', title: 'No email', description: 'This lead has no email address.' });
      return;
    }
    if (!currentWorkspace || !user) return;

    setStarting(true);
    try {
      // Create or find sequence
      let sequenceId: string;
      const { data: existingSeq } = await supabase
        .from('follow_up_sequences')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('name', name)
        .eq('created_by', user.id)
        .maybeSingle();

      if (existingSeq) {
        sequenceId = existingSeq.id;
      } else {
        const { data: newSeq, error } = await supabase
          .from('follow_up_sequences')
          .insert({ workspace_id: currentWorkspace.id, created_by: user.id, name })
          .select('id')
          .single();
        if (error) throw error;
        sequenceId = newSeq.id;

        // Insert steps
        const stepsToInsert = steps.map((s, i) => ({
          sequence_id: sequenceId,
          step_order: i,
          delay_days: s.delay_days,
          subject: s.subject,
          body: s.body,
        }));
        const { error: stepsError } = await supabase.from('follow_up_sequence_steps').insert(stepsToInsert);
        if (stepsError) throw stepsError;
      }

      // Create active follow-up
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + steps[0].delay_days);

      const { error: afError } = await supabase.from('active_follow_ups').insert({
        workspace_id: currentWorkspace.id,
        lead_id: lead.id,
        sequence_id: sequenceId,
        started_by: user.id,
        current_step: 0,
        status: 'active',
        next_send_at: nextSendAt.toISOString(),
      });
      if (afError) throw afError;

      // Log the first email
      await supabase.from('email_logs').insert({
        workspace_id: currentWorkspace.id,
        lead_id: lead.id,
        sent_by: user.id,
        provider: 'sequence',
        subject: steps[0].subject.replace(/\{\{first_name\}\}/g, lead.first_name),
        body: steps[0].body,
        status: 'sent',
        sequence_id: sequenceId,
        sequence_step: 0,
      });

      toast({ title: 'Sequence started', description: `"${name}" sequence started for ${lead.first_name} ${lead.last_name}.` });
      onSequenceStarted?.();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to start sequence', description: error.message });
    } finally {
      setStarting(false);
    }
  };

  const addCustomStep = () => {
    const lastDay = customSteps[customSteps.length - 1]?.delay_days || 0;
    setCustomSteps([...customSteps, { delay_days: lastDay + 3, subject: '', body: '' }]);
  };

  const removeCustomStep = (index: number) => {
    if (customSteps.length <= 1) return;
    setCustomSteps(customSteps.filter((_, i) => i !== index));
  };

  const updateCustomStep = (index: number, field: keyof SequenceStep, value: any) => {
    const updated = [...customSteps];
    (updated[index] as any)[field] = value;
    setCustomSteps(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Start Follow-Up Sequence
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Select a sequence for <strong>{lead.first_name} {lead.last_name}</strong>
        </p>

        {connections.length > 1 && (
          <div className="space-y-2">
            <Label>Send via</Label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.provider_name || c.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {connections.length === 0 && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            Connect an email provider to send emails. Go to Email → Connections.
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset">Preset Sequences</TabsTrigger>
            <TabsTrigger value="custom">Custom Sequence</TabsTrigger>
          </TabsList>

          <TabsContent value="preset" className="space-y-3 mt-4">
            {DEFAULT_SEQUENCES.map((seq, i) => (
              <Card key={i} className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{seq.name}</h4>
                    <Badge variant="secondary">{seq.steps.length} emails</Badge>
                  </div>
                  <div className="space-y-2 mb-4">
                    {seq.steps.map((step, si) => (
                      <div key={si} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {si + 1}
                        </div>
                        <span>Day {step.delay_days}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="truncate">{step.subject}</span>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => startSequence(seq.name, seq.steps)} disabled={starting}>
                    {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Start Sequence
                  </Button>
                </CardContent>
              </Card>
            ))}

            {/* Saved sequences */}
            {savedSequences.map((seq) => (
              <Card key={seq.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{seq.name}</h4>
                    <Badge variant="secondary">{seq.steps.length} emails</Badge>
                  </div>
                  <Button size="sm" onClick={() => startSequence(seq.name, seq.steps)} disabled={starting}>
                    {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Start Sequence
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. My Follow-Up" />
            </div>

            {customSteps.map((step, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">Email {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Day</Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.delay_days}
                          onChange={(e) => updateCustomStep(i, 'delay_days', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-sm"
                        />
                      </div>
                      {customSteps.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCustomStep(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input value={step.subject} onChange={(e) => updateCustomStep(i, 'subject', e.target.value)} placeholder="Subject line" />
                  <Textarea value={step.body} onChange={(e) => updateCustomStep(i, 'body', e.target.value)} placeholder="Email body..." className="min-h-[80px]" />
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" size="sm" onClick={addCustomStep} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => startSequence(customName || 'Custom Sequence', customSteps)}
                disabled={starting || customSteps.some(s => !s.subject.trim() || !s.body.trim())}
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Start Sequence
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
