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
import { FileText, BookOpen, Loader2, AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { ProgressLoadingBar } from '@/components/ui/progress-loading-bar';

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

  // Filter out meta lines from script content for clean display
  const cleanScriptText = (text: string): string => {
    return text.split('\n').filter(line => {
      const trimmed = line.trim();
      // Remove intent labels, expected response, pause cues, confidence bands, coaching
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
      // Rep lines — clean, just the spoken text
      if (line.startsWith('**Rep:**') || line.startsWith('**Rep: **')) {
        const content = line.replace(/^\*\*Rep:\s?\*\*\s*/, '');
        return (
          <div key={i} className="mt-2 mb-1 bg-primary/5 border-l-2 border-primary rounded-r-md px-3 py-2">
            <span className="text-foreground font-medium text-sm">{renderInlineFormatting(content)}</span>
          </div>
        );
      }
      // Bold-only lines (sub-headers like "Step 1")
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-4 mb-1 text-sm">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('> ')) {
        return null; // Skip blockquotes in script view
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-muted-foreground list-disc text-sm leading-relaxed">{renderInlineFormatting(line.slice(2))}</li>;
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Regular text — treat as speakable line
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
          <blockquote key={i} className="border-l-2 border-amber-500/50 bg-amber-500/5 pl-4 py-2 italic text-muted-foreground my-2 rounded-r-md text-sm">
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Script Builder</h1>
          <p className="text-muted-foreground mt-1">
            Generate a beginner-safe cold call script designed to earn 2–3 minutes of attention and book a meeting.
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

            {isGenerating ? (
              <Card>
                <CardContent className="pt-6 pb-6">
                  <ProgressLoadingBar
                    isActive={isGenerating}
                    durationMs={30000}
                    messages={[
                      'Mapping script structure',
                      'Aligning opener with offer context',
                      'Generating discovery and progression logic',
                      'Building adaptive conversation flow',
                      'Calibrating decision playbook',
                      'Finalizing script output',
                    ]}
                    messageIntervalMs={4500}
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
                    <TabsTrigger value="script" className="flex-1 gap-2">
                      <FileText className="h-4 w-4" />
                      What to Say
                    </TabsTrigger>
                    <TabsTrigger value="progression" className="flex-1 gap-2" disabled={!result.progressionRules}>
                      <BookOpen className="h-4 w-4" />
                      How to Think
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
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
