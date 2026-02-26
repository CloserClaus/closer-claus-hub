import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Mail, Reply, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface EmailStats {
  totalSent: number;
  totalReplied: number;
  totalBounced: number;
  totalFailed: number;
  replyRate: number;
  bounceRate: number;
  dailyVolume: { date: string; count: number }[];
  byInbox: { email: string; sent: number; replied: number; bounced: number }[];
  bySDR: { name: string; sent: number; replied: number }[];
  topTemplates: { subject: string; sent: number; replied: number; rate: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function EmailAnalyticsTab() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) fetchStats();
  }, [currentWorkspace]);

  const fetchStats = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    const { data: logs } = await supabase
      .from('email_logs')
      .select('id, status, sent_at, sent_by, subject, inbox_id')
      .eq('workspace_id', currentWorkspace.id)
      .gte('sent_at', thirtyDaysAgo)
      .order('sent_at', { ascending: true });

    const allLogs = (logs as any[]) || [];
    const totalSent = allLogs.length;
    const totalReplied = allLogs.filter(l => l.status === 'replied').length;
    const totalBounced = allLogs.filter(l => l.status === 'bounced').length;
    const totalFailed = allLogs.filter(l => l.status === 'failed').length;

    // Daily volume
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM d');
      dailyMap[d] = 0;
    }
    allLogs.forEach(l => {
      const d = format(new Date(l.sent_at), 'MMM d');
      if (dailyMap[d] !== undefined) dailyMap[d]++;
    });
    const dailyVolume = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // By inbox
    const inboxIds = [...new Set(allLogs.filter(l => l.inbox_id).map(l => l.inbox_id))];
    let inboxMap: Record<string, string> = {};
    if (inboxIds.length > 0) {
      const { data: inboxes } = await supabase.from('email_inboxes').select('id, email_address').in('id', inboxIds);
      (inboxes as any[] || []).forEach(i => { inboxMap[i.id] = i.email_address; });
    }
    const inboxStats: Record<string, { sent: number; replied: number; bounced: number }> = {};
    allLogs.forEach(l => {
      if (!l.inbox_id) return;
      const email = inboxMap[l.inbox_id] || 'Unknown';
      if (!inboxStats[email]) inboxStats[email] = { sent: 0, replied: 0, bounced: 0 };
      inboxStats[email].sent++;
      if (l.status === 'replied') inboxStats[email].replied++;
      if (l.status === 'bounced') inboxStats[email].bounced++;
    });

    // By SDR
    const sdrIds = [...new Set(allLogs.map(l => l.sent_by))];
    let sdrMap: Record<string, string> = {};
    if (sdrIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', sdrIds);
      (profiles as any[] || []).forEach(p => { sdrMap[p.id] = p.full_name || 'Unknown'; });
    }
    const sdrStats: Record<string, { sent: number; replied: number }> = {};
    allLogs.forEach(l => {
      const name = sdrMap[l.sent_by] || 'Unknown';
      if (!sdrStats[name]) sdrStats[name] = { sent: 0, replied: 0 };
      sdrStats[name].sent++;
      if (l.status === 'replied') sdrStats[name].replied++;
    });

    // Top templates (by subject)
    const templateStats: Record<string, { sent: number; replied: number }> = {};
    allLogs.forEach(l => {
      if (!l.subject) return;
      const subj = l.subject.substring(0, 60);
      if (!templateStats[subj]) templateStats[subj] = { sent: 0, replied: 0 };
      templateStats[subj].sent++;
      if (l.status === 'replied') templateStats[subj].replied++;
    });

    setStats({
      totalSent, totalReplied, totalBounced, totalFailed,
      replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      dailyVolume,
      byInbox: Object.entries(inboxStats).map(([email, s]) => ({ email, ...s })),
      bySDR: Object.entries(sdrStats).map(([name, s]) => ({ name, ...s })),
      topTemplates: Object.entries(templateStats)
        .map(([subject, s]) => ({ subject, ...s, rate: s.sent > 0 ? (s.replied / s.sent) * 100 : 0 }))
        .sort((a, b) => b.sent - a.sent)
        .slice(0, 10),
    });
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!stats) return null;

  const pieData = [
    { name: 'Sent', value: stats.totalSent - stats.totalReplied - stats.totalBounced - stats.totalFailed },
    { name: 'Replied', value: stats.totalReplied },
    { name: 'Bounced', value: stats.totalBounced },
    { name: 'Failed', value: stats.totalFailed },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email Analytics</h2>
        <p className="text-sm text-muted-foreground">Last 30 days performance overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: stats.totalSent, icon: Mail },
          { label: 'Reply Rate', value: `${stats.replyRate.toFixed(1)}%`, icon: Reply },
          { label: 'Bounce Rate', value: `${stats.bounceRate.toFixed(1)}%`, icon: AlertTriangle },
          { label: 'Replies', value: stats.totalReplied, icon: TrendingUp },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Send Volume Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daily Send Volume</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval={4} />
              <YAxis className="text-xs" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inbox Performance */}
        <Card>
          <CardHeader><CardTitle className="text-base">Inbox Performance</CardTitle></CardHeader>
          <CardContent>
            {stats.byInbox.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No inbox data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.byInbox.map(inbox => (
                  <div key={inbox.email} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                    <span className="text-sm font-medium truncate max-w-[160px]">{inbox.email}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{inbox.sent} sent</span>
                      <span className="text-emerald-600">{inbox.replied} replies</span>
                      <span className="text-orange-600">{inbox.bounced} bounced</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SDR Performance */}
        <Card>
          <CardHeader><CardTitle className="text-base">SDR Performance</CardTitle></CardHeader>
          <CardContent>
            {stats.bySDR.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No SDR data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.bySDR.map(sdr => (
                  <div key={sdr.name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                    <span className="text-sm font-medium">{sdr.name}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{sdr.sent} sent</span>
                      <span className="text-emerald-600">{sdr.replied} replies</span>
                      <span>{sdr.sent > 0 ? ((sdr.replied / sdr.sent) * 100).toFixed(0) : 0}% rate</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Templates */}
      <Card>
        <CardHeader><CardTitle className="text-base">Best Performing Templates</CardTitle></CardHeader>
        <CardContent>
          {stats.topTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No template data yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topTemplates.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                  <span className="text-sm truncate max-w-[300px]">{t.subject}</span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{t.sent} sent</span>
                    <span className="text-emerald-600">{t.rate.toFixed(0)}% reply rate</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
