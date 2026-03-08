import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Zap, Loader2, Play, Clock, Trash2, RotateCcw, Plus, History,
  Globe, Phone, MapPin, Building2, Search, Mail, Sparkles,
  Briefcase, Rocket, FileText, AlertTriangle, ArrowRight, Filter, Users, User,
  Bookmark, List, MoreHorizontal, Settings, Download, RefreshCw,
} from 'lucide-react';
import { exportLeadsToCSV } from '@/lib/csvExport';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddToListDialog } from '@/components/leads/AddToListDialog';
import { useSignalScraper, SignalRun, SignalLead, isPipelinePlan, PipelinePlan, StageFunnelItem } from '@/hooks/useSignalScraper';
import { useLeadCredits } from '@/hooks/useLeadCredits';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { CRMPagination } from '@/components/crm/Pagination';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 25;

const ICON_MAP: Record<string, any> = { Briefcase, Rocket, MapPin, Zap, Sparkles };

export interface AdvancedSettings {
  target_leads: number;
  location: string;
  company_size: 'any' | '1-10' | '11-50' | '51-200' | '200+';
  decision_maker_titles: string;
  date_range: 'past_24h' | 'past_week' | 'past_2_weeks' | 'past_month';
  quality: 'standard' | 'high';
  // Legacy fields — computed internally for backend compatibility
  max_results_per_source: number;
  ai_strictness: 'low' | 'medium' | 'high';
}

const DEFAULT_ADVANCED: AdvancedSettings = {
  target_leads: 100,
  location: '',
  company_size: 'any',
  decision_maker_titles: '',
  date_range: 'past_week',
  quality: 'standard',
  max_results_per_source: 500,
  ai_strictness: 'medium',
};

// Translate user-intent settings into system settings
function computeSystemSettings(settings: AdvancedSettings): AdvancedSettings {
  // Target leads → max_results_per_source (assume ~20% pass rate)
  const maxResults = settings.target_leads * 5;
  // Quality → AI strictness
  const strictness = settings.quality === 'high' ? 'high' : 'medium';
  return {
    ...settings,
    max_results_per_source: maxResults,
    ai_strictness: strictness,
  };
}

export function SignalScraperTab() {
  const [query, setQuery] = useState('');
  const [scheduleType, setScheduleType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(DEFAULT_ADVANCED);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  
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
    const systemSettings = computeSystemSettings(advancedSettings);
    generatePlan({ query: finalQuery, plan_override: planOverride, advanced_settings: systemSettings });
  };

  const estimatedScrapeCost = ((advancedSettings.target_leads * 5 / 1000) * 1.0 * 4 * 5).toFixed(0);

  const handleExecute = () => {
    if (!currentPlan) return;
    executeSignal({ run_id: currentPlan.run_id, schedule_type: scheduleType });
  };

  const handleRerun = (run: SignalRun, refinementContext?: any) => {
    setQuery(run.signal_query);
    const systemSettings = computeSystemSettings(advancedSettings);
    generatePlan({ query: run.signal_query, advanced_settings: systemSettings, plan_override: refinementContext ? { refinement_context: refinementContext } : undefined });
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
            Use natural language. Our AI builds a multi-stage pipeline to discover, verify, and enrich leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='e.g. "Marketing agencies with 1-10 employees hiring sales reps" or "Chiropractors in Texas with less than 10 Google reviews"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] bg-muted border-border"
          />

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
                Advanced Settings
                <Badge variant="secondary" className="text-xs">{advancedOpen ? '▲' : '▼'}</Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-5 rounded-lg border border-border bg-muted/30 p-4">
              {/* Max Results Per Source */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Max results per source</Label>
                  <span className="text-sm font-semibold text-foreground">{advancedSettings.max_results_per_source.toLocaleString()}</span>
                </div>
                <Slider
                  value={[advancedSettings.max_results_per_source]}
                  onValueChange={([v]) => setAdvancedSettings(s => ({ ...s, max_results_per_source: v }))}
                  min={100}
                  max={5000}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100 (cheaper)</span>
                  <span>~{estimatedScrapeCost} credits est. scrape cost</span>
                  <span>5,000 (broader)</span>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date range</Label>
                <Select
                  value={advancedSettings.date_range}
                  onValueChange={(v) => setAdvancedSettings(s => ({ ...s, date_range: v as any }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="past_24h">Past 24 hours</SelectItem>
                    <SelectItem value="past_week">Past week</SelectItem>
                    <SelectItem value="past_2_weeks">Past 2 weeks</SelectItem>
                    <SelectItem value="past_month">Past month</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Controls how recent the scraped listings should be.</p>
              </div>

              {/* AI Filtering Strictness */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">AI filtering strictness</Label>
                <RadioGroup
                  value={advancedSettings.ai_strictness}
                  onValueChange={(v) => setAdvancedSettings(s => ({ ...s, ai_strictness: v as any }))}
                  className="flex gap-4"
                >
                  {([
                    { value: 'low', label: 'Low', desc: 'More leads, less filtering' },
                    { value: 'medium', label: 'Medium', desc: 'Balanced' },
                    { value: 'high', label: 'High', desc: 'Fewer, higher-quality leads' },
                  ] as const).map(opt => (
                    <div key={opt.value} className="flex items-center gap-1.5">
                      <RadioGroupItem value={opt.value} id={`strict-${opt.value}`} />
                      <Label htmlFor={`strict-${opt.value}`} className="text-sm cursor-pointer">
                        {opt.label}
                        <span className="text-xs text-muted-foreground ml-1">({opt.desc})</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Credits available: <span className="font-semibold text-foreground">{credits}</span>
            </div>
            <Button onClick={() => handleGenerate()} disabled={isGenerating || !query.trim()}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating Pipeline...</>
              ) : (
                <><Zap className="h-4 w-4" /> Generate Pipeline</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Plan Display */}
      {currentPlan && <PipelinePlanDisplay
        currentPlan={currentPlan}
        scheduleType={scheduleType}
        setScheduleType={setScheduleType}
        onExecute={handleExecute}
        onCancel={() => setCurrentPlan(null)}
        isExecuting={isExecuting}
        credits={credits}
      />}

      {/* Results for a specific run */}
      {viewingRunId && (
        <SignalResultsView
          runId={viewingRunId}
          onClose={() => setViewingRunId(null)}
          workspaceId={currentWorkspace?.id || ''}
        />
      )}

      {/* Signal History — always visible */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              My Signals
              {signalHistory.length > 0 && (
                <Badge variant="secondary" className="text-xs">{signalHistory.length}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
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
            <>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors">
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Signal</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">Leads</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Credits</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Run</th>
                      <th className="h-10 px-3 text-right align-middle font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {signalHistory
                      .slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)
                      .map((run) => (
                        <SignalHistoryRow
                          key={run.id}
                          run={run}
                          onView={() => setViewingRunId(run.id)}
                          onRerun={() => handleRerun(run)}
                          onDelete={() => deleteSignal(run.id)}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
              <CRMPagination
                currentPage={historyPage}
                totalPages={Math.ceil(signalHistory.length / PAGE_SIZE)}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Pipeline Plan Display ──

function PipelinePlanDisplay({ currentPlan, scheduleType, setScheduleType, onExecute, onCancel, isExecuting, credits }: {
  currentPlan: { run_id: string; plan: any; estimation: any; warnings?: string[]; data_flow_fixes?: string[] };
  scheduleType: string;
  setScheduleType: (v: 'once' | 'daily' | 'weekly') => void;
  onExecute: () => void;
  onCancel: () => void;
  isExecuting: boolean;
  credits: number;
}) {
  const plan = currentPlan.plan;
  const estimation = currentPlan.estimation;
  const isPipeline = plan && typeof plan === 'object' && !Array.isArray(plan) && plan.pipeline;

  if (!isPipeline) {
    // Legacy plan display
    const planArray = Array.isArray(plan) ? plan : [plan];
    const firstPlan = planArray[0];
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{firstPlan.signal_name}</CardTitle>
            <Badge variant="outline">{estimation.source_label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <LegacyPlanStats estimation={estimation} />
          <PlanActions
            scheduleType={scheduleType} setScheduleType={setScheduleType}
            onExecute={onExecute} onCancel={onCancel} isExecuting={isExecuting}
            credits={credits} creditsNeeded={estimation.credits_to_charge}
          />
        </CardContent>
      </Card>
    );
  }

  // Pipeline display
  const pipeline = plan.pipeline as any[];
  const stageFunnel: StageFunnelItem[] = estimation.stage_funnel || [];

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.signal_name}</CardTitle>
          <Badge variant="outline">{pipeline.length} stages</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data flow fixes */}
        {currentPlan.data_flow_fixes && currentPlan.data_flow_fixes.length > 0 && (
          <div className="space-y-1">
            {currentPlan.data_flow_fixes.map((fix: string, i: number) => (
              <Alert key={`fix-${i}`} className="border-blue-500/50 bg-blue-500/10">
                <AlertTriangle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-xs text-blue-200">{fix}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Warnings */}
        {currentPlan.warnings && currentPlan.warnings.length > 0 && (
          <div className="space-y-2">
            {currentPlan.warnings.map((warning: string, i: number) => (
              <Alert key={i} className="border-yellow-500/50 bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-sm text-yellow-200">{warning}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold text-foreground">~{estimation.estimated_rows}</div>
            <div className="text-xs text-muted-foreground">Records to scan</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold text-primary">{estimation.credits_to_charge}</div>
            <div className="text-xs text-muted-foreground">Credits cost</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold text-foreground">~{estimation.estimated_leads}</div>
            <div className="text-xs text-muted-foreground">Est. final leads</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold text-foreground">{estimation.cost_per_lead}</div>
            <div className="text-xs text-muted-foreground">Credits per lead</div>
          </div>
        </div>

        {/* Pipeline Stages Visualization */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Pipeline Stages</h4>
          <div className="space-y-1.5">
            {pipeline.map((stage: any, i: number) => {
              const funnelItem = stageFunnel.find(f => f.stage === stage.stage);
              const isFilter = stage.type === 'ai_filter';
              const Icon = isFilter ? Filter : stage.actors?.includes('linkedin_people') ? Users : stage.actors?.includes('contact_enrichment') ? Mail : Search;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isFilter ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'}`}>
                    {stage.stage}
                  </div>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm flex-1">{stage.name}</span>
                  {funnelItem && (
                    <Badge variant="secondary" className="text-xs">~{funnelItem.estimated_count}</Badge>
                  )}
                  {i < pipeline.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Funnel visualization */}
        {stageFunnel.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
            {stageFunnel.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{item.estimated_count}</span>
                {i < stageFunnel.length - 1 && <ArrowRight className="h-3 w-3" />}
              </span>
            ))}
            <span className="ml-1">leads</span>
          </div>
        )}

        <Separator />

        <PlanActions
          scheduleType={scheduleType} setScheduleType={setScheduleType}
          onExecute={onExecute} onCancel={onCancel} isExecuting={isExecuting}
          credits={credits} creditsNeeded={estimation.credits_to_charge}
        />
      </CardContent>
    </Card>
  );
}

function LegacyPlanStats({ estimation }: { estimation: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center p-3 rounded-lg bg-muted">
        <div className="text-2xl font-bold text-foreground">~{estimation.estimated_rows}</div>
        <div className="text-xs text-muted-foreground">Records to scan</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted">
        <div className="text-2xl font-bold text-primary">{estimation.credits_to_charge}</div>
        <div className="text-xs text-muted-foreground">Credits cost</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted">
        <div className="text-2xl font-bold text-foreground">~{estimation.estimated_leads}</div>
        <div className="text-xs text-muted-foreground">Est. leads</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted">
        <div className="text-2xl font-bold text-foreground">{estimation.cost_per_lead}</div>
        <div className="text-xs text-muted-foreground">Credits per lead</div>
      </div>
    </div>
  );
}

function PlanActions({ scheduleType, setScheduleType, onExecute, onCancel, isExecuting, credits, creditsNeeded }: {
  scheduleType: string; setScheduleType: (v: 'once' | 'daily' | 'weekly') => void;
  onExecute: () => void; onCancel: () => void; isExecuting: boolean;
  credits: number; creditsNeeded: number;
}) {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Schedule:</span>
          <RadioGroup value={scheduleType} onValueChange={(v) => setScheduleType(v as any)} className="flex items-center gap-4">
            {['once', 'daily', 'weekly'].map(v => (
              <div key={v} className="flex items-center gap-1.5">
                <RadioGroupItem value={v} id={`sched-${v}`} />
                <Label htmlFor={`sched-${v}`} className="text-sm cursor-pointer capitalize">{v}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onExecute} disabled={isExecuting || credits < creditsNeeded}>
            {isExecuting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
            ) : (
              <><Play className="h-4 w-4" /> Run Pipeline ({creditsNeeded} credits)</>
            )}
          </Button>
        </div>
      </div>
      {credits < creditsNeeded && (
        <p className="text-sm text-destructive">
          Insufficient credits. You need {creditsNeeded - credits} more credits.
        </p>
      )}
    </>
  );
}

// ── Signal History Row (table format) ──

function SignalHistoryRow({ run, onView, onRerun, onDelete }: { run: SignalRun; onView: () => void; onRerun: () => void; onDelete: () => void }) {
  const { toast } = useToast();

  const STALE_HEARTBEAT_MS = 5 * 60 * 1000;
  const heartbeatField = (run as any).updated_at || run.started_at;
  const isStale = run.status === 'running' && heartbeatField &&
    (Date.now() - new Date(heartbeatField).getTime()) > STALE_HEARTBEAT_MS;

  const isPipeline = run.signal_plan && typeof run.signal_plan === 'object' && !Array.isArray(run.signal_plan) && 'pipeline' in (run.signal_plan as any);
  const pipelineStages = isPipeline ? ((run.signal_plan as any).pipeline || []) : [];
  const phase = run.processing_phase || '';
  const stageMatch = phase.match(/^stage_(\d+)_(.+)$/);
  const currentStage = stageMatch ? parseInt(stageMatch[1]) : 0;
  const currentSubPhase = stageMatch ? stageMatch[2] : phase;
  const totalStages = run.pipeline_stage_count || pipelineStages.length || 1;

  const markAsFailed = async () => {
    await supabase.from('signal_runs').update({ status: 'failed' }).eq('id', run.id);
    toast({ title: 'Signal marked as failed' });
    onRerun();
  };

  const displayStatus = isStale ? 'stale' : run.status;

  const getProgressLabel = () => {
    if (isPipeline && currentStage > 0) {
      const subLabels: Record<string, string> = {
        starting: 'Starting...', scraping: 'Scraping...', collecting: 'Collecting...', ai_filter: 'AI filtering...',
      };
      return `${currentStage}/${totalStages} — ${subLabels[currentSubPhase] || currentSubPhase}`;
    }
    const labels: Record<string, string> = { collecting: 'Collecting...', finalizing: 'Deduplicating...', scraping: 'Scraping...' };
    return labels[phase] || phase;
  };

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="p-3 align-middle">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate max-w-[250px]">{run.signal_name || run.signal_query}</div>
          {run.created_at && (
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
            </div>
          )}
          {run.error_message && run.status === 'failed' && (
            <div className="text-destructive text-xs truncate max-w-[250px] mt-0.5" title={run.error_message}>
              {run.error_message.slice(0, 60)}…
            </div>
          )}
        </div>
      </td>
      <td className="p-3 align-middle hidden md:table-cell">
        <div className="space-y-1">
          <StatusBadge status={displayStatus} />
          {run.status === 'running' && (
            <div className="space-y-1">
              <div className="text-xs text-primary">{getProgressLabel()}</div>
              {isPipeline && currentStage > 0 && (
                <Progress value={(currentStage / totalStages) * 100} className="h-1 w-24" />
              )}
            </div>
          )}
        </div>
      </td>
      <td className="p-3 align-middle hidden sm:table-cell">
        <span className="text-sm font-medium">{run.leads_discovered}</span>
      </td>
      <td className="p-3 align-middle hidden lg:table-cell">
        <span className="text-sm">{run.actual_cost ?? run.estimated_cost}</span>
        {run.actual_cost === 0 && run.status === 'completed' && (
          <span className="text-xs text-green-500 ml-1">free</span>
        )}
      </td>
      <td className="p-3 align-middle hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          {run.schedule_type !== 'once' && (
            <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{run.schedule_type}</Badge>
          )}
          {run.retry_count > 0 && <span className="text-xs text-orange-400">⟳{run.retry_count}</span>}
        </div>
      </td>
      <td className="p-3 align-middle text-right">
        <div className="flex gap-1 justify-end">
          {isStale && (
            <Button size="sm" variant="outline" className="text-destructive h-7 text-xs" onClick={markAsFailed}>Mark Failed</Button>
          )}
          {run.status === 'completed' && run.leads_discovered > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onView}>View</Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onRerun}><RotateCcw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
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
    queued: '⏳ queued', stale: '⚠ stale', running: '⚙ running',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${variants[status] || variants.draft}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Signal Results View ──

function SignalResultsView({ runId, onClose, workspaceId }: { runId: string; onClose: () => void; workspaceId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [savedApolloIds, setSavedApolloIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Server-side paginated query
  const { data: leadsResult, isLoading } = useQuery({
    queryKey: ['signal-leads', runId, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('signal_leads')
        .select('*', { count: 'exact' })
        .eq('run_id', runId)
        .order('discovered_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { leads: (data || []) as SignalLead[], totalCount: count || 0 };
    },
  });

  const leads = leadsResult?.leads || [];
  const totalCount = leadsResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Helper to fetch ALL leads for bulk operations across pages
  const fetchAllLeads = async (): Promise<SignalLead[]> => {
    const { data, error } = await supabase
      .from('signal_leads')
      .select('*')
      .eq('run_id', runId)
      .order('discovered_at', { ascending: false })
      .limit(10000);
    if (error) throw error;
    return (data || []) as SignalLead[];
  };

  const addToCRM = async (lead: SignalLead) => {
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const nameParts = (lead.contact_name || '').trim().split(/\s+/);
    const { error } = await supabase.from('leads').insert([{
      workspace_id: workspaceId, created_by: userId,
      first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '',
      company: lead.company_name || '', company_domain: lead.domain || '',
      title: lead.title || '',
      phone: lead.enriched ? lead.phone : null,
      email: lead.enriched ? lead.email : null,
      linkedin_url: lead.linkedin_profile_url || lead.linkedin || '',
      city: lead.city || '', state: lead.state || '', country: lead.country || '',
      industry: lead.industry || '', employee_count: lead.employee_count || '',
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
    let targetLeads: SignalLead[];
    if (selectAllAcrossPages) {
      const allLeads = await fetchAllLeads();
      targetLeads = allLeads.filter(l => !l.added_to_crm);
    } else if (selectedIds.size > 0) {
      targetLeads = leads.filter(l => selectedIds.has(l.id) && !l.added_to_crm);
    } else {
      targetLeads = leads.filter(l => !l.added_to_crm);
    }
    if (targetLeads.length === 0) return;
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const rows = targetLeads.map((lead) => {
      const nameParts = (lead.contact_name || '').trim().split(/\s+/);
      return {
        workspace_id: workspaceId, created_by: userId,
        first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '',
        company: lead.company_name || '', company_domain: lead.domain || '',
        title: lead.title || '',
        phone: lead.enriched ? lead.phone : null,
        email: lead.enriched ? lead.email : null,
        linkedin_url: lead.linkedin_profile_url || lead.linkedin || '',
        city: lead.city || '', state: lead.state || '', country: lead.country || '',
        industry: lead.industry || '', employee_count: lead.employee_count || '',
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
    setSelectAllAcrossPages(false);
    queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
  };

  const enrichLeadMutation = useMutation({
    mutationFn: async (lead: SignalLead) => {
      if (lead.email || lead.phone) {
        await supabase.from('signal_leads').update({ enriched: true }).eq('id', lead.id);
        if (lead.added_to_crm) {
          const { data: crmLeads } = await supabase
            .from('leads').select('id').eq('workspace_id', workspaceId).eq('company', lead.company_name).limit(1);
          if (crmLeads && crmLeads.length > 0) {
            const updates: Record<string, string> = {};
            if (lead.email) updates.email = lead.email;
            if (lead.phone) updates.phone = lead.phone;
            await supabase.from('leads').update(updates).eq('id', crmLeads[0].id);
          }
        }
        return { source: 'apify', email: lead.email, phone: lead.phone };
      }
      if (!lead.added_to_crm) await addToCRM(lead);
      const { data, error } = await supabase.functions.invoke('apollo-enrich', {
        body: { workspace_id: workspaceId, domain: lead.domain, company_name: lead.company_name },
      });
      if (error) throw error;
      await supabase.from('signal_leads').update({ enriched: true }).eq('id', lead.id);
      return { source: 'apollo', ...data };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['signal-leads', runId] });
      await queryClient.invalidateQueries({ queryKey: ['lead-credits'] });
      toast({
        title: data.source === 'apify' ? 'Contact info revealed' : 'Enrichment started',
        description: data.source === 'apify'
          ? 'Contact details are now visible.'
          : 'Apollo enrichment queued — data will appear shortly.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Enrichment failed', description: err.message, variant: 'destructive' });
    },
  });

  const saveToApolloLeads = async (targetLeads: SignalLead[]): Promise<string[]> => {
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const rows = targetLeads.map((lead) => ({
      workspace_id: workspaceId,
      apollo_id: `signal_${lead.id}`,
      first_name: (lead.contact_name || '').trim().split(/\s+/)[0] || lead.company_name || '',
      last_name: (lead.contact_name || '').trim().split(/\s+/).slice(1).join(' ') || '',
      company_name: lead.company_name || '',
      company_domain: lead.domain || '',
      title: lead.title || '',
      email: lead.enriched ? lead.email : null,
      phone: lead.enriched ? lead.phone : null,
      linkedin_url: lead.linkedin_profile_url || lead.linkedin || '',
      city: lead.city || '', state: lead.state || '', country: lead.country || '',
      industry: lead.industry || '', employee_count: lead.employee_count || '',
      enrichment_status: lead.enriched ? 'enriched' : 'pending',
    }));
    const { data, error } = await supabase.from('apollo_leads').upsert(rows, { onConflict: 'workspace_id,apollo_id', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    return (data || []).map(d => d.id);
  };

  const saveLeadMutation = useMutation({
    mutationFn: async (lead: SignalLead) => {
      const ids = await saveToApolloLeads([lead]);
      return ids;
    },
    onSuccess: () => {
      toast({ title: 'Lead saved to marketplace' });
      queryClient.invalidateQueries({ queryKey: ['apollo-leads'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save lead', description: err.message, variant: 'destructive' });
    },
  });

  const handleAddToList = async () => {
    let targetLeads: SignalLead[];
    if (selectAllAcrossPages) {
      targetLeads = await fetchAllLeads();
    } else if (selectedIds.size > 0) {
      targetLeads = leads.filter(l => selectedIds.has(l.id));
    } else {
      targetLeads = leads;
    }
    try {
      const ids = await saveToApolloLeads(targetLeads);
      setSavedApolloIds(ids);
      setAddToListOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to save leads', description: err.message, variant: 'destructive' });
    }
  };

  const handleExportCSV = async () => {
    toast({ title: 'Exporting...', description: 'Preparing CSV export' });
    const allLeads = await fetchAllLeads();
    exportLeadsToCSV(allLeads, `signal-leads-${runId.slice(0, 8)}`);
  };

  const toggleSelect = (id: string) => {
    setSelectAllAcrossPages(false);
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
      setSelectAllAcrossPages(false);
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
    setSelectAllAcrossPages(false);
  };

  if (isLoading) {
    return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const notInCrmCount = selectAllAcrossPages
    ? totalCount
    : selectedIds.size > 0
      ? leads.filter(l => selectedIds.has(l.id) && !l.added_to_crm).length
      : leads.filter(l => !l.added_to_crm).length;

  const formatLocation = (lead: SignalLead) => {
    const parts = [lead.city, lead.state, lead.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : lead.location || '';
  };

  const formatIndustry = (industry: string) => {
    if (!industry) return '';
    let clean = industry.replace(/ and /gi, ' & ').replace(/,\s*/g, ', ');
    const parts = clean.split(',').map(s => s.trim());
    if (parts.length > 1) clean = parts[0];
    return clean.length > 30 ? clean.slice(0, 28) + '…' : clean;
  };

  const allOnPageSelected = leads.length > 0 && selectedIds.size === leads.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Signal Results — {totalCount.toLocaleString()} leads</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddToList}>
              <List className="h-3.5 w-3.5 mr-1" />
              {selectAllAcrossPages ? `Add All to List (${totalCount})` : selectedIds.size > 0 ? `Add to List (${selectedIds.size})` : 'Add All to List'}
            </Button>
            {notInCrmCount > 0 && (
              <Button size="sm" variant="outline" onClick={addAllToCRM}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {selectAllAcrossPages ? `Add All to CRM (${totalCount})` : selectedIds.size > 0 ? `Add to CRM (${notInCrmCount})` : `Add All to CRM (${notInCrmCount})`}
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
          <>
            {/* Select all across pages banner */}
            {allOnPageSelected && totalCount > PAGE_SIZE && !selectAllAcrossPages && (
              <div className="bg-muted border border-border rounded-md px-4 py-2 mb-3 flex items-center justify-between text-sm">
                <span>All {leads.length} leads on this page are selected.</span>
                <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => setSelectAllAcrossPages(true)}>
                  Select all {totalCount.toLocaleString()} leads across all pages
                </Button>
              </div>
            )}
            {selectAllAcrossPages && (
              <div className="bg-primary/10 border border-primary/30 rounded-md px-4 py-2 mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">All {totalCount.toLocaleString()} leads across all pages are selected.</span>
                <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => { setSelectAllAcrossPages(false); setSelectedIds(new Set()); }}>
                  Clear selection
                </Button>
              </div>
            )}

            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors">
                    <th className="h-10 px-2 text-left align-middle w-10">
                      <input type="checkbox" checked={allOnPageSelected || selectAllAcrossPages} onChange={toggleAll} className="rounded border-border" />
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
                        <input type="checkbox" checked={selectedIds.has(lead.id) || selectAllAcrossPages} onChange={() => toggleSelect(lead.id)} className="rounded border-border" />
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
                        {lead.industry ? (
                          <Badge variant="secondary" className="text-xs font-normal max-w-[140px] truncate" title={lead.industry}>
                            {formatIndustry(lead.industry)}
                          </Badge>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 align-middle">
                        <div className="flex gap-1">
                          {lead.website && (
                            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground">
                              <Globe className="h-4 w-4" />
                            </a>
                          )}
                          {lead.linkedin_profile_url && (
                            <a href={lead.linkedin_profile_url.startsWith('http') ? lead.linkedin_profile_url : `https://${lead.linkedin_profile_url}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground" title="Person Profile">
                              <User className="h-4 w-4" />
                            </a>
                          )}
                          {!lead.linkedin_profile_url && lead.linkedin && !lead.company_linkedin_url && (
                            <a href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://${lead.linkedin}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground" title="Company LinkedIn">
                              <Building2 className="h-4 w-4" />
                            </a>
                          )}
                          {lead.company_linkedin_url && (
                            <a href={lead.company_linkedin_url.startsWith('http') ? lead.company_linkedin_url : `https://${lead.company_linkedin_url}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground" title="Company LinkedIn">
                              <Building2 className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-3 align-middle">
                        {lead.enriched ? (
                          <div className="space-y-0.5">
                            {lead.email && <div className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</div>}
                            {lead.phone && <div className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>}
                            {!lead.email && !lead.phone && <span className="text-xs text-muted-foreground">No data found</span>}
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => enrichLeadMutation.mutate(lead)} disabled={enrichLeadMutation.isPending}>
                            {enrichLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                            Reveal
                          </Button>
                        )}
                      </td>
                      <td className="p-3 align-middle text-right">
                        <div className="flex gap-1 justify-end">
                          {!lead.added_to_crm && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addToCRM(lead)}>
                              <Plus className="h-3 w-3 mr-1" /> CRM
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem onClick={() => saveLeadMutation.mutate(lead)}>
                                <Bookmark className="h-4 w-4 mr-2" /> Save Lead
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                try {
                                  const ids = await saveToApolloLeads([lead]);
                                  setSavedApolloIds(ids);
                                  setAddToListOpen(true);
                                } catch (err: any) {
                                  toast({ title: 'Failed', description: err.message, variant: 'destructive' });
                                }
                              }}>
                                <List className="h-4 w-4 mr-2" /> Add to List
                              </DropdownMenuItem>
                              {lead.added_to_crm && (
                                <DropdownMenuItem asChild>
                                  <a href="/crm"><Mail className="h-4 w-4 mr-2" /> Outreach</a>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CRMPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </CardContent>

      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        selectedLeadIds={savedApolloIds}
        onSuccess={() => {
          setSavedApolloIds([]);
          toast({ title: 'Leads added to list' });
        }}
      />
    </Card>
  );
}
