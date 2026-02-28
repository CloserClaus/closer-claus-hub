import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";

export function EventInspector() {
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("7d");

  const getDateStart = () => {
    const now = new Date();
    switch (dateFilter) {
      case "1h": return new Date(now.getTime() - 3600000);
      case "24h": return new Date(now.getTime() - 86400000);
      case "7d": return new Date(now.getTime() - 7 * 86400000);
      case "30d": return new Date(now.getTime() - 30 * 86400000);
      default: return new Date(now.getTime() - 7 * 86400000);
    }
  };

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["system-events", eventTypeFilter, actorFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("system_events")
        .select("*")
        .gte("created_at", getDateStart().toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (eventTypeFilter) {
        query = query.ilike("event_type", `%${eventTypeFilter}%`);
      }
      if (actorFilter) {
        query = query.eq("actor_id", actorFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get unique event types for quick reference
  const eventTypes = [...new Set(events?.map(e => e.event_type) || [])];

  const actorColor = (type: string) => {
    switch (type) {
      case "owner": return "default";
      case "sales_rep": return "secondary";
      case "admin": return "destructive";
      case "system": return "outline";
      default: return "outline";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Event Inspector
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Filter by event type..."
            value={eventTypeFilter}
            onChange={e => setEventTypeFilter(e.target.value)}
            className="w-60"
          />
          <Input
            placeholder="Filter by actor ID..."
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="w-60"
          />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick event type chips */}
        {eventTypes.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {eventTypes.slice(0, 15).map(type => (
              <Badge
                key={type}
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => setEventTypeFilter(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Object</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : events?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No events found</TableCell>
                </TableRow>
              ) : (
                events?.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.created_at), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{event.event_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actorColor(event.actor_type) as any} className="text-xs">
                        {event.actor_type}
                      </Badge>
                      {event.actor_id && (
                        <span className="text-xs text-muted-foreground ml-1">{event.actor_id.slice(0, 8)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {event.object_type && (
                        <span>{event.object_type}{event.object_id ? `:${event.object_id.slice(0, 8)}` : ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                      {event.metadata ? JSON.stringify(event.metadata).slice(0, 80) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {events?.length || 0} events • {eventTypes.length} unique types
        </p>
      </CardContent>
    </Card>
  );
}
