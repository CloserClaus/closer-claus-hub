import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, Mail, ArrowUpRight, Eye, Reply, Send, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

interface EmailLogEntry {
  id: string;
  subject: string;
  status: string;
  sent_at: string;
  provider: string;
  lead_id: string | null;
  sequence_id: string | null;
  inbox_id: string | null;
  lead_name?: string;
  sequence_name?: string;
  inbox_email?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  sent: { label: 'Sent', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: Send },
  delivered: { label: 'Delivered', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20', icon: ArrowUpRight },
  opened: { label: 'Opened', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Eye },
  replied: { label: 'Replied', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: Reply },
  bounced: { label: 'Bounced', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', icon: AlertTriangle },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: Mail },
};

export function EmailActivityTab() {
  const { currentWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) fetchLogs();
  }, [currentWorkspace]);

  const fetchLogs = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const { data: emailLogs } = await supabase
      .from('email_logs')
      .select('id, subject, status, sent_at, provider, lead_id, sequence_id, inbox_id')
      .eq('workspace_id', currentWorkspace.id)
      .order('sent_at', { ascending: false })
      .limit(100);

    if (!emailLogs) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const leadIds = [...new Set((emailLogs as any[]).filter(l => l.lead_id).map(l => l.lead_id))];
    const sequenceIds = [...new Set((emailLogs as any[]).filter(l => l.sequence_id).map(l => l.sequence_id))];
    const inboxIds = [...new Set((emailLogs as any[]).filter(l => l.inbox_id).map(l => l.inbox_id))];

    let leadMap: Record<string, string> = {};
    let seqMap: Record<string, string> = {};
    let inboxMap: Record<string, string> = {};

    if (leadIds.length > 0) {
      const { data: leads } = await supabase.from('leads').select('id, first_name, last_name').in('id', leadIds);
      if (leads) leads.forEach((l: any) => { leadMap[l.id] = `${l.first_name} ${l.last_name}`; });
    }

    if (sequenceIds.length > 0) {
      const { data: seqs } = await supabase.from('follow_up_sequences').select('id, name').in('id', sequenceIds);
      if (seqs) (seqs as any[]).forEach((s) => { seqMap[s.id] = s.name; });
    }

    if (inboxIds.length > 0) {
      const { data: inboxes } = await supabase.from('email_inboxes').select('id, email_address').in('id', inboxIds);
      if (inboxes) (inboxes as any[]).forEach((i) => { inboxMap[i.id] = i.email_address; });
    }

    setLogs((emailLogs as any[]).map(log => ({
      ...log,
      lead_name: log.lead_id ? leadMap[log.lead_id] || 'Unknown' : '—',
      sequence_name: log.sequence_id ? seqMap[log.sequence_id] || '—' : '—',
      inbox_email: log.inbox_id ? inboxMap[log.inbox_id] || '—' : '—',
    })));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">No email activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">Emails sent from the platform will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Email Activity</h2>
        <p className="text-sm text-muted-foreground">Track all emails sent across all providers and inboxes</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inbox</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.sent;
                const StatusIcon = config.icon;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.lead_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={config.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{log.inbox_email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{log.sequence_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(log.sent_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
