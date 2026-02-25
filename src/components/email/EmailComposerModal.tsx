import { useState, useEffect } from 'react';
import { Send, X, ChevronDown, Loader2 } from 'lucide-react';
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
    body: `Hi {{first_name}},

It was great connecting with you today. I wanted to follow up on our conversation and share a few key points we discussed.

I believe we can help {{company}} achieve great results. Let me know if you'd like to schedule a follow-up to dive deeper.

Looking forward to hearing from you!

Best regards`,
  },
  {
    name: 'Meeting Confirmation',
    subject: 'Meeting Confirmed — {{first_name}}',
    body: `Hi {{first_name}},

Just confirming our upcoming meeting. Looking forward to discussing how we can support {{company}}.

If anything changes, feel free to let me know.

See you soon!`,
  },
  {
    name: 'Checking Back In',
    subject: 'Checking in, {{first_name}}',
    body: `Hi {{first_name}},

I wanted to check back in and see if you had any thoughts on our previous conversation.

I understand things get busy — happy to work around your schedule whenever it makes sense to reconnect.

Let me know how you'd like to proceed.

Best,`,
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
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [connections, setConnections] = useState<{ id: string; provider: string; provider_name: string | null }[]>([]);
  const [selectedConnection, setSelectedConnection] = useState('');

  useEffect(() => {
    if (open && currentWorkspace && user) {
      fetchTemplates();
      fetchConnections();
    }
  }, [open, currentWorkspace]);

  const fetchTemplates = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, subject, body')
      .eq('workspace_id', currentWorkspace.id);
    setSavedTemplates((data as EmailTemplate[]) || []);
  };

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

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, lead.first_name || '')
      .replace(/\{\{last_name\}\}/g, lead.last_name || '')
      .replace(/\{\{company\}\}/g, lead.company || '')
      .replace(/\{\{title\}\}/g, lead.title || '')
      .replace(/\{\{email\}\}/g, lead.email || '')
      .replace(/\{\{phone\}\}/g, lead.phone || '');
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + variable);
  };

  const loadTemplate = (template: Omit<EmailTemplate, 'id'>) => {
    setSubject(template.subject);
    setBody(template.body);
  };

  const handleSend = async () => {
    if (!lead.email) {
      toast({ variant: 'destructive', title: 'No email address', description: 'This lead does not have an email address.' });
      return;
    }
    if (!selectedConnection) {
      toast({ variant: 'destructive', title: 'No provider selected', description: 'Please select an email provider or connect one in Settings.' });
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
      const connection = connections.find(c => c.id === selectedConnection);

      // Log the email
      const { error } = await supabase.from('email_logs').insert({
        workspace_id: currentWorkspace!.id,
        lead_id: lead.id,
        sent_by: user!.id,
        provider: connection?.provider || 'other',
        subject: finalSubject,
        body: finalBody,
        status: 'sent',
      });

      if (error) throw error;

      // Update lead's last_contacted_at
      await supabase
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead.id);

      toast({ title: 'Email sent', description: `Email sent to ${lead.email} via ${connection?.provider_name || connection?.provider || 'provider'}.` });
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
          {/* Provider selector */}
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
              No email provider connected. Go to Settings → Email to connect one.
            </div>
          )}

          {/* To */}
          <div className="space-y-2">
            <Label>To</Label>
            <Input value={lead.email || 'No email address'} disabled className="bg-muted" />
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select onValueChange={(val) => {
              const tmpl = allTemplates.find(t => t.id === val);
              if (tmpl) loadTemplate(tmpl);
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

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter email subject" />
          </div>

          {/* Body */}
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
                    <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key)}>
                      {v.label} <span className="ml-auto text-xs text-muted-foreground">{v.key}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="min-h-[200px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !lead.email || connections.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
