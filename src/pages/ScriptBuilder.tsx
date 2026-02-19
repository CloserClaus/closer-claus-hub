import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useOfferDiagnosticState } from '@/hooks/useOfferDiagnosticState';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { FileText, BookOpen, Loader2, AlertTriangle, Copy, Check, RefreshCw, Download, Send, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { ProgressLoadingBar } from '@/components/ui/progress-loading-bar';
import { SendToSDRDialog } from '@/components/scripts/SendToSDRDialog';
import { format } from 'date-fns';

interface ObjectionItem {
  category: string;
  phase: string;
  objection: string;
  meaning: string;
  understanding: string;
  strategy: string;
  what_to_say: string;
  if_they_resist: string;
  if_they_engage: string;
  return_to_beat: string;
}

interface ScriptResult {
  script: string;
  progressionRules: string | null;
  objectionPlaybook: ObjectionItem[] | null;
  types: {
    opener: string;
    bridge: string;
    discovery: string;
    frame: string;
    cta: string;
  };
  isValidationMode: boolean;
  confidenceBand: 'low' | 'medium' | 'high';
}

const OBJECTION_CATEGORIES = [
  'Brush-Off Resistance',
  'Authority Resistance',
  'Timing Resistance',
  'Skepticism Resistance',
  'Status Quo Resistance',
  'Pricing Resistance',
] as const;

const PHASES = [
  'Likely First Objections',
  'Common Mid-Call Objections',
  'Late-Stage Objections',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Brush-Off Resistance': 'bg-muted text-muted-foreground border-border',
  'Authority Resistance': 'bg-primary/10 text-primary border-primary/20',
  'Timing Resistance': 'bg-muted text-foreground border-border',
  'Skepticism Resistance': 'bg-muted text-muted-foreground border-border',
  'Status Quo Resistance': 'bg-secondary text-secondary-foreground border-border',
  'Pricing Resistance': 'bg-muted text-foreground border-border',
};

function ObjectionCard({ item, index }: { item: ObjectionItem; index: number }) {
  const [open, setOpen] = useState(false);
  const categoryColor = CATEGORY_COLORS[item.category] || 'bg-muted text-muted-foreground border-border';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
            <div className="mt-0.5 shrink-0">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={`text-xs shrink-0 ${categoryColor}`}>
                  {item.category}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug">
                "{item.objection}"
              </p>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mx-1 mb-2 border border-t-0 border-border rounded-b-lg bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {/* Meaning */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What This Really Means</p>
              <p className="text-sm text-foreground leading-relaxed">{item.meaning}</p>
            </div>

            {/* What Rep Should Understand */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What You Should Understand</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.understanding}</p>
            </div>

            {/* Strategy */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recommended Strategy</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.strategy}</p>
            </div>

            {/* What To Say */}
            <div className="px-4 py-3 bg-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">What To Say</p>
              <p className="text-sm font-medium text-foreground leading-relaxed">"{item.what_to_say}"</p>
            </div>

            {/* If They Resist / If They Engage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-destructive/70 uppercase tracking-wide mb-1">If They Resist</p>
                <p className="text-sm text-muted-foreground leading-relaxed">"{item.if_they_resist}"</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">If They Engage</p>
                <p className="text-sm text-muted-foreground leading-relaxed">"{item.if_they_engage}"</p>
              </div>
            </div>

            {/* Return to Beat */}
            <div className="px-4 py-2.5 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Return To Script Step:</span>{' '}
                <span className="text-foreground">{item.return_to_beat}</span>
              </p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ObjectionPlaybookTab({ objections }: { objections: ObjectionItem[] }) {
  // Group by phase
  const byPhase: Record<string, ObjectionItem[]> = {};
  for (const phase of PHASES) {
    byPhase[phase] = objections.filter(o => o.phase === phase);
  }

  const totalCount = objections.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Objection Playbook
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {totalCount} contextual objection{totalCount !== 1 ? 's' : ''} — tap to expand. Acknowledge, reframe, ask.
            </p>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-6">
        {PHASES.map(phase => {
          const items = byPhase[phase] || [];
          if (items.length === 0) return null;
          return (
            <div key={phase}>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-semibold text-foreground">{phase}</h4>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <ObjectionCard key={`${phase}-${idx}`} item={item} index={idx} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Fallback: uncategorized by phase */}
        {objections.filter(o => !PHASES.includes(o.phase as any)).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Other Objections</h4>
            </div>
            <div className="space-y-2">
              {objections
                .filter(o => !PHASES.includes(o.phase as any))
                .map((item, idx) => (
                  <ObjectionCard key={`other-${idx}`} item={item} index={idx} />
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ScriptBuilder() {
  const { savedState, isLoading: isLoadingState } = useOfferDiagnosticState();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [deliveryMechanism, setDeliveryMechanism] = useState('');
  const [isRestored, setIsRestored] = useState(false);
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sendToSDROpen, setSendToSDROpen] = useState(false);

  const hasEvaluation = savedState?.latent_alignment_score !== null && savedState?.latent_alignment_score !== undefined;
  const canGenerate = hasEvaluation && deliveryMechanism.trim().length > 0;

  // Restore persisted script on load
  useEffect(() => {
    if (isRestored || isLoadingState || !savedState || !currentWorkspace?.id || !user?.id) return;

    const restoreScript = async () => {
      const { data } = await supabase
        .from('offer_diagnostic_state')
        .select('delivery_mechanism, generated_script, generated_progression_rules, script_types, script_is_validation_mode, script_generated_at, script_diagnostic_version')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        if ((data as any).delivery_mechanism) {
          setDeliveryMechanism((data as any).delivery_mechanism);
        }
        if ((data as any).generated_script) {
          const score = savedState?.latent_alignment_score || 0;
          const proof = savedState?.proof_level || 'none';
          const maturity = savedState?.icp_maturity || 'early';
          let band: 'low' | 'medium' | 'high' = 'medium';
          if (score < 40 || ['none', 'weak'].includes(proof) || maturity === 'early') band = 'low';
          else if (score >= 70 && ['strong', 'category_killer'].includes(proof) && ['scaling', 'mature', 'enterprise'].includes(maturity)) band = 'high';

          // Try to restore objection playbook from localStorage (it's not persisted in DB)
          let restoredObjections: ObjectionItem[] | null = null;
          try {
            const key = `objection_playbook_${currentWorkspace.id}_${user.id}`;
            const stored = localStorage.getItem(key);
            if (stored) restoredObjections = JSON.parse(stored);
          } catch {}

          setResult({
            script: (data as any).generated_script,
            progressionRules: (data as any).generated_progression_rules || null,
            objectionPlaybook: restoredObjections,
            types: (data as any).script_types || { opener: '', bridge: '', discovery: '', frame: '', cta: '' },
            isValidationMode: (data as any).script_is_validation_mode || false,
            confidenceBand: band,
          });
          const scriptVersion = (data as any).script_diagnostic_version;
          if (scriptVersion && savedState?.version && scriptVersion < savedState.version) {
            setNeedsRegeneration(true);
          }
        }
      }
      setIsRestored(true);
    };

    restoreScript();
  }, [isLoadingState, savedState, currentWorkspace?.id, user?.id, isRestored]);

  const handleGenerate = async () => {
    if (!savedState || !hasEvaluation || !canGenerate) {
      toast.error('Complete all required fields first');
      return;
    }

    setIsGenerating(true);
    setNeedsRegeneration(false);
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: { offerContext: savedState, deliveryMechanism: deliveryMechanism.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const scriptResult = data as ScriptResult;
      // Auto-standardize placeholders for Dialer compatibility
      scriptResult.script = standardizePlaceholders(scriptResult.script);
      if (scriptResult.progressionRules) {
        scriptResult.progressionRules = standardizePlaceholders(scriptResult.progressionRules);
      }
      setResult(scriptResult);

      // Persist objection playbook to localStorage (not in DB schema)
      if (scriptResult.objectionPlaybook && currentWorkspace?.id && user?.id) {
        try {
          const key = `objection_playbook_${currentWorkspace.id}_${user.id}`;
          localStorage.setItem(key, JSON.stringify(scriptResult.objectionPlaybook));
        } catch {}
      }

      // Persist the generated script to DB
      if (currentWorkspace?.id && user?.id) {
        await supabase
          .from('offer_diagnostic_state')
          .update({
            delivery_mechanism: deliveryMechanism.trim(),
            generated_script: scriptResult.script,
            generated_progression_rules: scriptResult.progressionRules,
            script_types: scriptResult.types as any,
            script_is_validation_mode: scriptResult.isValidationMode,
            script_generated_at: new Date().toISOString(),
            script_diagnostic_version: savedState.version || 1,
          } as any)
          .eq('workspace_id', currentWorkspace.id)
          .eq('user_id', user.id);
      }

      toast.success('Script generated and saved');
    } catch (err: any) {
      console.error('Script generation error:', err);
      toast.error('Failed to generate script. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const standardizePlaceholders = (text: string): string => {
    return text
      .replace(/\[Name\]/gi, '{{first_name}}')
      .replace(/\[First Name\]/gi, '{{first_name}}')
      .replace(/\[Last Name\]/gi, '{{last_name}}')
      .replace(/\[Company\]/gi, '{{company}}')
      .replace(/\[Company Name\]/gi, '{{company}}')
      .replace(/\[Title\]/gi, '{{title}}')
      .replace(/\[Job Title\]/gi, '{{title}}')
      .replace(/\[Email\]/gi, '{{email}}')
      .replace(/\[Phone\]/gi, '{{phone}}')
      .replace(/\[Phone Number\]/gi, '{{phone}}');
  };

  const generateScriptTitle = (): string => {
    const offerType = savedState?.offer_type?.replace(/_/g, ' ') || 'Script';
    const icp = savedState?.icp_industry?.replace(/_/g, ' ') || 'General';
    const timestamp = format(new Date(), 'MMM d, h:mm a');
    return `${offerType} – ${icp} – ${timestamp}`;
  };

  const handleImportToDialer = async () => {
    if (!result || !currentWorkspace?.id || !user?.id) return;

    setIsImporting(true);
    try {
      const title = generateScriptTitle();
      const content = standardizePlaceholders(result.script);

      const { error } = await supabase
        .from('call_scripts')
        .insert({
          workspace_id: currentWorkspace.id,
          title,
          content,
          is_default: false,
          created_by: user.id,
        });

      if (error) throw error;
      toast.success('Script imported to Dialer');
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import script');
    } finally {
      setIsImporting(false);
    }
  };

  const cleanScriptText = (text: string): string => {
    return text.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*Intent:')) return false;
      if (trimmed.startsWith('*Expected response:')) return false;
      if (trimmed.startsWith('*(') && trimmed.endsWith(')*')) return false;
      if (trimmed.startsWith('**Prospect:**') || trimmed.startsWith('**Prospect: **')) return false;
      if (/^>\s*This is not meant to be read/i.test(trimmed)) return false;
      if (/CONFIDENCE BAND/i.test(trimmed)) return false;
      if (/REP FREEDOM/i.test(trimmed)) return false;
      if (/ANTI-ROBOTIC/i.test(trimmed)) return false;
      return true;
    }).join('\n');
  };

  const renderScriptMarkdown = (text: string) => {
    const cleaned = cleanScriptText(text);
    return cleaned.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-semibold mt-6 mb-3 text-foreground border-b border-border pb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h4>;
      }
      if (line.startsWith('**Rep:**') || line.startsWith('**Rep: **')) {
        const content = line.replace(/^\*\*Rep:\s?\*\*\s*/, '');
        return (
          <div key={i} className="mt-2 mb-1 bg-primary/5 border-l-2 border-primary rounded-r-md px-3 py-2">
            <span className="text-foreground font-medium text-sm">{renderInlineFormatting(content)}</span>
          </div>
        );
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-4 mb-1 text-sm">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('> ')) {
        return null;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-muted-foreground list-disc text-sm leading-relaxed">{renderInlineFormatting(line.slice(2))}</li>;
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <div key={i} className="mt-1.5 mb-1 bg-primary/5 border-l-2 border-primary rounded-r-md px-3 py-2">
          <span className="text-foreground font-medium text-sm">{renderInlineFormatting(line)}</span>
        </div>
      );
    });
  };

  const renderRulesMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-semibold mt-6 mb-3 text-foreground border-b border-border pb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-3 mb-1 text-sm">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-muted-foreground list-disc text-sm leading-relaxed">{renderInlineFormatting(line.slice(2))}</li>;
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={i} className="border-l-2 border-border bg-muted/40 pl-4 py-2 italic text-muted-foreground my-2 rounded-r-md text-sm">
            {line.slice(2)}
          </blockquote>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} className="text-muted-foreground leading-relaxed text-sm">
          {renderInlineFormatting(line)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  if (isLoadingState) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 pb-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Script Builder</h1>
            <p className="text-muted-foreground mt-1">
              Generate a beginner-safe cold call script designed to earn 2–3 minutes of attention and book a meeting.
            </p>
          </div>
          {result && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportToDialer}
                disabled={isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Import to Dialer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendToSDROpen(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Send to SDR
              </Button>
            </div>
          )}
        </div>

        {!hasEvaluation ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Offer Diagnostic Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete and evaluate your offer in the Offer Diagnostic before generating a script.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Offer Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Offer Snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{savedState?.offer_type?.replace(/_/g, ' ') || 'N/A'}</Badge>
                  <Badge variant="outline">{savedState?.icp_industry?.replace(/_/g, ' ') || 'N/A'}</Badge>
                  <Badge variant="outline">{savedState?.pricing_structure?.replace(/_/g, ' ') || 'N/A'}</Badge>
                  <Badge variant="outline">Proof: {savedState?.proof_level?.replace(/_/g, ' ') || 'N/A'}</Badge>
                  <Badge variant={savedState?.latent_readiness_label === 'Strong' ? 'default' : savedState?.latent_readiness_label === 'Moderate' ? 'secondary' : 'destructive'}>
                    {savedState?.latent_readiness_label || 'N/A'} — {savedState?.latent_alignment_score}/100
                  </Badge>
                </div>
                {savedState?.latent_readiness_label === 'Weak' && (
                  <p className="text-sm text-destructive mt-3">
                    Your offer is not yet outbound-ready. The generated script will be in validation mode — focused on learning, not closing.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Delivery Mechanism Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">How do you deliver this outcome?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="In 1-2 sentences, describe the actual mechanism you use to create the promised result..."
                  value={deliveryMechanism}
                  onChange={(e) => setDeliveryMechanism(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Examples: SEO, paid ads, inbound call handling, automation, consulting, systems, AI assistants, or a custom process.
                </p>
                {!deliveryMechanism.trim() && (
                  <p className="text-xs text-destructive">
                    Please describe how you deliver this outcome so the script matches your real service.
                  </p>
                )}
              </CardContent>
            </Card>

            {needsRegeneration && result && (
              <Card className="border-border bg-muted/30">
                <CardContent className="flex items-start gap-3 pt-6">
                  <RefreshCw className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Offer Diagnostic Updated</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your diagnostic inputs have changed since this script was generated. Click "Regenerate Script" to create an updated version.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isGenerating ? (
              <Card>
                <CardContent className="pt-6 pb-6">
                  <ProgressLoadingBar
                    isActive={isGenerating}
                    durationMs={45000}
                    messages={[
                      'Mapping script structure',
                      'Aligning opener with offer context',
                      'Generating discovery and progression logic',
                      'Building adaptive conversation flow',
                      'Calibrating decision playbook',
                      'Generating objection playbook',
                      'Mapping contextual objections to ICP',
                      'Finalizing all three sections',
                    ]}
                    messageIntervalMs={5000}
                  />
                </CardContent>
              </Card>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                className="w-full"
              >
                {result ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Script
                  </>
                ) : (
                  'Generate Script'
                )}
              </Button>
            )}

            {result && (
              <>
                <Tabs defaultValue="script" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="script" className="flex-1 gap-1.5 text-xs sm:text-sm">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">What to Say</span>
                      <span className="xs:hidden">Say</span>
                    </TabsTrigger>
                    <TabsTrigger value="progression" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled={!result.progressionRules}>
                      <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">How to Think</span>
                      <span className="xs:hidden">Think</span>
                    </TabsTrigger>
                    <TabsTrigger value="objections" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled={!result.objectionPlaybook}>
                      <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">Objection Playbook</span>
                      <span className="xs:hidden">Objections</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="script">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base">What to Say — Read This Verbatim</CardTitle>
                          {result.isValidationMode && (
                            <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                              Exploration Mode
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(result.script, 'script')}
                        >
                          {copiedSection === 'script' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </CardHeader>
                      <Separator />
                      <CardContent className="pt-4">
                        <div className="max-w-none">
                          {renderScriptMarkdown(result.script)}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="progression">
                    {result.progressionRules && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base">Decision Playbook</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Behavior guide — not decisions, just how to act
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.progressionRules!, 'progression')}
                          >
                            {copiedSection === 'progression' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-4">
                          <div className="max-w-none">
                            {renderRulesMarkdown(result.progressionRules)}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="objections">
                    {result.objectionPlaybook && result.objectionPlaybook.length > 0 ? (
                      <ObjectionPlaybookTab objections={result.objectionPlaybook} />
                    ) : (
                      <Card>
                        <CardContent className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Regenerate the script to generate your Objection Playbook.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>

                <SendToSDRDialog
                  open={sendToSDROpen}
                  onOpenChange={setSendToSDROpen}
                  scriptTitle={generateScriptTitle()}
                  scriptContent={standardizePlaceholders(result.script)}
                  playbookContent={result.progressionRules ? standardizePlaceholders(result.progressionRules) : null}
                  objectionPlaybook={result.objectionPlaybook}
                />
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
