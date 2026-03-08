import { useState, useEffect } from 'react';
import { Send, ChevronDown, Loader2, AlertCircle, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface EmailComposerModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onEmailSent?: () => void;
}

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id'>[] = [
  {
    name: 'Call Follow-Up',
    subject: 'Great speaking with you, {{first_name}}',
    body: `Hi {{first_name}},\n\nIt was great connecting with you today. I wanted to follow up on our conversation and share a few key points we discussed.\n\nI believe we can help {{company}} achieve great results. Let me know if you'd like to schedule a follow-up to dive deeper.\n\nLooking forward to hearing from you!\n\nBest regards`,
  },
  {
    name: 'Meeting Confirmation',
    subject: 'Meeting Confirmed — {{first_name}}',
    body: `Hi {{first_name}},\n\nJust confirming our upcoming meeting. Looking forward to discussing how we can support {{company}}.\n\nIf anything changes, feel free to let me know.\n\nSee you soon!`,
  },
  {
    name: 'Checking Back In',
    subject: 'Checking in, {{first_name}}',
    body: `Hi {{first_name}},\n\nI wanted to check back in and see if you had any thoughts on our previous conversation.\n\nI understand things get busy — happy to work around your schedule whenever it makes sense to reconnect.\n\nLet me know how you'd like to proceed.\n\nBest,`,
  },
];

const VARIABLES = [
  { key: '{{first_name}}', label: 'First Name' },
  { key: '{{last_name}}', label: 'Last Name' },
  { key: '{{company}}', label: 'Company' },
  { key: '{{title}}', label: 'Title' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Phone' },
];

export function EmailComposerModal({ open, onClose, lead, onEmailSent }: EmailComposerModalProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { assignedInbox, canSendEmail, loading: inboxLoading } = useEmailInbox();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    if (open && currentWorkspace) fetchTemplates();
  }, [open, currentWorkspace]);

  const fetchTemplates = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, subject, body')
      .eq('workspace_id', currentWorkspace.id);
    setSavedTemplates((data as EmailTemplate[]) || []);
  };

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, lead.first_name || '')
      .replace(/\{\{last_name\}\}/g, lead.last_name || '')
      .replace(/\{\{company\}\}/g, lead.company || '')
      .replace(/\{\{title\}\}/g, lead.title || '')
      .replace(/\{\{email\}\}/g, lead.email || '')
      .replace(/\{\{phone\}\}/g, lead.phone || '');
  };

  const handleSend = async () => {
    if (!lead.email || !currentWorkspace || !user) return;

    // Check opt-out status before sending
    const { data: freshLead } = await supabase
      .from('leads')
      .select('opted_out')
      .eq('id', lead.id)
      .single();
    if ((freshLead as any)?.opted_out) {
      toast({ variant: 'destructive', title: 'Lead opted out', description: 'This lead has unsubscribed and cannot receive emails.' });
      return;
    }

    if (!canSendEmail) {
      toast({ variant: 'destructive', title: 'No inbox assigned', description: 'You need an assigned inbox to send emails.' });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in both subject and body.' });
      return;
    }

    setSending(true);
    try {
      const finalSubject = replaceVariables(subject);
      const finalBody = replaceVariables(body);

      // Server-side routing — no inbox passed from frontend
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          workspace_id: currentWorkspace.id,
          to_email: lead.email,
          subject: finalSubject,
          body: finalBody,
          lead_id: lead.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Email sent', description: `Sent to ${lead.email} via ${assignedInbox?.provider_name || 'provider'}.` });
      onEmailSent?.();
      onClose();
      setSubject('');
      setBody('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to send', description: error.message });
    } finally {
      setSending(false);
    }
  };

  const allTemplates = [...DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `default-${i}` })), ...savedTemplates];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sending inbox display */}
          {assignedInbox ? (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <span className="text-muted-foreground">Sending from:</span>{' '}
              <strong>{assignedInbox.email_address}</strong>
              <span className="text-muted-foreground ml-2">({assignedInbox.provider_name})</span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No inbox assigned to you. Contact your agency owner to assign an inbox.
            </div>
          )}

          <div className="space-y-2">
            <Label>To</Label>
            <Input value={lead.email || 'No email address'} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select onValueChange={(val) => {
              const tmpl = allTemplates.find(t => t.id === val);
              if (tmpl) { setSubject(tmpl.subject); setBody(tmpl.body); }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {allTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter email subject" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    Insert Variable
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {VARIABLES.map((v) => (
                    <DropdownMenuItem key={v.key} onClick={() => setBody(prev => prev + v.key)}>
                      {v.label} <span className="ml-auto text-xs text-muted-foreground">{v.key}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email..." className="min-h-[200px]" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {subject.trim() && body.trim() && (
              <Button variant="ghost" size="sm" onClick={async () => {
                if (!currentWorkspace || !user) return;
                const templateName = prompt('Template name:');
                if (!templateName?.trim()) return;
                await supabase.from('email_templates').insert({
                  workspace_id: currentWorkspace.id,
                  created_by: user.id,
                  name: templateName,
                  subject,
                  body,
                } as any);
                toast({ title: 'Saved as template' });
                fetchTemplates();
              }}>
                <Save className="h-4 w-4 mr-1" />Save as Template
              </Button>
            )}
            <Button onClick={handleSend} disabled={sending || !lead.email || !canSendEmail}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
