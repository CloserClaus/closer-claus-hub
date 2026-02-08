import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Unlock,
  ArrowRight,
  Target,
  Gauge,
  Play,
  ArrowLeft,
} from 'lucide-react';
import type { DiagnosticFormData, StructuredRecommendation, FixCategory } from '@/lib/offerDiagnostic/types';
import type { LatentScores, LatentBottleneckKey, ReadinessLabel, PrimaryBottleneck } from '@/lib/offerDiagnostic/latentScoringEngine';
import { LATENT_SCORE_LABELS } from '@/lib/offerDiagnostic/latentScoringEngine';
import { evaluateOfferV2 } from '@/lib/offerDiagnostic/evaluateOfferV2';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORY_LABELS } from '@/lib/offerDiagnostic/types';

interface LocationState {
  formData: DiagnosticFormData;
  latentResult: {
    alignmentScore: number;
    readinessLabel: ReadinessLabel;
    latentScores: LatentScores;
    latentBottleneckKey: LatentBottleneckKey;
    bottleneckLabel: string;
    outboundReady: boolean;
    primaryBottleneck: PrimaryBottleneck;
    triggeredHardGates: string[];
    triggeredSoftGates: string[];
    scoreCap: number | null;
  };
  firstName: string;
  email: string;
  source: string;
}

const UNLOCK_TIME_SECONDS = 150; // 2.5 minutes

function getReadinessLabelColor(label: string) {
  switch (label) {
    case 'Strong': return 'text-green-500';
    case 'Moderate': return 'text-yellow-500';
    case 'Weak': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

function getReadinessLabelBg(label: string) {
  switch (label) {
    case 'Strong': return 'bg-green-500/10 border-green-500/30';
    case 'Moderate': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'Weak': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-muted border-muted';
  }
}

function getScoreInterpretation(score: number): string {
  if (score >= 80) {
    return 'This offer is structurally ready for outbound.';
  } else if (score >= 60) {
    return 'This offer can work in outbound with targeted fixes.';
  } else {
    return 'This offer will struggle in outbound without structural changes.';
  }
}

function getCategoryColor(category: FixCategory) {
  switch (category) {
    case 'icp_shift': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    case 'promise_shift': return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    case 'fulfillment_shift': return 'bg-green-500/10 text-green-600 border-green-500/30';
    case 'pricing_shift': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'risk_shift': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
    case 'positioning_shift': return 'bg-pink-500/10 text-pink-600 border-pink-500/30';
    case 'founder_psychology_check': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30';
    default: return 'bg-muted text-muted-foreground border-muted';
  }
}

export default function PublicOfferDiagnosticResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [timeRemaining, setTimeRemaining] = useState(UNLOCK_TIME_SECONDS);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [recommendations, setRecommendations] = useState<StructuredRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);

  // Redirect if no state
  useEffect(() => {
    if (!state) {
      navigate('/offer-diagnostic');
    }
  }, [state, navigate]);

  // Countdown timer
  useEffect(() => {
    if (isUnlocked) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsUnlocked(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isUnlocked]);

  // Fetch recommendations in background
  useEffect(() => {
    if (!state?.formData) return;

    const fetchRecommendations = async () => {
      try {
        const result = await evaluateOfferV2(state.formData);
        if (result?.recommendations) {
          setRecommendations(result.recommendations);
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setIsLoadingRecs(false);
      }
    };

    fetchRecommendations();
  }, [state?.formData]);

  // Store lead data and notify admin
  useEffect(() => {
    if (!state) return;

    const storeLeadData = async () => {
      try {
        await supabase.from('offer_diagnostic_leads' as any).insert({
          first_name: state.firstName,
          email: state.email,
          source: state.source,
          alignment_score: state.latentResult.alignmentScore,
          readiness_label: state.latentResult.readinessLabel,
          primary_bottleneck: state.latentResult.latentBottleneckKey,
          latent_scores: state.latentResult.latentScores as any,
          form_data: state.formData as any,
        } as any);

        // Notify platform admin
        const ADMIN_USER_ID = 'ff0792cb-1296-40c2-94a4-e6b3e5af970f';
        await supabase.from('notifications').insert({
          user_id: ADMIN_USER_ID,
          type: 'diagnostic_lead',
          title: 'New Offer Diagnostic Lead',
          message: `${state.firstName || 'Someone'} (${state.email}) completed the Offer Diagnostic. Score: ${state.latentResult.alignmentScore}/100 (${state.latentResult.readinessLabel}).`,
          data: {
            email: state.email,
            first_name: state.firstName,
            alignment_score: state.latentResult.alignmentScore,
            readiness_label: state.latentResult.readinessLabel,
            primary_bottleneck: state.latentResult.latentBottleneckKey,
          },
        });
      } catch (error) {
        console.error('Failed to store lead data:', error);
      }
    };

    storeLeadData();
  }, [state]);

  if (!state) {
    return null;
  }

  const { latentResult, firstName } = state;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Link to="/offer-diagnostic" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Diagnostic
          </Link>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Greeting */}
        {firstName && (
          <p className="text-lg text-muted-foreground">
            {firstName}, here's your offer diagnostic breakdown:
          </p>
        )}

        {/* Score Display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Score Circle */}
              <div className="flex flex-col items-center gap-3">
                <div className={`flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 ${getReadinessLabelBg(latentResult.readinessLabel)}`}>
                  <span className={`text-4xl font-bold ${getReadinessLabelColor(latentResult.readinessLabel)}`}>
                    {latentResult.alignmentScore}
                  </span>
                  <span className="text-muted-foreground text-sm">/ 100</span>
                </div>
                <Badge variant="outline" className={`${getReadinessLabelBg(latentResult.readinessLabel)} ${getReadinessLabelColor(latentResult.readinessLabel)} border-current`}>
                  {latentResult.readinessLabel}
                </Badge>
              </div>

              {/* Interpretation */}
              <div className="flex-1 space-y-4 text-center md:text-left">
                <div>
                  <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 justify-center md:justify-start">
                    <Gauge className="h-5 w-5 text-primary" />
                    Alignment Score
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    {getScoreInterpretation(latentResult.alignmentScore)}
                  </p>
                </div>

                {/* Outbound Status */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                  latentResult.outboundReady 
                    ? 'bg-green-500/10 text-green-600' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {latentResult.outboundReady ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Outbound Ready</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Outbound Blocked</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Bottleneck */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-destructive" />
              Primary Constraint Limiting Outbound Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-base px-3 py-1">
                  {latentResult.bottleneckLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Score: {latentResult.latentScores[latentResult.latentBottleneckKey]}/20
                </span>
                {latentResult.primaryBottleneck.severity === 'blocking' && (
                  <Badge variant="destructive">Blocking</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {latentResult.primaryBottleneck.explanation}
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* VSL Section */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              How to Turn a Good Offer into a Scalable Outbound System
            </CardTitle>
            <CardDescription>
              This explains why offer quality determines whether outbound scales — before scripts, tools, or reps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-dashed">
              <div className="text-center space-y-2">
                <Play className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Video coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isUnlocked ? (
                <Unlock className="h-5 w-5 text-primary" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              What to Fix to Improve Outbound Performance
            </CardTitle>
            {!isUnlocked && (
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                We're generating a detailed outbound-specific breakdown for your offer.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!isUnlocked ? (
              <div className="relative">
                {/* Blurred preview */}
                <div className="filter blur-md pointer-events-none select-none opacity-50">
                  <div className="space-y-4">
                    <div className="h-24 bg-muted rounded-lg" />
                    <div className="h-24 bg-muted rounded-lg" />
                  </div>
                </div>

                {/* Countdown overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4 bg-background/80 backdrop-blur-sm rounded-lg p-8">
                    <div className="text-4xl font-bold text-primary">
                      {formatTime(timeRemaining)}
                    </div>
                    <p className="text-muted-foreground">
                      Generating your personalized recommendations...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Watch the video above while you wait!
                    </p>
                  </div>
                </div>
              </div>
            ) : isLoadingRecs ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-muted-foreground">Loading recommendations...</p>
                </div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex items-center gap-3 text-primary p-4 bg-primary/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Well Optimized</div>
                  <div className="text-sm text-muted-foreground">No major issues detected. Your offer looks solid!</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <Card key={rec.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                          {index + 1}
                        </span>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{rec.headline}</h4>
                          <Badge variant="outline" className={getCategoryColor(rec.category)}>
                            {CATEGORY_LABELS[rec.category]}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {rec.plainExplanation}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-medium">What to do:</div>
                        <ul className="space-y-1.5">
                          {rec.actionSteps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex items-start gap-2 text-sm">
                              <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <Target className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-green-600 mb-0.5">Goal</div>
                          <span className="text-sm text-green-700">{rec.desiredState}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Soft CTA */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-lg">
              Want this executed instead of DIY?
            </p>
            <p className="text-muted-foreground">
              Closer Claus exists for that.
            </p>
            <Button asChild variant="outline">
              <Link to="/">Learn More</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
