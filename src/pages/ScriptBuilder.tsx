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
import { toast } from 'sonner';
import { FileText, BookOpen, Loader2, AlertTriangle, Copy, Check, RefreshCw, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface ScriptResult {
  script: string;
  progressionRules: string | null;
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

const confidenceBandConfig = {
  low: {
    label: 'Low Confidence',
    description: 'Follow the script closely. Minimal improvisation.',
    icon: ShieldAlert,
    variant: 'destructive' as const,
    bgClass: 'bg-destructive/5 border-destructive/20',
  },
  medium: {
    label: 'Medium Confidence',
    description: 'Use as a strong guide. Paraphrase while preserving intent.',
    icon: Shield,
    variant: 'secondary' as const,
    bgClass: 'bg-amber-500/5 border-amber-500/20',
  },
  high: {
    label: 'High Confidence',
    description: 'Use as a reference framework. Customize freely.',
    icon: ShieldCheck,
    variant: 'default' as const,
    bgClass: 'bg-emerald-500/5 border-emerald-500/20',
  },
};

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
          // Derive confidence band from saved state
          const score = savedState?.latent_alignment_score || 0;
          const proof = savedState?.proof_level || 'none';
          const maturity = savedState?.icp_maturity || 'early';
          let band: 'low' | 'medium' | 'high' = 'medium';
          if (score < 40 || ['none', 'weak'].includes(proof) || maturity === 'early') band = 'low';
          else if (score >= 70 && ['strong', 'category_killer'].includes(proof) && ['scaling', 'mature', 'enterprise'].includes(maturity)) band = 'high';

          setResult({
            script: (data as any).generated_script,
            progressionRules: (data as any).generated_progression_rules || null,
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
      setResult(scriptResult);

      // Persist the generated script
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

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Section headings
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-semibold mt-6 mb-3 text-foreground border-b border-border pb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h4>;
      }
      // Rep lines — highlight distinctly
      if (line.startsWith('**Rep:**') || line.startsWith('**Rep: **')) {
        const content = line.replace(/^\*\*Rep:\s?\*\*\s*/, '');
        return (
          <div key={i} className="flex items-start gap-2 mt-3 mb-1 bg-primary/5 border-l-2 border-primary rounded-r-md px-3 py-2">
            <span className="text-xs font-bold text-primary uppercase shrink-0 mt-0.5">Rep</span>
            <span className="text-foreground font-medium">{renderInlineFormatting(content)}</span>
          </div>
        );
      }
      // Prospect lines
      if (line.startsWith('**Prospect:**') || line.startsWith('**Prospect: **')) {
        const content = line.replace(/^\*\*Prospect:\s?\*\*\s*/, '');
        return (
          <div key={i} className="flex items-start gap-2 mt-1 mb-1 bg-muted/50 border-l-2 border-muted-foreground/30 rounded-r-md px-3 py-2">
            <span className="text-xs font-bold text-muted-foreground uppercase shrink-0 mt-0.5">Prospect</span>
            <span className="text-muted-foreground italic">{renderInlineFormatting(content)}</span>
          </div>
        );
      }
      // Pause/pacing cues — special styling
      if (line.trim().startsWith('*(') && line.trim().endsWith(')*')) {
        const content = line.trim().slice(2, -2);
        return (
          <div key={i} className="text-xs text-amber-600 dark:text-amber-400 italic ml-4 my-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {content}
          </div>
        );
      }
      // Intent/Expected response cues
      if (line.trim().startsWith('*Intent:') || line.trim().startsWith('*Expected response:')) {
        const content = line.trim().slice(1, -1); // remove outer *
        return (
          <p key={i} className="text-xs text-muted-foreground/70 italic ml-4 my-0.5">{content}</p>
        );
      }
      // Bold-only lines
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{line.slice(2, -2)}</p>;
      }
      // Blockquotes (anti-robotic notice)
      if (line.startsWith('> ')) {
        return (
          <blockquote key={i} className="border-l-2 border-amber-500/50 bg-amber-500/5 pl-4 py-2 italic text-muted-foreground my-3 rounded-r-md text-sm">
            {line.slice(2)}
          </blockquote>
        );
      }
      // List items
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-muted-foreground list-disc text-sm leading-relaxed">{renderInlineFormatting(line.slice(2))}</li>;
      }
      // Empty lines
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Default paragraph with inline formatting
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

  const bandConfig = result ? confidenceBandConfig[result.confidenceBand] : null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 pb-24">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Script Builder</h1>
          <p className="text-muted-foreground mt-1">
            Generate a structured, turn-based outbound script from your Offer Diagnostic results.
          </p>
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
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="flex items-start gap-3 pt-6">
                  <RefreshCw className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Offer Diagnostic Updated</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your diagnostic inputs have changed since this script was generated. Click "Regenerate Script" to create an updated version.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Script & Progression Rules...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Script
                </>
              ) : (
                'Generate Script'
              )}
            </Button>

            {result && (
              <>
                {/* Confidence Band Display */}
                {bandConfig && (
                  <Card className={bandConfig.bgClass}>
                    <CardContent className="flex items-start gap-3 pt-6">
                      <bandConfig.icon className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{bandConfig.label}</p>
                          <Badge variant={bandConfig.variant} className="text-xs">{result.confidenceBand.toUpperCase()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{bandConfig.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Tabs defaultValue="script" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="script" className="flex-1 gap-2">
                      <FileText className="h-4 w-4" />
                      Script
                    </TabsTrigger>
                    <TabsTrigger value="progression" className="flex-1 gap-2" disabled={!result.progressionRules}>
                      <BookOpen className="h-4 w-4" />
                      Progression Rules
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="script">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base">Outbound Script</CardTitle>
                          <div className="flex gap-1.5 flex-wrap">
                            {result.isValidationMode && (
                              <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                                Validation Mode
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">Opener: {result.types.opener}</Badge>
                            <Badge variant="outline" className="text-xs">Bridge: {result.types.bridge}</Badge>
                            <Badge variant="outline" className="text-xs">Discovery: {result.types.discovery}</Badge>
                            <Badge variant="outline" className="text-xs">Frame: {result.types.frame}</Badge>
                            <Badge variant="outline" className="text-xs">CTA: {result.types.cta}</Badge>
                          </div>
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
                          {renderMarkdown(result.script)}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="progression">
                    {result.progressionRules && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base">Progression Rules</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              How to navigate the conversation based on prospect responses
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
                            {renderMarkdown(result.progressionRules)}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
