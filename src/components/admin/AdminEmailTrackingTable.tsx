import { useState, useEffect } from 'react';
import { Loader2, Mail, Users, BarChart3, AlertTriangle, ArrowUpRight, Send, Reply } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export function AdminEmailTrackingTable() {
  const [loading, setLoading] = useState(true);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalInboxes: 0, totalSent: 0, totalReplied: 0, totalBounced: 0, totalFailed: 0, activeSequences: 0 });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    // Fetch all inboxes with provider and profile info
    const { data: inboxData } = await supabase
      .from('email_inboxes')
      .select('*, email_providers!inner(provider_type, provider_name, status)')
      .order('created_at', { ascending: false });

    const rawInboxes = (inboxData as any[]) || [];

    // Get workspace names
    const wsIds = [...new Set(rawInboxes.map(i => i.workspace_id))];
    let wsMap: Record<string, string> = {};
    if (wsIds.length > 0) {
      const { data: workspaces } = await supabase.from('workspaces').select('id, name').in('id', wsIds);
      (workspaces as any[] || []).forEach(w => { wsMap[w.id] = w.name; });
    }

    // Get assigned user names
    const userIds = [...new Set(rawInboxes.filter(i => i.assigned_to).map(i => i.assigned_to))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
      (profiles as any[] || []).forEach(p => { userMap[p.id] = p.full_name || p.email; });
    }

    const enrichedInboxes = rawInboxes.map(i => ({
      ...i,
      workspace_name: wsMap[i.workspace_id] || 'Unknown',
      assigned_name: i.assigned_to ? userMap[i.assigned_to] || 'Unknown' : 'Unassigned',
      provider_type: i.email_providers?.provider_type,
      provider_name: i.email_providers?.provider_name,
      provider_status: i.email_providers?.status,
    }));
    setInboxes(enrichedInboxes);

    // Fetch recent email logs (last 500)
    const { data: logs } = await supabase
      .from('email_logs')
      .select('id, subject, status, sent_at, provider, sent_by, workspace_id, lead_id, sequence_id, inbox_id, error_reason')
      .order('sent_at', { ascending: false })
      .limit(500);

    const allLogs = (logs as any[]) || [];

    // Enrich logs with sent_by names
    const senderIds = [...new Set(allLogs.map(l => l.sent_by))];
    let senderMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      (profiles as any[] || []).forEach(p => { senderMap[p.id] = p.full_name || 'Unknown'; });
    }

    setEmailLogs(allLogs.map(l => ({
      ...l,
      sender_name: senderMap[l.sent_by] || 'Unknown',
      workspace_name: wsMap[l.workspace_id] || 'Unknown',
    })));

    // Fetch active sequences
    const { data: activeFollowUps } = await supabase
      .from('active_follow_ups')
      .select('*, follow_up_sequences:sequence_id(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);

    setSequences((activeFollowUps as any[]) || []);

    // Calculate stats
    setStats({
      totalInboxes: enrichedInboxes.length,
      totalSent: allLogs.length,
      totalReplied: allLogs.filter(l => l.status === 'replied').length,
      totalBounced: allLogs.filter(l => l.status === 'bounced').length,
      totalFailed: allLogs.filter(l => l.status === 'failed').length,
      activeSequences: (activeFollowUps as any[] || []).length,
    });

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { className: string }> = {
      sent: { className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      delivered: { className: 'bg-green-500/10 text-green-600 border-green-500/20' },
      opened: { className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
      replied: { className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
      bounced: { className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      failed: { className: 'bg-destructive/10 text-destructive border-destructive/20' },
      active: { className: 'bg-green-500/10 text-green-600 border-green-500/20' },
      connected: { className: 'bg-green-500/10 text-green-600 border-green-500/20' },
      disconnected: { className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    return <Badge variant="outline" className={configs[status]?.className || ''}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Connected Inboxes', value: stats.totalInboxes, icon: Mail },
          { label: 'Emails Sent', value: stats.totalSent, icon: Send },
          { label: 'Replies', value: stats.totalReplied, icon: Reply },
          { label: 'Bounced', value: stats.totalBounced, icon: AlertTriangle },
          { label: 'Failed', value: stats.totalFailed, icon: AlertTriangle },
          { label: 'Active Sequences', value: stats.activeSequences, icon: ArrowUpRight },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="inboxes">
        <TabsList>
          <TabsTrigger value="inboxes">Connected Inboxes</TabsTrigger>
          <TabsTrigger value="activity">Email Activity</TabsTrigger>
          <TabsTrigger value="sequences">Active Sequences</TabsTrigger>
        </TabsList>

        <TabsContent value="inboxes" className="mt-4">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead>Sent Today</TableHead>
                    <TableHead>Warmup</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboxes.map(inbox => (
                    <TableRow key={inbox.id}>
                      <TableCell className="font-medium">{inbox.email_address}</TableCell>
                      <TableCell className="capitalize">{inbox.provider_name || inbox.provider_type}</TableCell>
                      <TableCell>{inbox.workspace_name}</TableCell>
                      <TableCell>{inbox.assigned_name}</TableCell>
                      <TableCell>{inbox.daily_send_limit}</TableCell>
                      <TableCell>{inbox.sends_today} / {inbox.daily_send_limit}</TableCell>
                      <TableCell>{inbox.warmup_enabled ? '✅' : '—'}</TableCell>
                      <TableCell>{getStatusBadge(inbox.status)}</TableCell>
                    </TableRow>
                  ))}
                  {inboxes.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No inboxes connected</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.slice(0, 100).map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell>{log.sender_name}</TableCell>
                      <TableCell>{log.workspace_name}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="capitalize">{log.provider}</TableCell>
                      <TableCell className="text-sm text-destructive">{log.error_reason || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{format(new Date(log.sent_at), 'MMM d, h:mm a')}</TableCell>
                    </TableRow>
                  ))}
                  {emailLogs.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No email activity</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="mt-4">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sequence</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Send</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequences.map((seq: any) => (
                    <TableRow key={seq.id}>
                      <TableCell className="font-medium">{seq.follow_up_sequences?.name || 'Unknown'}</TableCell>
                      <TableCell>Step {seq.current_step + 1}</TableCell>
                      <TableCell>{getStatusBadge(seq.status)}</TableCell>
                      <TableCell className="text-sm">{seq.next_send_at ? format(new Date(seq.next_send_at), 'MMM d, h:mm a') : '—'}</TableCell>
                      <TableCell className="text-sm">{format(new Date(seq.started_at), 'MMM d, h:mm a')}</TableCell>
                    </TableRow>
                  ))}
                  {sequences.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No active sequences</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
