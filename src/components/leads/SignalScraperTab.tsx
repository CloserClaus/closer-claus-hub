import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Zap, Loader2, Play, Clock, Trash2, RotateCcw, ExternalLink, Plus, History,
  Globe, Phone, MapPin, Building2, ChevronDown, ChevronUp, Search, Mail, Sparkles,
  Briefcase, Rocket, FileText, AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSignalScraper, SignalRun, SignalLead } from '@/hooks/useSignalScraper';
import { useLeadCredits } from '@/hooks/useLeadCredits';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

const ICON_MAP: Record<string, any> = { Briefcase, Rocket, MapPin, Zap, Sparkles };

export function SignalScraperTab() {
  const [query, setQuery] = useState('');
  const [scheduleType, setScheduleType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  const {
    currentPlan, setCurrentPlan,
    signalHistory, historyLoading,
    generatePlan, isGenerating,
    executeSignal, isExecuting,
    deleteSignal,
  } = useSignalScraper();

  const { credits } = useLeadCredits();

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['signal-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const handleGenerate = (q?: string, planOverride?: any) => {
    const finalQuery = q || query.trim();
    if (!finalQuery) return;
    if (q) setQuery(q);
    generatePlan({ query: finalQuery, plan_override: planOverride });
  };

  const handleExecute = () => {
    if (!currentPlan) return;
    executeSignal({ run_id: currentPlan.run_id, schedule_type: scheduleType });
  };

  const handleRerun = (run: SignalRun) => {
    setQuery(run.signal_query);
    generatePlan({ query: run.signal_query });
  };

  const handleTemplate = (tpl: any) => {
    setQuery(tpl.query_template);
    handleGenerate(tpl.query_template, tpl.plan_override);
  };

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quick Start Templates
            </CardTitle>
            <CardDescription>Pre-configured intent signals — one click to generate a plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl: any) => {
                const Icon = ICON_MAP[tpl.icon] || Zap;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplate(tpl)}
                    disabled={isGenerating}
                    className="text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{tpl.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                    <Badge variant="outline" className="text-xs mt-2">{tpl.category.replace('_', ' ')}</Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Describe the leads you want
          </CardTitle>
          <CardDescription>
            Use natural language to describe your ideal leads. Our AI will create a scraping workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='e.g. "Find chiropractors in Texas with less than 10 Google reviews" or "SaaS startups hiring outbound sales reps"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] bg-muted border-border"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Credits available: <span className="font-semibold text-foreground">{credits}</span>
            </div>
            <Button onClick={() => handleGenerate()} disabled={isGenerating || !query.trim()}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating Plan...</>
              ) : (
                <><Zap className="h-4 w-4" /> Generate Signal Plan</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan Display */}
      {currentPlan && (() => {
        // Normalize plan to array for display
        const planArray = Array.isArray(currentPlan.plan) ? currentPlan.plan : [currentPlan.plan];
        const firstPlan = planArray[0];
        const allSearchQueries = planArray.map(p => p.search_query).filter(Boolean);
        const uniqueQueries = [...new Set(allSearchQueries)];

        return (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{firstPlan.signal_name}</CardTitle>
              <Badge variant="outline">{currentPlan.estimation.source_label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plan-time warnings */}
            {currentPlan.warnings && currentPlan.warnings.length > 0 && (
              <div className="space-y-2">
                {currentPlan.warnings.map((warning, i) => (
                  <Alert key={i} className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-sm text-yellow-200">
                      {warning}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-foreground">~{currentPlan.estimation.estimated_rows}</div>
                <div className="text-xs text-muted-foreground">Records to scan</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-primary">{currentPlan.estimation.credits_to_charge}</div>
                <div className="text-xs text-muted-foreground">Credits cost</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-foreground">~{currentPlan.estimation.estimated_leads}</div>
                <div className="text-xs text-muted-foreground">Est. leads after filtering</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-foreground">{currentPlan.estimation.cost_per_lead}</div>
                <div className="text-xs text-muted-foreground">Credits per lead</div>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <span className="font-medium text-muted-foreground">Search query:</span>
              <span className="ml-2 text-foreground">{uniqueQueries.join(" | ")}</span>
            </div>

            {firstPlan.filters && firstPlan.filters.length > 0 && (
              <div className="text-sm space-y-1">
                <span className="font-medium text-muted-foreground">Filters:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {firstPlan.filters.map((f: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f.field} {f.operator} {f.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {firstPlan.ai_classification && (
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">AI check:</span>
                <span className="ml-2 text-foreground">{firstPlan.ai_classification}</span>
              </div>
            )}

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Schedule:</span>
                <RadioGroup
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as 'once' | 'daily' | 'weekly')}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="once" id="sched-once" />
                    <Label htmlFor="sched-once" className="text-sm cursor-pointer">Once</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="daily" id="sched-daily" />
                    <Label htmlFor="sched-daily" className="text-sm cursor-pointer">Daily</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="weekly" id="sched-weekly" />
                    <Label htmlFor="sched-weekly" className="text-sm cursor-pointer">Weekly</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentPlan(null)}>Cancel</Button>
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting || credits < currentPlan.estimation.credits_to_charge}
                >
                  {isExecuting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Running Signal...</>
                  ) : (
                    <><Play className="h-4 w-4" /> Run Signal ({currentPlan.estimation.credits_to_charge} credits)</>
                  )}
                </Button>
              </div>
            </div>

            {credits < currentPlan.estimation.credits_to_charge && (
              <p className="text-sm text-destructive">
                Insufficient credits. You need {currentPlan.estimation.credits_to_charge - credits} more credits.
              </p>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Results for a specific run */}
      {viewingRunId && (
        <SignalResultsView
          runId={viewingRunId}
          onClose={() => setViewingRunId(null)}
          workspaceId={currentWorkspace?.id || ''}
        />
      )}

      {/* Signal History */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              My Signals
            </CardTitle>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : signalHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No signals yet. Describe the leads you want above to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {signalHistory.map((run) => (
                  <SignalHistoryItem
                    key={run.id}
                    run={run}
                    onView={() => setViewingRunId(run.id)}
                    onRerun={() => handleRerun(run)}
                    onDelete={() => deleteSignal(run.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function SignalHistoryItem({ run, onView, onRerun, onDelete }: { run: SignalRun; onView: () => void; onRerun: () => void; onDelete: () => void }) {
  const [showLog, setShowLog] = useState(false);
  const runLog = (run as any).run_log as any[] | null;
  const { toast } = useToast();

  // Detect stale runs: use updated_at heartbeat — stale only if no backend progress for 5+ minutes
  // This aligns with the 2-min cron cycle; if 2+ cycles pass without updating, something is stuck
  const STALE_HEARTBEAT_MS = 5 * 60 * 1000;
  const heartbeatField = (run as any).updated_at || run.started_at;
  const isStale = run.status === 'running' && heartbeatField &&
    (Date.now() - new Date(heartbeatField).getTime()) > STALE_HEARTBEAT_MS;

  // Extract job breakdown from apify_run_ids if available
  const jobRefs = ((run as any).apify_run_ids as any[] | null) || [];
  const jobBreakdown = jobRefs.length > 0 ? {
    succeeded: jobRefs.filter((r: any) => r.status === 'SUCCEEDED').length,
    failed: jobRefs.filter((r: any) => r.status === 'FAILED').length,
    timedOut: jobRefs.filter((r: any) => r.status === 'TIMED-OUT').length,
    deferred: jobRefs.filter((r: any) => r.status === 'DEFERRED').length,
    running: jobRefs.filter((r: any) => r.status === 'RUNNING' || r.status === 'READY').length,
    total: jobRefs.length,
  } : null;

  const markAsFailed = async () => {
    await supabase.from('signal_runs').update({ status: 'failed' }).eq('id', run.id);
    toast({ title: 'Signal marked as failed' });
    onRerun();
  };

  return (
    <div className="p-3 rounded-lg bg-muted space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{run.signal_name || run.signal_query}</span>
            <StatusBadge status={isStale ? 'stale' : run.status} />
            {run.schedule_type === 'daily' && (
              <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Daily</Badge>
            )}
            {run.schedule_type === 'weekly' && (
              <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Weekly</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
            {run.last_run_at && (
              <span>Last run: {formatDistanceToNow(new Date(run.last_run_at), { addSuffix: true })}</span>
            )}
            <span>{run.leads_discovered} leads</span>
            <span>{run.actual_cost ?? run.estimated_cost} credits</span>
            {run.actual_cost === 0 && run.status === 'completed' && (
              <span className="text-green-500">🛡️ No charge (0 results)</span>
            )}
            {run.retry_count > 0 && (
              <span className="text-orange-400">⟳ {run.retry_count} retries</span>
            )}
            {/* Job status breakdown for running signals */}
            {run.status === 'running' && jobBreakdown && jobBreakdown.total > 0 && (
              <span className="inline-flex gap-1.5 items-center">
                {jobBreakdown.succeeded > 0 && <span className="text-green-400">✓{jobBreakdown.succeeded}</span>}
                {jobBreakdown.running > 0 && <span className="text-yellow-400">⚙{jobBreakdown.running}</span>}
                {jobBreakdown.deferred > 0 && <span className="text-blue-400">⏸{jobBreakdown.deferred}</span>}
                {jobBreakdown.failed > 0 && <span className="text-destructive">✗{jobBreakdown.failed}</span>}
                {jobBreakdown.timedOut > 0 && <span className="text-orange-400">⏱{jobBreakdown.timedOut}</span>}
                <span className="text-muted-foreground">of {jobBreakdown.total} jobs</span>
              </span>
            )}
            {/* Phase progress: show when all jobs done but still processing */}
            {run.status === 'running' && jobBreakdown && jobBreakdown.running === 0 && jobBreakdown.deferred === 0 && (run as any).processing_phase && (
              <span className="text-primary text-xs font-medium">
                {(run as any).processing_phase === 'collecting'
                  ? `📥 Collecting results ${((run as any).collected_dataset_index || 0) + 1}/${jobBreakdown.succeeded}...`
                  : (run as any).processing_phase === 'finalizing'
                    ? '🔍 Deduplicating & classifying leads...'
                    : (run as any).processing_phase === 'scraping'
                      ? '⏳ Waiting for scrapers to finish...'
                      : `⚙ ${(run as any).processing_phase}`}
              </span>
            )}
            {/* Show capacity throttling hint */}
            {jobBreakdown && jobBreakdown.deferred > 0 && (
              <span className="text-blue-400 text-xs">Provider capacity throttling — retrying automatically</span>
            )}
            {run.error_message && run.status === 'failed' && (
              <span className="text-destructive truncate max-w-[200px]" title={run.error_message}>
                {run.error_message.slice(0, 60)}…
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {isStale && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={markAsFailed}>
              Mark Failed
            </Button>
          )}
          {run.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={onView}>View Leads</Button>
          )}
          {runLog && runLog.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowLog(!showLog)}>
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRerun}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {showLog && runLog && (
        <div className="mt-2 p-2 rounded bg-background border text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
          {runLog.map((entry: any, i: number) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground whitespace-nowrap">{entry.step}</span>
              <span className="text-foreground">
                {Object.entries(entry).filter(([k]) => k !== 'step' && k !== 'ts').map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    draft: 'bg-muted-foreground/20 text-muted-foreground',
    planned: 'bg-blue-500/20 text-blue-400',
    queued: 'bg-blue-500/20 text-blue-400 animate-pulse',
    running: 'bg-yellow-500/20 text-yellow-400 animate-pulse',
    stale: 'bg-orange-500/20 text-orange-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-destructive/20 text-destructive',
  };
  const labels: Record<string, string> = {
    queued: '⏳ queued',
    stale: '⚠ stale',
    running: '⚙ running',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${variants[status] || variants.draft}`}>
      {labels[status] || status}
    </span>
  );
}

function SignalResultsView({ runId, onClose, workspaceId }: { runId: string; onClose: () => void; workspaceId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['signal-leads', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_leads')
        .select('*')
        .eq('run_id', runId)
        .order('discovered_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data || []) as SignalLead[];
    },
  });

  const addToCRM = async (lead: SignalLead) => {
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const nameParts = (lead.contact_name || '').trim().split(/\s+/);
    const { error } = await supabase.from('leads').insert([{
      workspace_id: workspaceId,
      created_by: userId,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      company: lead.company_name || '',
      company_domain: lead.domain || '',
      title: lead.title || '',
      phone: lead.enriched ? lead.phone : null,
      email: lead.enriched ? lead.email : null,
      linkedin_url: lead.linkedin || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      industry: lead.industry || '',
      employee_count: lead.employee_count || '',
      source: `Signal: ${lead.source}`,
    }]);
    if (error) {
      toast({ title: 'Failed to add lead', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('signal_leads').update({ added_to_crm: true }).eq('id', lead.id);
    toast({ title: 'Lead added to CRM' });
    queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
  };

  const addAllToCRM = async () => {
    const targetLeads = selectedIds.size > 0
      ? leads.filter(l => selectedIds.has(l.id) && !l.added_to_crm)
      : leads.filter(l => !l.added_to_crm);
    if (targetLeads.length === 0) return;
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const rows = targetLeads.map((lead) => {
      const nameParts = (lead.contact_name || '').trim().split(/\s+/);
      return {
        workspace_id: workspaceId,
        created_by: userId,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        company: lead.company_name || '',
        company_domain: lead.domain || '',
        title: lead.title || '',
        phone: lead.enriched ? lead.phone : null,
        email: lead.enriched ? lead.email : null,
        linkedin_url: lead.linkedin || '',
        city: lead.city || '',
        state: lead.state || '',
        country: lead.country || '',
        industry: lead.industry || '',
        employee_count: lead.employee_count || '',
        source: `Signal: ${lead.source}`,
      };
    });
    const { error } = await supabase.from('leads').insert(rows);
    if (error) {
      toast({ title: 'Failed to add leads', description: error.message, variant: 'destructive' });
      return;
    }
    const ids = targetLeads.map(l => l.id);
    for (let i = 0; i < ids.length; i += 50) {
      await supabase.from('signal_leads').update({ added_to_crm: true }).in('id', ids.slice(i, i + 50));
    }
    toast({ title: `${targetLeads.length} leads added to CRM` });
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
  };

  const enrichLeadMutation = useMutation({
    mutationFn: async (lead: SignalLead) => {
      if (lead.email || lead.phone) {
        await supabase.from('signal_leads').update({ enriched: true }).eq('id', lead.id);
        if (lead.added_to_crm) {
          const { data: crmLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('company', lead.company_name)
            .limit(1);
          if (crmLeads && crmLeads.length > 0) {
            const updates: Record<string, string> = {};
            if (lead.email) updates.email = lead.email;
            if (lead.phone) updates.phone = lead.phone;
            await supabase.from('leads').update(updates).eq('id', crmLeads[0].id);
          }
        }
        return { source: 'apify', email: lead.email, phone: lead.phone };
      }
      if (!lead.added_to_crm) {
        await addToCRM(lead);
      }
      const { data, error } = await supabase.functions.invoke('apollo-enrich', {
        body: { workspace_id: workspaceId, domain: lead.domain, company_name: lead.company_name },
      });
      if (error) throw error;
      await supabase.from('signal_leads').update({ enriched: true }).eq('id', lead.id);
      return { source: 'apollo', ...data };
    },
    onSuccess: (data) => {
      const desc = data.source === 'apify'
        ? 'Contact info revealed from scraped data.'
        : 'Apollo enrichment has been queued for this lead.';
      toast({ title: 'Lead enriched', description: desc });
      queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
      queryClient.invalidateQueries({ queryKey: ['lead-credits'] });
    },
    onError: (err: any) => {
      toast({ title: 'Enrichment failed', description: err.message, variant: 'destructive' });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const notInCrmCount = selectedIds.size > 0
    ? leads.filter(l => selectedIds.has(l.id) && !l.added_to_crm).length
    : leads.filter(l => !l.added_to_crm).length;

  const formatLocation = (lead: SignalLead) => {
    const parts = [lead.city, lead.state, lead.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : lead.location || '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Signal Results — {leads.length} leads</CardTitle>
          <div className="flex gap-2">
            {notInCrmCount > 0 && (
              <Button size="sm" variant="outline" onClick={addAllToCRM}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {selectedIds.size > 0 ? `Add Selected to CRM (${notInCrmCount})` : `Add All to CRM (${notInCrmCount})`}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No leads found for this run.</p>
        ) : (
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors">
                  <th className="h-10 px-2 text-left align-middle w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onChange={toggleAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Name</th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Company</th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Industry</th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Links</th>
                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Contact</th>
                  <th className="h-10 px-3 text-right align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="p-3 align-middle">
                      <div className="font-medium text-sm">{lead.contact_name || '—'}</div>
                      {lead.title && <div className="text-xs text-muted-foreground">{lead.title}</div>}
                    </td>
                    <td className="p-3 align-middle">
                      <div className="font-medium text-sm">{lead.company_name || '—'}</div>
                      {lead.domain && <div className="text-xs text-muted-foreground">{lead.domain}</div>}
                      {lead.employee_count && <div className="text-xs text-muted-foreground">{lead.employee_count} employees</div>}
                    </td>
                    <td className="p-3 align-middle hidden md:table-cell">
                      <div className="text-sm text-muted-foreground">{formatLocation(lead) || '—'}</div>
                    </td>
                    <td className="p-3 align-middle hidden lg:table-cell">
                      <div className="text-sm text-muted-foreground">{lead.industry || '—'}</div>
                    </td>
                    <td className="p-3 align-middle">
                      <div className="flex gap-1">
                        {lead.website && (
                          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground">
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                        {lead.linkedin && (
                          <a href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://${lead.linkedin}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3 align-middle">
                      {lead.enriched ? (
                        <div className="space-y-0.5">
                          {lead.email && <div className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</div>}
                          {lead.phone && <div className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>}
                          {!lead.email && !lead.phone && <span className="text-xs text-muted-foreground">No data</span>}
                        </div>
                      ) : (lead.email || lead.phone) ? (
                        <Button
                          size="sm" variant="ghost" className="text-xs h-7"
                          onClick={() => enrichLeadMutation.mutate(lead)}
                          disabled={enrichLeadMutation.isPending}
                        >
                          {enrichLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                          Reveal
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="text-xs h-7"
                          onClick={() => enrichLeadMutation.mutate(lead)}
                          disabled={enrichLeadMutation.isPending}
                        >
                          {enrichLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                          Enrich
                        </Button>
                      )}
                    </td>
                    <td className="p-3 align-middle text-right">
                      <div className="flex gap-1 justify-end">
                        {!lead.added_to_crm ? (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addToCRM(lead)}>
                            <Plus className="h-3 w-3 mr-1" /> CRM
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-7" asChild>
                            <a href="/crm"><Mail className="h-3 w-3 mr-1" /> Outreach</a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
