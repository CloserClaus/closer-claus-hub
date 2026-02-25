import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Monitor, Users, Eye, Clock, MapPin, Smartphone, Laptop, TrendingUp, BarChart3, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, startOfHour, differenceInSeconds, getDay, getHours } from 'date-fns';

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

// Simplified world map SVG path (equirectangular)
const WORLD_PATH = "M0,0 L900,0 L900,450 L0,450Z";

function WorldMap({ activeSessions, pageViews }: { activeSessions: any[]; pageViews: any[] }) {
  const width = 900;
  const height = 450;

  const toXY = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  });

  // Aggregate historical by country (use first lat/lng per country)
  const historicalDots = useMemo(() => {
    const byCountry: Record<string, { lat: number; lng: number; count: number }> = {};
    pageViews.forEach((pv: any) => {
      if (pv.latitude && pv.longitude) {
        const key = `${pv.latitude},${pv.longitude}`;
        if (!byCountry[key]) byCountry[key] = { lat: pv.latitude, lng: pv.longitude, count: 0 };
        byCountry[key].count++;
      }
    });
    return Object.values(byCountry);
  }, [pageViews]);

  const liveDots = useMemo(() => {
    return activeSessions.filter((s: any) => s.latitude && s.longitude).map((s: any) => ({
      lat: s.latitude, lng: s.longitude, session_id: s.session_id, path: s.current_path,
    }));
  }, [activeSessions]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-card border border-border">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ maxHeight: 340 }}>
        {/* Background */}
        <rect width={width} height={height} fill="hsl(var(--muted))" rx="8" opacity="0.3" />
        
        {/* Grid lines */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`vl-${i}`} x1={(i + 1) * (width / 8)} y1={0} x2={(i + 1) * (width / 8)} y2={height}
            stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
        ))}
        {Array.from({ length: 3 }, (_, i) => (
          <line key={`hl-${i}`} x1={0} y1={(i + 1) * (height / 4)} x2={width} y2={(i + 1) * (height / 4)}
            stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
        ))}

        {/* Continent outlines - simplified polygons */}
        {/* North America */}
        <polygon points="60,60 200,40 260,80 280,120 240,180 200,200 160,220 100,200 60,180 40,140 30,100"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* South America */}
        <polygon points="180,230 220,220 250,260 260,300 240,360 210,400 180,380 160,320 170,270"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Europe */}
        <polygon points="420,50 500,40 520,70 510,100 480,110 450,120 420,100 410,70"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Africa */}
        <polygon points="430,140 500,130 530,170 540,230 520,300 480,330 440,310 420,260 410,200 420,160"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Asia */}
        <polygon points="520,30 700,20 780,60 800,120 760,160 720,180 660,170 600,150 560,120 530,80"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Australia */}
        <polygon points="720,280 800,270 830,300 820,340 780,350 730,330 720,300"
          fill="hsl(var(--muted-foreground))" opacity="0.12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeOpacity="0.3" />

        {/* Historical dots (blue) */}
        {historicalDots.map((d, i) => {
          const { x, y } = toXY(d.lat, d.lng);
          const r = Math.min(3 + Math.log2(d.count + 1) * 2, 12);
          return (
            <g key={`h-${i}`}>
              <circle cx={x} cy={y} r={r} fill="hsl(var(--chart-2))" opacity="0.3" />
              <circle cx={x} cy={y} r={r * 0.6} fill="hsl(var(--chart-2))" opacity="0.5" />
              <title>{d.count} views</title>
            </g>
          );
        })}

        {/* Live dots (green, pulsing) */}
        {liveDots.map((d, i) => {
          const { x, y } = toXY(d.lat, d.lng);
          return (
            <g key={`l-${i}`}>
              <circle cx={x} cy={y} r="8" fill="hsl(142 76% 36%)" opacity="0.2">
                <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="4" fill="hsl(142 76% 36%)" opacity="0.8" />
              <title>{d.path} (live)</title>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(142_76%_36%)] animate-pulse" />
          Live users
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-2))] opacity-60" />
          Historical
        </div>
      </div>
    </div>
  );
}

// Peak Hours Heatmap Component
function PeakHoursHeatmap({ pageViews }: { pageViews: any[] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const grid = useMemo(() => {
    const data: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    pageViews.forEach((pv: any) => {
      const d = new Date(pv.created_at);
      const day = getDay(d);
      const hour = getHours(d);
      data[day][hour]++;
      if (data[day][hour] > max) max = data[day][hour];
    });
    return { data, max };
  }, [pageViews]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div className="flex gap-0.5">
          <div className="w-8" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-muted-foreground">{h}</div>
          ))}
        </div>
        {days.map((day, di) => (
          <div key={day} className="flex gap-0.5 mb-0.5">
            <div className="w-8 text-[9px] text-muted-foreground flex items-center">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const val = grid.data[di][h];
              const intensity = grid.max > 0 ? val / grid.max : 0;
              return (
                <div
                  key={h}
                  className="flex-1 aspect-square rounded-sm"
                  style={{
                    backgroundColor: intensity === 0
                      ? 'hsl(var(--muted))'
                      : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                  }}
                  title={`${day} ${h}:00 — ${val} views`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

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

  // === AGGREGATIONS ===
  const stats = useMemo(() => {
    const sessionMap: Record<string, any[]> = {};
    pageViews.forEach(pv => {
      if (!sessionMap[pv.session_id]) sessionMap[pv.session_id] = [];
      sessionMap[pv.session_id].push(pv);
    });
    const totalSessions = Object.keys(sessionMap).length;
    const bounceSessions = Object.values(sessionMap).filter(arr => arr.length === 1).length;
    const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;

    // Avg session duration
    let totalDuration = 0;
    let durationCount = 0;
    Object.values(sessionMap).forEach(views => {
      if (views.length >= 2) {
        const sorted = views.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const dur = differenceInSeconds(new Date(sorted[sorted.length - 1].created_at), new Date(sorted[0].created_at));
        totalDuration += dur;
        durationCount++;
      }
    });
    const avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    // Pages per session
    const pagesPerSession = totalSessions > 0 ? pageViews.length / totalSessions : 0;

    const uniqueUsers = new Set(pageViews.filter(pv => pv.user_id).map(pv => pv.user_id)).size;

    return {
      totalPageViews: pageViews.length,
      uniqueSessions: totalSessions,
      uniqueUsers,
      onlineNow: activeSessions.length,
      bounceRate,
      avgDuration,
      pagesPerSession,
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

  // Referrer breakdown
  const referrerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => {
      let source = 'Direct';
      if (pv.referrer) {
        try {
          const url = new URL(pv.referrer);
          const host = url.hostname.replace('www.', '');
          if (host.includes('google')) source = 'Google';
          else if (host.includes('facebook') || host.includes('fb.')) source = 'Facebook';
          else if (host.includes('twitter') || host.includes('x.com')) source = 'X/Twitter';
          else if (host.includes('linkedin')) source = 'LinkedIn';
          else if (host.includes('youtube')) source = 'YouTube';
          else if (host.includes('github')) source = 'GitHub';
          else source = host;
        } catch {
          source = 'Other';
        }
      }
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }));
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

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Site Analytics</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <Users className="h-3 w-3" /> Online Now
            </div>
            <div className="text-xl font-bold">{stats.onlineNow}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(142_76%_36%)] animate-pulse" />
              <span className="text-[9px] text-muted-foreground">Live</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <Eye className="h-3 w-3" /> Page Views
            </div>
            <div className="text-xl font-bold">{stats.totalPageViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <Monitor className="h-3 w-3" /> Sessions
            </div>
            <div className="text-xl font-bold">{stats.uniqueSessions.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <Users className="h-3 w-3" /> Users
            </div>
            <div className="text-xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <ArrowUpDown className="h-3 w-3" /> Bounce Rate
            </div>
            <div className="text-xl font-bold">{stats.bounceRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <Clock className="h-3 w-3" /> Avg Duration
            </div>
            <div className="text-xl font-bold">{formatDuration(stats.avgDuration)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
              <BarChart3 className="h-3 w-3" /> Pages/Session
            </div>
            <div className="text-xl font-bold">{stats.pagesPerSession.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* World Map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" /> Real-Time Visitor Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorldMap activeSessions={activeSessions} pageViews={pageViews} />
        </CardContent>
      </Card>

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

        {/* Referrer Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={referrerBreakdown} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={75} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Peak Hours Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PeakHoursHeatmap pageViews={pageViews} />
          </CardContent>
        </Card>

        {/* Geographic Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" /> By Country
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
            <span className="h-2 w-2 rounded-full bg-[hsl(142_76%_36%)] animate-pulse" />
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
