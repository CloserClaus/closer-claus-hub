import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Zap, Loader2, Play, Clock, Trash2, RotateCcw, ExternalLink, Plus, History,
  Globe, Phone, MapPin, Building2, ChevronDown, ChevronUp, Search, Mail, Sparkles,
  Briefcase, Rocket, FileText,
} from 'lucide-react';
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
  const [scheduleType, setScheduleType] = useState<'once' | 'daily'>('once');
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
      {currentPlan && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{currentPlan.plan.signal_name}</CardTitle>
              <Badge variant="outline">{currentPlan.estimation.source_label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <span className="ml-2 text-foreground">{currentPlan.plan.search_query}</span>
            </div>

            {currentPlan.plan.filters.length > 0 && (
              <div className="text-sm space-y-1">
                <span className="font-medium text-muted-foreground">Filters:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {currentPlan.plan.filters.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f.field} {f.operator} {f.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {currentPlan.plan.ai_classification && (
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">AI check:</span>
                <span className="ml-2 text-foreground">{currentPlan.plan.ai_classification}</span>
              </div>
            )}

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Schedule:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${scheduleType === 'once' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    Run once
                  </span>
                  <Switch
                    checked={scheduleType === 'daily'}
                    onCheckedChange={(checked) => setScheduleType(checked ? 'daily' : 'once')}
                  />
                  <span className={`text-sm ${scheduleType === 'daily' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    Run daily
                  </span>
                </div>
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
      )}

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

  return (
    <div className="p-3 rounded-lg bg-muted space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{run.signal_name || run.signal_query}</span>
            <StatusBadge status={run.status} />
            {run.schedule_type === 'daily' && (
              <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Daily</Badge>
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
          </div>
        </div>
        <div className="flex gap-1.5">
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
    running: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-destructive/20 text-destructive',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${variants[status] || variants.draft}`}>
      {status}
    </span>
  );
}

function SignalResultsView({ runId, onClose, workspaceId }: { runId: string; onClose: () => void; workspaceId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['signal-leads', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_leads')
        .select('*')
        .eq('run_id', runId)
        .order('discovered_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SignalLead[];
    },
  });

  const addToCRM = async (lead: SignalLead) => {
    const { error } = await supabase.from('leads').insert([{
      workspace_id: workspaceId,
      created_by: (await supabase.auth.getUser()).data.user?.id || '',
      first_name: '',
      last_name: '',
      company: lead.company_name,
      phone: lead.phone,
      linkedin_url: lead.linkedin,
      source: `Signal: ${lead.source}`,
      notes: `Website: ${lead.website || ''}\nLocation: ${lead.location || ''}`,
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
    const unleadedLeads = leads.filter((l) => !l.added_to_crm);
    if (unleadedLeads.length === 0) return;
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const rows = unleadedLeads.map((lead) => ({
      workspace_id: workspaceId,
      created_by: userId,
      first_name: '',
      last_name: '',
      company: lead.company_name,
      phone: lead.phone,
      linkedin_url: lead.linkedin,
      source: `Signal: ${lead.source}`,
      notes: `Website: ${lead.website || ''}\nLocation: ${lead.location || ''}`,
    }));
    const { error } = await supabase.from('leads').insert(rows);
    if (error) {
      toast({ title: 'Failed to add leads', description: error.message, variant: 'destructive' });
      return;
    }
    const ids = unleadedLeads.map((l) => l.id);
    for (let i = 0; i < ids.length; i += 50) {
      await supabase.from('signal_leads').update({ added_to_crm: true }).in('id', ids.slice(i, i + 50));
    }
    toast({ title: `${unleadedLeads.length} leads added to CRM` });
    queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
  };

  const enrichWithApolloMutation = useMutation({
    mutationFn: async (lead: SignalLead) => {
      if (!lead.added_to_crm) {
        await addToCRM(lead);
      }
      const { data, error } = await supabase.functions.invoke('apollo-enrich', {
        body: {
          workspace_id: workspaceId,
          domain: lead.domain,
          company_name: lead.company_name,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Enrichment started', description: 'Apollo enrichment has been queued for this lead.' });
      queryClient.invalidateQueries({ queryKey: ['lead-credits'] });
    },
    onError: (err: any) => {
      toast({ title: 'Enrichment failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const notInCrmCount = leads.filter((l) => !l.added_to_crm).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Signal Results — {leads.length} leads discovered</CardTitle>
          <div className="flex gap-2">
            {notInCrmCount > 0 && (
              <Button size="sm" variant="outline" onClick={addAllToCRM}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add All to CRM ({notInCrmCount})
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <div key={lead.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-start justify-between">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {lead.company_name || 'Unknown'}
                  </div>
                  {lead.added_to_crm && <Badge variant="secondary" className="text-xs">In CRM</Badge>}
                </div>
                {lead.website && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {lead.domain || lead.website}
                  </div>
                )}
                {lead.phone && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {lead.phone}
                  </div>
                )}
                {lead.location && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {lead.location}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {!lead.added_to_crm && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addToCRM(lead)}>
                      <Plus className="h-3 w-3 mr-1" /> Add to CRM
                    </Button>
                  )}
                  {lead.domain && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => enrichWithApolloMutation.mutate(lead)}
                      disabled={enrichWithApolloMutation.isPending}
                    >
                      <Search className="h-3 w-3 mr-1" /> Enrich
                    </Button>
                  )}
                  {lead.added_to_crm && (
                    <Button size="sm" variant="outline" className="text-xs h-7" asChild>
                      <a href="/crm">
                        <Mail className="h-3 w-3 mr-1" /> Start Outreach
                      </a>
                    </Button>
                  )}
                  {lead.website && (
                    <Button size="sm" variant="ghost" className="text-xs h-7" asChild>
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
