import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2, ChevronDown, Play, Calendar, Mail as MailIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

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
  steps: SequenceStep[];
}

const VARIABLES = [
  { key: '{{first_name}}', label: 'First Name' },
  { key: '{{last_name}}', label: 'Last Name' },
  { key: '{{company}}', label: 'Company' },
  { key: '{{title}}', label: 'Title' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Phone' },
];

export function EmailSequencesTab() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [sequences, setSequences] = useState<SavedSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState<SavedSequence | null>(null);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [seqName, setSeqName] = useState('');
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
      .select('id, name, is_default, created_at')
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
        result.push({ ...seq, steps: (stepsData as SequenceStep[]) || [] });
      }
    }
    setSequences(result);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingSequence(null);
    setSeqName('');
    setSteps([
      { delay_days: 0, subject: '', body: '' },
      { delay_days: 3, subject: '', body: '' },
    ]);
    setShowBuilder(true);
  };

  const openEdit = (seq: SavedSequence) => {
    setEditingSequence(seq);
    setSeqName(seq.name);
    setSteps(seq.steps.length > 0 ? [...seq.steps] : [{ delay_days: 0, subject: '', body: '' }]);
    setShowBuilder(true);
  };

  const handleDuplicate = async (seq: SavedSequence) => {
    if (!currentWorkspace || !user) return;
    try {
      const { data: newSeq, error } = await supabase
        .from('follow_up_sequences')
        .insert({ workspace_id: currentWorkspace.id, created_by: user.id, name: `${seq.name} (Copy)` })
        .select('id')
        .single();
      if (error) throw error;

      const stepsToInsert = seq.steps.map((s, i) => ({
        sequence_id: newSeq.id,
        step_order: i,
        delay_days: s.delay_days,
        subject: s.subject,
        body: s.body,
      }));
      await supabase.from('follow_up_sequence_steps').insert(stepsToInsert);
      toast({ title: 'Sequence duplicated' });
      fetchSequences();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (seqId: string) => {
    await supabase.from('follow_up_sequence_steps').delete().eq('sequence_id', seqId);
    await supabase.from('follow_up_sequences').delete().eq('id', seqId);
    toast({ title: 'Sequence deleted' });
    fetchSequences();
  };

  const handleSave = async () => {
    if (!currentWorkspace || !user || !seqName.trim()) return;
    setSaving(true);
    try {
      let sequenceId: string;

      if (editingSequence) {
        // Update name
        await supabase.from('follow_up_sequences').update({ name: seqName }).eq('id', editingSequence.id);
        // Delete old steps and re-insert
        await supabase.from('follow_up_sequence_steps').delete().eq('sequence_id', editingSequence.id);
        sequenceId = editingSequence.id;
      } else {
        const { data, error } = await supabase
          .from('follow_up_sequences')
          .insert({ workspace_id: currentWorkspace.id, created_by: user.id, name: seqName })
          .select('id')
          .single();
        if (error) throw error;
        sequenceId = data.id;
      }

      const stepsToInsert = steps.map((s, i) => ({
        sequence_id: sequenceId,
        step_order: i,
        delay_days: s.delay_days,
        subject: s.subject,
        body: s.body,
      }));
      await supabase.from('follow_up_sequence_steps').insert(stepsToInsert);

      toast({ title: editingSequence ? 'Sequence updated' : 'Sequence created' });
      setShowBuilder(false);
      fetchSequences();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Sequences</h2>
          <p className="text-sm text-muted-foreground">Create and manage multi-step follow-up sequences</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No sequences created yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first email sequence to automate follow-ups</p>
            <Button onClick={openCreate} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sequences.map((seq) => (
            <Card key={seq.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{seq.name}</h3>
                      <Badge variant="secondary" className="text-xs">{seq.steps.length} steps</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {seq.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
                          <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                            {i + 1}
                          </div>
                          Day {step.delay_days}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(seq)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(seq)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(seq.id)}>
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
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSequence ? 'Edit Sequence' : 'Create Sequence'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input value={seqName} onChange={(e) => setSeqName(e.target.value)} placeholder="e.g. Post-Call Follow Up" />
            </div>

            {steps.map((step, i) => (
              <Card key={i} className="border-dashed">
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
                          onChange={(e) => updateStep(i, 'delay_days', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-sm"
                        />
                      </div>
                      {steps.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStep(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(i, 'subject', e.target.value)}
                    placeholder="Subject line"
                  />

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Body</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs h-6">
                            Insert Variable
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
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
                    <Textarea
                      value={step.body}
                      onChange={(e) => updateStep(i, 'body', e.target.value)}
                      placeholder="Email body..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" size="sm" onClick={addStep} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !seqName.trim() || steps.some(s => !s.subject.trim() || !s.body.trim())}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSequence ? 'Save Changes' : 'Create Sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
