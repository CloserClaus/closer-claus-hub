import { useQuery } from '@tanstack/react-query';
import { Phone, Building2, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export function CallLogsTable() {
  const { data: callLogs, isLoading } = useQuery({
    queryKey: ['admin-call-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          workspaces(name),
          leads(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get caller profiles
      const callerIds = data?.map(c => c.caller_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', callerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(c => ({
        ...c,
        caller: profileMap.get(c.caller_id),
      })) || [];
    },
  });

  const statusColors: Record<string, string> = {
    initiated: 'bg-blue-500/20 text-blue-300',
    connected: 'bg-green-500/20 text-green-300',
    completed: 'bg-green-500/20 text-green-300',
    failed: 'bg-red-500/20 text-red-300',
    busy: 'bg-amber-500/20 text-amber-300',
    no_answer: 'bg-slate-500/20 text-slate-300',
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading call logs...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Recent Call Logs ({callLogs?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {callLogs && callLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {log.caller?.full_name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.leads ? (
                      `${(log.leads as any).first_name} ${(log.leads as any).last_name}`
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(log.workspaces as any)?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.phone_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDuration(log.duration_seconds)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[log.call_status] || ''}>
                      {log.call_status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No call logs yet</p>
        )}
      </CardContent>
    </Card>
  );
}