import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  ArrowRight,
  Gauge,
  Lightbulb,
  Info,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import type {
  DiagnosticFormData,
  OfferType,
  ICPIndustry,
  ICPSize,
  ICPMaturity,
  ICPSpecificity,
  PricingStructure,
  RecurringPriceTier,
  OneTimePriceTier,
  UsageOutputType,
  UsageVolumeTier,
  HybridRetainerTier,
  PerformanceBasis,
  PerformanceCompTier,
  RiskModel,
  FulfillmentComplexity,
  StructuredRecommendation,
  FixCategory,
} from '@/lib/offerDiagnostic/types';
import type { VerticalSegment, ScoringSegment, PromiseBucket, PromiseOutcome } from '@/lib/offerDiagnostic/types';
import {
  OFFER_TYPE_OPTIONS,
  OUTCOMES_BY_OFFER_TYPE,
  getPromiseBucketFromOutcome,
  ICP_INDUSTRY_OPTIONS,
  ICP_SIZE_OPTIONS,
  ICP_MATURITY_OPTIONS,
  ICP_SPECIFICITY_OPTIONS,
  PRICING_STRUCTURE_OPTIONS,
  RECURRING_PRICE_TIER_OPTIONS,
  ONE_TIME_PRICE_TIER_OPTIONS,
  USAGE_OUTPUT_TYPE_OPTIONS,
  USAGE_VOLUME_TIER_OPTIONS,
  HYBRID_RETAINER_TIER_OPTIONS,
  PERFORMANCE_BASIS_OPTIONS,
  PERFORMANCE_COMP_TIER_OPTIONS,
  RISK_MODEL_OPTIONS,
  FULFILLMENT_COMPLEXITY_OPTIONS,
  VERTICAL_SEGMENTS_BY_INDUSTRY,
  getScoringSegmentFromVertical,
  PROOF_LEVEL_OPTIONS,
} from '@/lib/offerDiagnostic/dropdownOptions';
import { CATEGORY_LABELS } from '@/lib/offerDiagnostic/types';
import { useOfferDiagnosticState } from '@/hooks/useOfferDiagnosticState';

// ============= SINGLE EXECUTION AUTHORITY =============
// evaluateOfferV2 is the ONLY source of truth for scoring and recommendations
import { 
  evaluateOfferV2, 
  assertEvaluateOfferV2Source,
  type EvaluateOfferV2Result 
} from '@/lib/offerDiagnostic/evaluateOfferV2';
import { LATENT_SCORE_LABELS, type LatentBottleneckKey } from '@/lib/offerDiagnostic/latentScoringEngine';

const initialFormData: DiagnosticFormData = {
  offerType: null,
  promiseOutcome: null,
  promise: null,
  icpIndustry: null,
  verticalSegment: null,
  scoringSegment: null,
  icpSize: null,
  icpMaturity: null,
  icpSpecificity: null, // NEW REQUIRED FIELD
  pricingStructure: null,
  recurringPriceTier: null,
  oneTimePriceTier: null,
  usageOutputType: null,
  usageVolumeTier: null,
  hybridRetainerTier: null,
  performanceBasis: null,
  performanceCompTier: null,
  riskModel: null,
  fulfillmentComplexity: null,
  proofLevel: null,
};

// ============= HELPER FUNCTIONS =============

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

// ============= SCORE DISPLAY (V2) =============

function ScoreDisplayV2({ result }: { result: EvaluateOfferV2Result }) {
  const readinessScore = Math.round(result.alignmentScore / 10);
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm font-medium text-muted-foreground">Alignment Score</div>
      <div className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 ${getReadinessLabelBg(result.readinessLabel)}`}>
        <span className={`text-3xl font-bold ${getReadinessLabelColor(result.readinessLabel)}`}>{result.alignmentScore}</span>
        <span className="text-muted-foreground text-xs">/ 100</span>
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-medium">Readiness Score: <span className={getReadinessLabelColor(result.readinessLabel)}>{readinessScore}</span>/10</div>
        <Badge variant="outline" className={`${getReadinessLabelBg(result.readinessLabel)} ${getReadinessLabelColor(result.readinessLabel)} border-current`}>
          {result.readinessLabel}
        </Badge>
      </div>
    </div>
  );
}

// ============= LATENT SCORES TABLE (V2) =============

function LatentScoresTable({ result }: { result: EvaluateOfferV2Result }) {
  // NEW: 5 latent variables
  const latentDimensions: { key: LatentBottleneckKey; label: string }[] = [
    { key: 'EFI', label: 'Economic Feasibility (EFI)' },
    { key: 'proofPromise', label: 'Proof-to-Promise Credibility' },
    { key: 'fulfillmentScalability', label: 'Fulfillment Scalability' },
    { key: 'riskAlignment', label: 'Risk Alignment' },
    { key: 'channelFit', label: 'Channel Fit' },
  ];

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Latent Dimension</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {latentDimensions.map(({ key, label }) => {
            const score = result.latentScores[key];
            const percentage = (score / 20) * 100;
            const isBottleneck = key === result.latentBottleneckKey;
            return (
              <TableRow key={key} className={isBottleneck ? 'bg-destructive/5' : ''}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell className="text-right">
                  <span className={percentage < 50 ? 'text-red-500 font-semibold' : ''}>
                    {score}/20
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {/* Primary Bottleneck Line */}
      <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50 border border-muted">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-muted-foreground">
          Primary Bottleneck: <span className="font-medium text-foreground">{result.bottleneckLabel}</span> ({result.latentScores[result.latentBottleneckKey]}/20)
        </span>
      </div>
    </div>
  );
}

// ============= RECOMMENDATION CARD (V2) =============

function RecommendationCardV2({ 
  recommendation, 
  index 
}: { 
  recommendation: StructuredRecommendation; 
  index: number;
}) {
  const [copied, setCopied] = useState(false);
  
  const formatForClipboard = () => {
    const lines = [
      `${recommendation.headline}`,
      '',
      recommendation.plainExplanation,
      '',
      'Action Steps:',
      ...recommendation.actionSteps.map(step => `• ${step}`),
      '',
      `Goal: ${recommendation.desiredState}`,
    ];
    return lines.join('\n');
  };
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatForClipboard());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0 mt-0.5">
              {index + 1}
            </span>
            <div className="space-y-2">
              <h4 className="font-semibold text-base leading-tight">{recommendation.headline}</h4>
              <Badge variant="outline" className={getCategoryColor(recommendation.category)}>
                {CATEGORY_LABELS[recommendation.category]}
              </Badge>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        
        {/* Plain explanation */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {recommendation.plainExplanation}
        </p>
        
        {/* Action steps */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">What to do:</div>
          <ul className="space-y-1.5">
            {recommendation.actionSteps.map((step, stepIndex) => (
              <li key={stepIndex} className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Desired state */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <Target className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-medium text-green-600 mb-0.5">Goal</div>
            <span className="text-sm text-green-700">{recommendation.desiredState}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============= RECOMMENDATIONS DISPLAY (V2) =============

function RecommendationsDisplayV2({ result }: { result: EvaluateOfferV2Result }) {
  if (result.recommendations.length === 0) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <div className="font-semibold">Well Optimized</div>
              <div className="text-sm text-muted-foreground">No major issues detected. Your offer looks solid!</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Top Recommendations
        </CardTitle>
        <CardDescription>
          {result.recommendations.length} actionable fixes based on your primary bottleneck: <span className="font-medium">{result.bottleneckLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Not outbound ready warning */}
        {result.notOutboundReady && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-destructive">Not Outbound Ready</div>
              <div className="text-sm text-muted-foreground">
                This offer has significant alignment issues. Focus on the recommendations below before investing in cold outreach.
              </div>
            </div>
          </div>
        )}
        
        {result.recommendations.map((rec, index) => (
          <RecommendationCardV2 
            key={rec.id} 
            recommendation={rec} 
            index={index} 
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ============= MAIN PAGE COMPONENT =============

export default function OfferDiagnostic() {
  const [formData, setFormData] = useState<DiagnosticFormData>(initialFormData);
  
  // V2 RESULT — SINGLE SOURCE OF TRUTH
  const [evaluationResult, setEvaluationResult] = useState<EvaluateOfferV2Result | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Hook for persisting offer diagnostic state
  const { saveState: saveOfferState, saveLatentScores } = useOfferDiagnosticState();

  const isFormComplete = useMemo(() => {
    const { offerType, promiseOutcome, promise, icpIndustry, verticalSegment, scoringSegment, icpSize, icpMaturity, icpSpecificity, pricingStructure, riskModel, fulfillmentComplexity, proofLevel } = formData;
    
    // icpSpecificity is now REQUIRED
    if (!offerType || !promiseOutcome || !promise || !icpIndustry || !verticalSegment || !scoringSegment || !icpSize || !icpMaturity || !icpSpecificity || !pricingStructure || !riskModel || !fulfillmentComplexity || !proofLevel) {
      return false;
    }

    if (pricingStructure === 'recurring' && !formData.recurringPriceTier) return false;
    if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) return false;
    if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) return false;
    if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) return false;
    if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) return false;

    return true;
  }, [formData]);

  // Get available outcome groups based on selected offer type
  const availableOutcomeGroups = useMemo(() => {
    if (!formData.offerType) return [];
    return OUTCOMES_BY_OFFER_TYPE[formData.offerType] || [];
  }, [formData.offerType]);

  // Get available vertical segments based on selected industry
  const availableVerticalSegments = useMemo(() => {
    if (!formData.icpIndustry) return [];
    return VERTICAL_SEGMENTS_BY_INDUSTRY[formData.icpIndustry] || [];
  }, [formData.icpIndustry]);

  // Handle vertical segment selection with auto-mapping to scoring segment
  const handleVerticalSegmentChange = (verticalValue: string) => {
    if (verticalValue === 'none') {
      setFormData(prev => ({
        ...prev,
        verticalSegment: null,
        scoringSegment: null,
      }));
    } else {
      const scoringSegment = getScoringSegmentFromVertical(verticalValue);
      setFormData(prev => ({
        ...prev,
        verticalSegment: verticalValue as VerticalSegment,
        scoringSegment: scoringSegment as ScoringSegment,
      }));
    }
    setEvaluationResult(null);
  };

  // Handle outcome selection with auto-mapping to bucket
  const handleOutcomeChange = (outcomeValue: string) => {
    if (outcomeValue === 'none') {
      setFormData(prev => ({
        ...prev,
        promiseOutcome: null,
        promise: null,
      }));
    } else {
      const bucket = getPromiseBucketFromOutcome(outcomeValue);
      setFormData(prev => ({
        ...prev,
        promiseOutcome: outcomeValue as PromiseOutcome,
        promise: bucket as PromiseBucket,
      }));
    }
    setEvaluationResult(null);
  };

  const handleFieldChange = <K extends keyof DiagnosticFormData>(
    field: K,
    value: DiagnosticFormData[K]
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      if (field === 'pricingStructure') {
        newData.recurringPriceTier = null;
        newData.oneTimePriceTier = null;
        newData.usageOutputType = null;
        newData.usageVolumeTier = null;
        newData.hybridRetainerTier = null;
        newData.performanceBasis = null;
        newData.performanceCompTier = null;
      }
      
      if (field === 'offerType') {
        newData.promiseOutcome = null;
        newData.promise = null;
      }
      
      if (field === 'icpIndustry') {
        newData.verticalSegment = null;
        newData.scoringSegment = null;
      }
      
      return newData;
    });
    setEvaluationResult(null);
  };

  // ============= SINGLE EXECUTION AUTHORITY — SUBMIT HANDLER =============
  const handleSubmit = async () => {
    setIsEvaluating(true);
    setEvaluationResult(null);
    
    try {
      // ONLY evaluateOfferV2 is called. NO OTHER ENGINES.
      const result = await evaluateOfferV2(formData);
      
      if (!result) {
        console.error('[OfferDiagnostic] evaluateOfferV2 returned null');
        setIsEvaluating(false);
        return;
      }
      
      // ========== EXECUTION GUARANTEE ==========
      // Verify this came from evaluateOfferV2, not legacy engines
      assertEvaluateOfferV2Source(result);
      console.log('[OfferDiagnostic] ✓ Execution verified:', result._executionSource);
      
      // Set result — UI will ONLY render from this
      setEvaluationResult(result);
      
      // Save state for lead evaluation context
      saveOfferState({
        offer_type: formData.offerType,
        promise: formData.promise,
        vertical_segment: formData.verticalSegment,
        company_size: formData.icpSize,
        pricing_structure: formData.pricingStructure,
        price_tier: formData.recurringPriceTier || formData.oneTimePriceTier || formData.hybridRetainerTier || null,
        proof_level: formData.proofLevel,
        risk_model: formData.riskModel,
        fulfillment: formData.fulfillmentComplexity,
      });
      
      // Save latent scores for persistence
      saveLatentScores({
        latentScores: result.latentScores,
        alignmentScore: result.alignmentScore,
        readinessLabel: result.readinessLabel,
        latentBottleneckKey: result.latentBottleneckKey,
        aiRecommendations: result.recommendations,
      });
      
    } catch (error) {
      console.error('[OfferDiagnostic] Evaluation failed:', error);
      // EXECUTION HALT — do not render any fallback
    } finally {
      setIsEvaluating(false);
    }
  };

  const renderSelect = <T extends string>(
    label: string,
    field: keyof DiagnosticFormData,
    options: readonly { value: T; label: string }[],
    currentValue: T | null
  ) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Select
        value={currentValue || 'none'}
        onValueChange={(value) => handleFieldChange(field, value === 'none' ? null : (value as T) as DiagnosticFormData[typeof field])}
      >
        <SelectTrigger id={field} className="bg-background">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Offer Diagnostic"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Offer Diagnostic' },
        ]}
      />

      <div className="container max-w-4xl py-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Offer Diagnostic</h1>
          <p className="text-muted-foreground">
            Evaluate your offer, ICP and pricing to assess outbound readiness
          </p>
        </div>

        <div className="grid gap-6">
          {/* Section: Offer */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Offer</CardTitle>
              <CardDescription>Define your core service offering and promise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSelect<OfferType>('Offer Type', 'offerType', OFFER_TYPE_OPTIONS, formData.offerType)}
              
              {/* Promise Outcome Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="promiseOutcome">What outcome does your offer promise?</Label>
                <Select
                  value={formData.promiseOutcome || 'none'}
                  onValueChange={handleOutcomeChange}
                  disabled={!formData.offerType}
                >
                  <SelectTrigger id="promiseOutcome" className="bg-background">
                    <SelectValue placeholder="Select the specific outcome you deliver" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-w-[420px] max-h-[400px]">
                    {availableOutcomeGroups.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {groupIndex > 0 && <Separator className="my-1" />}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.groupLabel}
                        </div>
                        {group.outcomes.map((outcome) => (
                          <SelectItem 
                            key={outcome.value} 
                            value={outcome.value}
                            className="cursor-pointer"
                          >
                            {outcome.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.offerType && (
                  <p className="text-xs text-muted-foreground">Select an Offer Type first</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section: ICP */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">ICP (Ideal Customer Profile)</CardTitle>
              <CardDescription>Define your target customer characteristics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {renderSelect<ICPIndustry>('Industry', 'icpIndustry', ICP_INDUSTRY_OPTIONS, formData.icpIndustry)}
                
                {/* Vertical Segment */}
                <div className="space-y-2">
                  <Label htmlFor="verticalSegment">Vertical Segment</Label>
                  <Select
                    value={formData.verticalSegment || 'none'}
                    onValueChange={handleVerticalSegmentChange}
                    disabled={!formData.icpIndustry}
                  >
                    <SelectTrigger id="verticalSegment" className="bg-background">
                      <SelectValue placeholder="Select your vertical" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {availableVerticalSegments.map((segment) => (
                        <SelectItem key={segment.value} value={segment.value}>
                          {segment.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!formData.icpIndustry && (
                    <p className="text-xs text-muted-foreground">Select an Industry first</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {renderSelect<ICPSize>('Company Size', 'icpSize', ICP_SIZE_OPTIONS, formData.icpSize)}
                {renderSelect<ICPMaturity>('Business Maturity', 'icpMaturity', ICP_MATURITY_OPTIONS, formData.icpMaturity)}
              </div>
              <div className="grid gap-4 sm:grid-cols-1">
                {renderSelect<ICPSpecificity>('ICP Specificity', 'icpSpecificity', ICP_SPECIFICITY_OPTIONS, formData.icpSpecificity)}
              </div>
            </CardContent>
          </Card>

          {/* Section: Pricing */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Pricing</CardTitle>
              <CardDescription>Configure your pricing structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {renderSelect<PricingStructure>('Pricing Structure', 'pricingStructure', PRICING_STRUCTURE_OPTIONS, formData.pricingStructure)}
                {renderSelect('Market Proof', 'proofLevel', PROOF_LEVEL_OPTIONS, formData.proofLevel)}
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {formData.pricingStructure === 'recurring' && (
                  renderSelect<RecurringPriceTier>('Recurring Price Tier', 'recurringPriceTier', RECURRING_PRICE_TIER_OPTIONS, formData.recurringPriceTier)
                )}
                
                {formData.pricingStructure === 'one_time' && (
                  renderSelect<OneTimePriceTier>('One-Time Price Tier', 'oneTimePriceTier', ONE_TIME_PRICE_TIER_OPTIONS, formData.oneTimePriceTier)
                )}
              </div>
                
              {formData.pricingStructure === 'usage_based' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {renderSelect<UsageOutputType>('Usage Output Type', 'usageOutputType', USAGE_OUTPUT_TYPE_OPTIONS, formData.usageOutputType)}
                  {renderSelect<UsageVolumeTier>('Usage Volume Tier', 'usageVolumeTier', USAGE_VOLUME_TIER_OPTIONS, formData.usageVolumeTier)}
                </div>
              )}
              
              {formData.pricingStructure === 'hybrid' && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-1">
                    {renderSelect<HybridRetainerTier>('Retainer Tier', 'hybridRetainerTier', HYBRID_RETAINER_TIER_OPTIONS, formData.hybridRetainerTier)}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderSelect<PerformanceBasis>('Performance Basis', 'performanceBasis', PERFORMANCE_BASIS_OPTIONS, formData.performanceBasis)}
                    {renderSelect<PerformanceCompTier>('Compensation Tier', 'performanceCompTier', PERFORMANCE_COMP_TIER_OPTIONS, formData.performanceCompTier)}
                  </div>
                </div>
              )}
              
              {formData.pricingStructure === 'performance_only' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {renderSelect<PerformanceBasis>('Performance Basis', 'performanceBasis', PERFORMANCE_BASIS_OPTIONS, formData.performanceBasis)}
                  {renderSelect<PerformanceCompTier>('Compensation Tier', 'performanceCompTier', PERFORMANCE_COMP_TIER_OPTIONS, formData.performanceCompTier)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Risk Model */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Risk Model</CardTitle>
              <CardDescription>Define your guarantee and risk structure</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSelect<RiskModel>('Risk Model', 'riskModel', RISK_MODEL_OPTIONS, formData.riskModel)}
            </CardContent>
          </Card>

          {/* Section: Fulfillment */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Fulfillment</CardTitle>
              <CardDescription>How you deliver your service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="fulfillmentComplexity">Fulfillment Complexity</Label>
                <Select
                  value={formData.fulfillmentComplexity || 'none'}
                  onValueChange={(value) => handleFieldChange('fulfillmentComplexity', value === 'none' ? null : value as FulfillmentComplexity)}
                >
                  <SelectTrigger id="fulfillmentComplexity" className="bg-background">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-w-[400px]">
                    {FULFILLMENT_COMPLEXITY_OPTIONS.map((option) => (
                      <TooltipProvider key={option.value} delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SelectItem value={option.value} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <span>{option.label}</span>
                                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              </div>
                            </SelectItem>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="right" 
                            sideOffset={8}
                            className="max-w-[280px] bg-popover text-popover-foreground border shadow-md z-[9999]"
                          >
                            <p className="text-sm">{option.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!isFormComplete || isEvaluating}
            className="w-full"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              'Evaluate Offer'
            )}
          </Button>

          {/* ============= RESULTS SECTION — V2 ONLY ============= */}
          {evaluationResult && (
            <>
              {/* Execution Verification Banner */}
              <div className="text-xs text-muted-foreground text-center">
                Source: {evaluationResult._executionSource} | Alignment: {evaluationResult.alignmentScore}
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Diagnostic Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
                    <ScoreDisplayV2 result={evaluationResult} />
                    
                    <div className="flex-1 w-full space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Gauge className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Alignment Score</div>
                          <div className={`text-lg font-bold ${getReadinessLabelColor(evaluationResult.readinessLabel)}`}>
                            {evaluationResult.alignmentScore}/100
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <LatentScoresTable result={evaluationResult} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <RecommendationsDisplayV2 result={evaluationResult} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
