import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Monitor, Users, Eye, Clock, MapPin, Smartphone, Laptop } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, startOfHour } from 'date-fns';

function parseUserAgent(ua: string | null) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  
  let browser = 'Other';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'Other';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const device = (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) ? 'Mobile' : 
                 ua.includes('iPad') || ua.includes('Tablet') ? 'Tablet' : 'Desktop';

  return { browser, os, device };
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#ffc658',
];

export function SiteAnalytics() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const sinceDate = subDays(new Date(), periodDays).toISOString();

  // Fetch active sessions (live)
  const { data: activeSessions = [] } = useQuery({
    queryKey: ['admin-active-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .gte('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch page views for the period
  const { data: pageViews = [] } = useQuery({
    queryKey: ['admin-page-views', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch recent page views for the activity table
  const { data: recentViews = [] } = useQuery({
    queryKey: ['admin-recent-views'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Aggregations
  const stats = useMemo(() => {
    const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
    const uniqueUsers = new Set(pageViews.filter(pv => pv.user_id).map(pv => pv.user_id)).size;
    return {
      totalPageViews: pageViews.length,
      uniqueSessions,
      uniqueUsers,
      onlineNow: activeSessions.length,
    };
  }, [pageViews, activeSessions]);

  // Top pages
  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => { counts[pv.path] = (counts[pv.path] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
  }, [pageViews]);

  // Traffic over time
  const trafficOverTime = useMemo(() => {
    const useHourly = periodDays <= 7;
    const buckets: Record<string, number> = {};
    pageViews.forEach(pv => {
      const d = new Date(pv.created_at);
      const key = useHourly 
        ? format(startOfHour(d), 'MM/dd HH:00')
        : format(startOfDay(d), 'MM/dd');
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, views]) => ({ time, views }));
  }, [pageViews, periodDays]);

  // Country breakdown
  const countryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => {
      const c = pv.country || 'Unknown';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([country, count]) => ({ country, count }));
  }, [pageViews]);

  // Device/browser stats
  const deviceStats = useMemo(() => {
    const browsers: Record<string, number> = {};
    const devices: Record<string, number> = {};
    const oses: Record<string, number> = {};
    pageViews.forEach(pv => {
      const { browser, os, device } = parseUserAgent(pv.user_agent);
      browsers[browser] = (browsers[browser] || 0) + 1;
      devices[device] = (devices[device] || 0) + 1;
      oses[os] = (oses[os] || 0) + 1;
    });
    const toArr = (obj: Record<string, number>) =>
      Object.entries(obj).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
    return { browsers: toArr(browsers), devices: toArr(devices), oses: toArr(oses) };
  }, [pageViews]);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Site Analytics</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Online Now
            </div>
            <div className="text-2xl font-bold">{stats.onlineNow}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Live</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Eye className="h-3.5 w-3.5" /> Page Views
            </div>
            <div className="text-2xl font-bold">{stats.totalPageViews.toLocaleString()}</div>
            <span className="text-[10px] text-muted-foreground">Last {periodDays}d</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Monitor className="h-3.5 w-3.5" /> Unique Sessions
            </div>
            <div className="text-2xl font-bold">{stats.uniqueSessions.toLocaleString()}</div>
            <span className="text-[10px] text-muted-foreground">Last {periodDays}d</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Auth'd Users
            </div>
            <div className="text-2xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
            <span className="text-[10px] text-muted-foreground">Last {periodDays}d</span>
          </CardContent>
        </Card>
      </div>

      {/* Traffic over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Traffic Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trafficOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPages} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="path" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={75} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" /> By Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {countryBreakdown.map((item, i) => (
                <div key={item.country} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5 text-right text-xs">{i + 1}.</span>
                    <span>{item.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5"
                        style={{ width: `${(item.count / (countryBreakdown[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs w-10 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
              {countryBreakdown.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Browsers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Browsers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceStats.browsers} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {deviceStats.browsers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceStats.devices} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {deviceStats.devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* OS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Laptop className="h-4 w-4" /> Operating Systems
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceStats.oses} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {deviceStats.oses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Users List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Active Users ({activeSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Current Page</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active users right now
                    </TableCell>
                  </TableRow>
                )}
                {activeSessions.map((s: any) => {
                  const { browser, device } = parseUserAgent(s.user_agent);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.session_id?.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{s.current_path}</Badge>
                      </TableCell>
                      <TableCell>{s.country || '—'}</TableCell>
                      <TableCell className="text-xs">{browser} / {device}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.last_seen_at), 'HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Page Views</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Screen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentViews.map((pv: any) => {
                  const { browser, device } = parseUserAgent(pv.user_agent);
                  return (
                    <TableRow key={pv.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(pv.created_at), 'MM/dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{pv.path}</Badge>
                      </TableCell>
                      <TableCell>{pv.country || '—'}</TableCell>
                      <TableCell className="text-xs">{browser} / {device}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {pv.screen_width && pv.screen_height ? `${pv.screen_width}×${pv.screen_height}` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
