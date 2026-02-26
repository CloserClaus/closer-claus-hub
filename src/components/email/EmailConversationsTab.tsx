import { useState, useEffect } from 'react';
import { Loader2, MessageSquare, Send, StickyNote, ArrowLeft, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_email: string;
  campaign_name: string | null;
  status: string;
  assigned_to: string;
  assigned_name: string;
  last_message_preview: string | null;
  last_activity_at: string;
  inbox_email: string | null;
}

interface ConversationMessage {
  id: string;
  direction: string;
  subject: string | null;
  body: string;
  sender_email: string;
  message_type: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  replied: { label: 'Replied', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground border-muted' },
  paused: { label: 'Paused', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  bounced: { label: 'Bounced', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  error: { label: 'Error', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function EmailConversationsTab() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { assignedInbox } = useEmailInbox();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentWorkspace) fetchConversations();
  }, [currentWorkspace, statusFilter]);

  const fetchConversations = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    let query = supabase
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('last_activity_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convos = data as any[];
    const leadIds = [...new Set(convos.map(c => c.lead_id))];
    const userIds = [...new Set(convos.map(c => c.assigned_to))];
    const inboxIds = [...new Set(convos.filter(c => c.inbox_id).map(c => c.inbox_id))];

    const [{ data: leads }, { data: profiles }, { data: inboxes }] = await Promise.all([
      supabase.from('leads').select('id, first_name, last_name, email').in('id', leadIds),
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      inboxIds.length > 0 ? supabase.from('email_inboxes').select('id, email_address').in('id', inboxIds) : { data: [] },
    ]);

    const leadMap: Record<string, any> = {};
    (leads as any[] || []).forEach(l => { leadMap[l.id] = l; });
    const profileMap: Record<string, string> = {};
    (profiles as any[] || []).forEach(p => { profileMap[p.id] = p.full_name; });
    const inboxMap: Record<string, string> = {};
    (inboxes as any[] || []).forEach(i => { inboxMap[i.id] = i.email_address; });

    const enriched = convos.map(c => ({
      ...c,
      lead_name: leadMap[c.lead_id] ? `${leadMap[c.lead_id].first_name} ${leadMap[c.lead_id].last_name}` : 'Unknown',
      lead_email: leadMap[c.lead_id]?.email || '',
      assigned_name: profileMap[c.assigned_to] || 'Unknown',
      inbox_email: c.inbox_id ? inboxMap[c.inbox_id] || null : null,
    }));

    setConversations(enriched);
    setLoading(false);
  };

  const filtered = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.lead_name.toLowerCase().includes(q) || c.lead_email.toLowerCase().includes(q) || (c.campaign_name || '').toLowerCase().includes(q);
  });

  const openConversation = async (convo: Conversation) => {
    setSelectedConvo(convo);
    const { data } = await supabase
      .from('email_conversation_messages')
      .select('*')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true });
    setMessages((data as ConversationMessage[]) || []);
    setReplySubject(`Re: ${convo.last_message_preview || ''}`);
  };

  const handleSendReply = async () => {
    if (!selectedConvo || !replyBody.trim() || !assignedInbox || !currentWorkspace) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to_email: selectedConvo.lead_email,
          subject: replySubject,
          body: replyBody,
          lead_id: selectedConvo.lead_id,
          workspace_id: currentWorkspace.id,
        },
      });
      if (error) throw error;

      await supabase.from('email_conversation_messages').insert({
        conversation_id: selectedConvo.id,
        direction: 'outbound',
        subject: replySubject,
        body: replyBody,
        sender_email: assignedInbox.email_address,
        message_type: 'email',
      } as any);

      await supabase.from('email_conversations').update({
        last_message_preview: replyBody.substring(0, 100),
        last_activity_at: new Date().toISOString(),
      } as any).eq('id', selectedConvo.id);

      toast({ title: 'Reply sent' });
      setReplyBody('');
      openConversation(selectedConvo);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Send failed', description: err.message });
    } finally { setSending(false); }
  };

  const handleAddNote = async () => {
    if (!selectedConvo || !noteText.trim()) return;
    await supabase.from('email_conversation_messages').insert({
      conversation_id: selectedConvo.id,
      direction: 'internal',
      body: noteText,
      sender_email: 'internal',
      message_type: 'note',
    } as any);
    toast({ title: 'Note added' });
    setNoteText('');
    openConversation(selectedConvo);
  };

  // Thread detail view
  if (selectedConvo) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedConvo(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold">{selectedConvo.lead_name}</h2>
            <p className="text-sm text-muted-foreground">{selectedConvo.lead_email}</p>
          </div>
          {selectedConvo.campaign_name && (
            <Badge variant="secondary" className="text-xs">{selectedConvo.campaign_name}</Badge>
          )}
          <Badge variant="outline" className={STATUS_CONFIG[selectedConvo.status]?.className || ''}>
            {STATUS_CONFIG[selectedConvo.status]?.label || selectedConvo.status}
          </Badge>
        </div>

        {/* Activity Timeline / Thread */}
        <Card>
          <CardContent className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
            ) : messages.map(msg => (
              <div key={msg.id} className={`p-3 rounded-lg ${
                msg.message_type === 'note' ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' :
                msg.direction === 'outbound' ? 'bg-primary/5 border border-primary/10 ml-8' : 'bg-muted/50 border mr-8'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                    {msg.message_type === 'note' ? '📝 Internal Note' : msg.direction === 'outbound' ? '→ You' : `← ${msg.sender_email}`}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                </div>
                {msg.subject && <p className="text-sm font-medium mb-1">{msg.subject}</p>}
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reply Box */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder="Subject" />
            <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write your reply..." className="min-h-[100px]" />
            <div className="flex gap-2">
              <Button onClick={handleSendReply} disabled={sending || !replyBody.trim() || !assignedInbox}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Reply
              </Button>
              {!assignedInbox && <p className="text-sm text-destructive self-center">No inbox assigned to you.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add internal note..." className="min-h-[60px]" />
            <Button variant="outline" size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>
              <StickyNote className="h-4 w-4 mr-2" />Add Note
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Email Conversations</h2>
          <p className="text-sm text-muted-foreground">CRM-linked email threads with your leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-9"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No email conversations found</p>
            <p className="text-xs text-muted-foreground mt-1">Conversations are created when you send emails or start sequences</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Last Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned SDR</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openConversation(c)}>
                    <TableCell>
                      <p className="font-medium">{c.lead_name}</p>
                      <p className="text-xs text-muted-foreground">{c.lead_email}</p>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {c.last_message_preview || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CONFIG[c.status]?.className || ''}>
                        {STATUS_CONFIG[c.status]?.label || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.assigned_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.campaign_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.last_activity_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
