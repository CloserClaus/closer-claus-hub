import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  SkipForward,
  BarChart3,
  FileText,
  CalendarClock,
  Clock,
  TrendingUp,
  Download,
  RotateCcw,
  User,
} from "lucide-react";
import { format } from "date-fns";

interface DialedLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  outcome?: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'skipped';
  notes?: string;
  callDuration?: number;
}

interface ScheduledCallback {
  id: string;
  lead_id: string;
  scheduled_for: string;
  reason: string | null;
  lead?: {
    first_name: string;
    last_name: string;
  };
}

interface SessionDispositionReportProps {
  dialedLeads: DialedLead[];
  sessionCallbacks: ScheduledCallback[];
  onStartNewSession: () => void;
  onExportReport: () => void;
}

export function SessionDispositionReport({
  dialedLeads,
  sessionCallbacks,
  onStartNewSession,
  onExportReport,
}: SessionDispositionReportProps) {
  // Calculate analytics
  const totalCalls = dialedLeads.length;
  const connected = dialedLeads.filter((l) => l.outcome === "connected").length;
  const noAnswer = dialedLeads.filter((l) => l.outcome === "no_answer").length;
  const busy = dialedLeads.filter((l) => l.outcome === "busy").length;
  const voicemail = dialedLeads.filter((l) => l.outcome === "voicemail").length;
  const skipped = dialedLeads.filter((l) => l.outcome === "skipped").length;

  const connectRate = totalCalls > 0 ? (connected / totalCalls) * 100 : 0;

  const callsWithDuration = dialedLeads.filter((l) => l.callDuration && l.callDuration > 0);
  const totalDuration = callsWithDuration.reduce((sum, l) => sum + (l.callDuration || 0), 0);
  const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;

  // Quality calls (2+ minutes)
  const qualityCalls = dialedLeads.filter((l) => l.callDuration && l.callDuration >= 120).length;
  const qualityRate = connected > 0 ? (qualityCalls / connected) * 100 : 0;

  // Leads with notes
  const leadsWithNotes = dialedLeads.filter((l) => l.notes && l.notes.trim().length > 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "connected":
        return "text-success";
      case "no_answer":
        return "text-destructive";
      case "busy":
        return "text-warning";
      default:
        return "text-muted-foreground";
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "no_answer":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "busy":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "voicemail":
        return <Phone className="h-4 w-4 text-muted-foreground" />;
      case "skipped":
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
        <h3 className="text-xl font-semibold mb-1">Session Complete!</h3>
        <p className="text-muted-foreground">
          You've completed {totalCalls} calls in this session
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{connectRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Connect Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{formatDuration(Math.round(avgDuration))}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Duration</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{connected}</p>
            <p className="text-xs text-muted-foreground mt-1">Connected</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{formatDuration(totalDuration)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Talk Time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outcome Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              Outcome Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Visual bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-muted">
              {connected > 0 && (
                <div
                  className="bg-success h-full"
                  style={{ width: `${(connected / totalCalls) * 100}%` }}
                  title={`Connected: ${connected}`}
                />
              )}
              {voicemail > 0 && (
                <div
                  className="bg-muted-foreground h-full"
                  style={{ width: `${(voicemail / totalCalls) * 100}%` }}
                  title={`Voicemail: ${voicemail}`}
                />
              )}
              {noAnswer > 0 && (
                <div
                  className="bg-destructive h-full"
                  style={{ width: `${(noAnswer / totalCalls) * 100}%` }}
                  title={`No Answer: ${noAnswer}`}
                />
              )}
              {busy > 0 && (
                <div
                  className="bg-warning h-full"
                  style={{ width: `${(busy / totalCalls) * 100}%` }}
                  title={`Busy: ${busy}`}
                />
              )}
              {skipped > 0 && (
                <div
                  className="bg-border h-full"
                  style={{ width: `${(skipped / totalCalls) * 100}%` }}
                  title={`Skipped: ${skipped}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  Connected
                </span>
                <span className="font-medium">{connected} ({((connected / totalCalls) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-muted-foreground" />
                  Voicemail
                </span>
                <span className="font-medium">{voicemail} ({((voicemail / totalCalls) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" />
                  No Answer
                </span>
                <span className="font-medium">{noAnswer} ({((noAnswer / totalCalls) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-warning" />
                  Busy
                </span>
                <span className="font-medium">{busy} ({((busy / totalCalls) * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-border" />
                  Skipped
                </span>
                <span className="font-medium">{skipped} ({((skipped / totalCalls) * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {qualityCalls > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                  <TrendingUp className="h-4 w-4 text-success shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold text-success">{qualityCalls}</span> quality calls (2+ min) — 
                    <span className="font-medium"> {qualityRate.toFixed(0)}%</span> of connections
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Callbacks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" />
              Scheduled Callbacks
            </CardTitle>
            <CardDescription>
              {sessionCallbacks.length} callback{sessionCallbacks.length !== 1 ? "s" : ""} scheduled this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionCallbacks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No callbacks scheduled</p>
              </div>
            ) : (
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {sessionCallbacks.map((callback) => (
                    <div
                      key={callback.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {callback.lead?.first_name} {callback.lead?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(callback.scheduled_for), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {callback.reason?.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call Notes Summary */}
      {leadsWithNotes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Call Notes
            </CardTitle>
            <CardDescription>
              {leadsWithNotes.length} call{leadsWithNotes.length !== 1 ? "s" : ""} with notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {leadsWithNotes.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {lead.first_name} {lead.last_name}
                        </span>
                        {lead.company && (
                          <span className="text-xs text-muted-foreground">• {lead.company}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.callDuration && lead.callDuration > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(lead.callDuration)}
                          </span>
                        )}
                        {lead.outcome && getOutcomeIcon(lead.outcome)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Detailed Call List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-5 w-5 text-primary" />
            Complete Call List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {dialedLeads.map((lead, idx) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground w-6 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="font-medium truncate">
                      {lead.first_name} {lead.last_name}
                    </span>
                    {lead.company && (
                      <span className="text-muted-foreground text-xs truncate hidden sm:block">
                        {lead.company}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {lead.callDuration && lead.callDuration > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDuration(lead.callDuration)}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${getOutcomeColor(lead.outcome || "")}`}
                    >
                      {lead.outcome?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onStartNewSession} className="flex-1">
          <RotateCcw className="h-4 w-4 mr-2" />
          Start New Session
        </Button>
        <Button variant="outline" onClick={onExportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>
    </div>
  );
}
