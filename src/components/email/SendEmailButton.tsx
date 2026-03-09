import { useState } from 'react';
import { Mail, PlayCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';

interface SendEmailButtonProps {
  leadId: string;
  leadEmail: string;
  leadName: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showSequenceButton?: boolean;
}

export function SendEmailButton({ leadId, leadEmail, leadName, variant = 'outline', size = 'sm', showSequenceButton = true }: SendEmailButtonProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { assignedInbox, canSendEmail } = useEmailInbox();
  const { toast } = useToast();

  const [showComposer, setShowComposer] = useState(false);
  const [showSequencePicker, setShowSequencePicker] = useState(false);
  const [showNoInboxWarning, setShowNoInboxWarning] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sequences, setSequences] = useState<any[]>([]);
  const [selectedSequence, setSelectedSequence] = useState('');
  const [startingSequence, setStartingSequence] = useState(false);

  const handleSendClick = () => {
    if (!canSendEmail) {
      setShowNoInboxWarning(true);
      return;
    }
    setSubject('');
    setBody('');
    setShowComposer(true);
  };

  const handleSequenceClick = async () => {
    if (!canSendEmail) {
      setShowNoInboxWarning(true);
      return;
    }
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('follow_up_sequences')
      .select('id, name')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setSequences((data as any[]) || []);
    setSelectedSequence('');
    setShowSequencePicker(true);
  };

  const handleSend = async () => {
    if (!currentWorkspace || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      // Check opt-out before sending
      const { data: leadCheck } = await supabase.from('leads').select('opted_out').eq('id', leadId).single();
      if ((leadCheck as any)?.opted_out) {
        toast({ variant: 'destructive', title: 'Lead opted out', description: 'This lead has unsubscribed from emails.' });
        setSending(false);
        setShowComposer(false);
        return;
      }
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to_email: leadEmail, subject, body, lead_id: leadId, workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      toast({ title: 'Email sent', description: `Sent to ${leadName}` });
      setShowComposer(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Send failed', description: err.message });
    } finally { setSending(false); }
  };

  const handleStartSequence = async () => {
    if (!currentWorkspace || !selectedSequence || !user) return;
    setStartingSequence(true);
    try {
      // Check if lead already has an active sequence or opted out
      const { data: leadData } = await supabase
        .from('leads')
        .select('email_sending_state, opted_out')
        .eq('id', leadId)
        .single();

      if ((leadData as any)?.opted_out) {
        toast({ variant: 'destructive', title: 'Lead opted out', description: 'This lead has unsubscribed from emails.' });
        setStartingSequence(false);
        return;
      }

      if (leadData?.email_sending_state === 'active_sequence') {
        toast({ variant: 'destructive', title: 'Sequence already active', description: 'This lead already has an active email sequence.' });
        setStartingSequence(false);
        return;
      }

      // Fetch sequence steps to send first email immediately
      const { data: seqSteps } = await supabase
        .from('follow_up_sequence_steps')
        .select('delay_days, subject, body')
        .eq('sequence_id', selectedSequence)
        .order('step_order', { ascending: true });

      const steps = (seqSteps as any[]) || [];
      const seqName = sequences.find(s => s.id === selectedSequence)?.name || null;

      // Create active follow-up with LOCKED sender identity
      const { error } = await supabase.from('active_follow_ups').insert({
        workspace_id: currentWorkspace.id,
        sequence_id: selectedSequence,
        lead_id: leadId,
        started_by: user.id,
        status: 'active',
        current_step: 0,
        sender_inbox_id: assignedInbox?.id || null,
        sender_provider_id: assignedInbox?.provider_id || null,
        next_send_at: new Date().toISOString(),
      } as any);
      if (error) throw error;

      // Update lead state
      await supabase.from('leads').update({ email_sending_state: 'active_sequence' } as any).eq('id', leadId);

      // Send first email immediately if step 0 exists
      let resolvedSubject = '';
      let resolvedBody = '';
      if (steps.length > 0) {
        const replaceVars = (text: string) =>
          text.replace(/\{\{first_name\}\}/g, leadName.split(' ')[0] || '');
        resolvedSubject = replaceVars(steps[0].subject);
        resolvedBody = replaceVars(steps[0].body);

        await supabase.functions.invoke('send-email', {
          body: {
            workspace_id: currentWorkspace.id,
            to_email: leadEmail,
            subject: resolvedSubject,
            body: resolvedBody,
            lead_id: leadId,
            sequence_id: selectedSequence,
            sequence_step: 0,
          },
        });
      }

      // Create email conversation with preview
      const { data: newConvo } = await supabase.from('email_conversations').insert({
        workspace_id: currentWorkspace.id,
        lead_id: leadId,
        assigned_to: user.id,
        inbox_id: assignedInbox?.id || null,
        sequence_id: selectedSequence,
        campaign_name: seqName,
        status: 'active',
        last_message_preview: resolvedBody ? resolvedBody.substring(0, 100) : null,
        last_activity_at: new Date().toISOString(),
      } as any).select('id').single();

      // Insert first message into conversation
      if (newConvo && resolvedSubject) {
        await supabase.from('email_conversation_messages').insert({
          conversation_id: newConvo.id,
          direction: 'outbound',
          subject: resolvedSubject,
          body: resolvedBody,
          sender_email: assignedInbox?.email_address || 'unknown',
          message_type: 'email',
        } as any);
      }

      toast({ title: 'Sequence started', description: `Sequence started for ${leadName}` });
      setShowSequencePicker(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    } finally { setStartingSequence(false); }
  };

  return (
    <>
      <div className="flex gap-1">
        <Button variant={variant} size={size} onClick={handleSendClick}>
          <Mail className="h-3.5 w-3.5 mr-1" />Email
        </Button>
        {showSequenceButton && (
          <Button variant={variant} size={size} onClick={handleSequenceClick}>
            <PlayCircle className="h-3.5 w-3.5 mr-1" />Sequence
          </Button>
        )}
      </div>

      {/* No Inbox Warning */}
      <Dialog open={showNoInboxWarning} onOpenChange={setShowNoInboxWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />No Inbox Assigned
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You don't have an email inbox assigned to your account. Contact your agency owner to assign an inbox before sending emails.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoInboxWarning(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Composer */}
      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Send Email to {leadName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              From: {assignedInbox?.email_address || 'Unknown'} → To: {leadEmail}
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email..." className="min-h-[150px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposer(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sequence Picker */}
      <Dialog open={showSequencePicker} onOpenChange={setShowSequencePicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Start Sequence for {leadName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              This will start an automated email sequence to {leadEmail}. The sequence will stop automatically when a reply is detected.
            </div>
            <div className="space-y-2">
              <Label>Select Sequence</Label>
              <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                <SelectTrigger><SelectValue placeholder="Choose a sequence" /></SelectTrigger>
                <SelectContent>
                  {sequences.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {sequences.length === 0 && (
              <p className="text-sm text-muted-foreground">No sequences created yet. Go to Email → Campaigns to create one.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSequencePicker(false)}>Cancel</Button>
            <Button onClick={handleStartSequence} disabled={startingSequence || !selectedSequence}>
              {startingSequence ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Start Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
