import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useOfferDiagnosticState } from '@/hooks/useOfferDiagnosticState';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, BookOpen, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';

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
}

export default function ScriptBuilder() {
  const { savedState, isLoading: isLoadingState } = useOfferDiagnosticState();
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const hasEvaluation = savedState?.latent_alignment_score !== null && savedState?.latent_alignment_score !== undefined;

  const handleGenerate = async () => {
    if (!savedState || !hasEvaluation) {
      toast.error('Complete the Offer Diagnostic first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: { offerContext: savedState },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResult(data as ScriptResult);
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
    // Simple markdown-like rendering
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-foreground">{line.slice(2)}</h2>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-semibold mt-5 mb-2 text-foreground">{line.slice(3)}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-muted-foreground list-disc">{line.slice(2)}</li>;
      }
      if (line.startsWith('> ')) {
        return <blockquote key={i} className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground my-2">{line.slice(2)}</blockquote>;
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Bold within text
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className="text-muted-foreground leading-relaxed">
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
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
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Script Builder</h1>
          <p className="text-muted-foreground mt-1">
            Generate a structured outbound script from your Offer Diagnostic results.
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
                  The script is built entirely from your diagnostic inputs and scores.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary of current diagnostic */}
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

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Script & Progression Rules...
                </>
              ) : result ? (
                'Regenerate Script'
              ) : (
                'Generate Script'
              )}
            </Button>

            {result && (
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
                      <ScrollArea className="max-h-[600px]">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {renderMarkdown(result.script)}
                        </div>
                      </ScrollArea>
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
                        <ScrollArea className="max-h-[600px]">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {renderMarkdown(result.progressionRules)}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
