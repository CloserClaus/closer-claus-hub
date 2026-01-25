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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  Zap,
  ArrowRight,
  Gauge,
  Settings2,
  ChevronDown,
  Lightbulb,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  DiagnosticFormData,
  OfferType,
  ICPIndustry,
  ICPSize,
  ICPMaturity,
  PricingStructure,
  RecurringPriceTier,
  OneTimePriceTier,
  UsageOutputType,
  UsageVolumeTier,
  RiskModel,
  FulfillmentComplexity,
  ScoringResult,
  DetectedProblem,
  FixArchetype,
  ContextModifiers,
  ContextAwareFix,
} from '@/lib/offerDiagnostic/types';
import { calculateScore } from '@/lib/offerDiagnostic/scoringEngine';
import { PROBLEM_CATEGORY_LABELS } from '@/lib/offerDiagnostic/fixStackEngine';
import { generateContextAwareFixStack, MODIFIER_LABELS } from '@/lib/offerDiagnostic/contextAwareFixEngine';
import {
  OFFER_TYPE_OPTIONS,
  ICP_INDUSTRY_OPTIONS,
  ICP_SIZE_OPTIONS,
  ICP_MATURITY_OPTIONS,
  PRICING_STRUCTURE_OPTIONS,
  RECURRING_PRICE_TIER_OPTIONS,
  ONE_TIME_PRICE_TIER_OPTIONS,
  USAGE_OUTPUT_TYPE_OPTIONS,
  USAGE_VOLUME_TIER_OPTIONS,
  RISK_MODEL_OPTIONS,
  FULFILLMENT_COMPLEXITY_OPTIONS,
} from '@/lib/offerDiagnostic/dropdownOptions';

const initialFormData: DiagnosticFormData = {
  offerType: null,
  icpIndustry: null,
  icpSize: null,
  icpMaturity: null,
  pricingStructure: null,
  recurringPriceTier: null,
  oneTimePriceTier: null,
  usageOutputType: null,
  usageVolumeTier: null,
  riskModel: null,
  fulfillmentComplexity: null,
};


function getImpactColor(impact: FixArchetype['impact']) {
  switch (impact) {
    case 'Very High': return 'bg-green-500/20 text-green-600 border-green-500/30';
    case 'High': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
    case 'Low': return 'bg-muted text-muted-foreground border-muted';
  }
}

function getEffortColor(effort: FixArchetype['effort']) {
  switch (effort) {
    case 'Low': return 'bg-green-500/20 text-green-600 border-green-500/30';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
    case 'High': return 'bg-red-500/20 text-red-600 border-red-500/30';
  }
}

function getReadinessLabelColor(label: string) {
  switch (label) {
    case 'High Potential': return 'text-green-500';
    case 'Strong': return 'text-blue-500';
    case 'Moderate': return 'text-yellow-500';
    case 'Weak': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

function getReadinessLabelBg(label: string) {
  switch (label) {
    case 'High Potential': return 'bg-green-500/10 border-green-500/30';
    case 'Strong': return 'bg-blue-500/10 border-blue-500/30';
    case 'Moderate': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'Weak': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-muted border-muted';
  }
}

function ScoreDisplay({ alignmentScore, readinessScore, readinessLabel }: { 
  alignmentScore: number; 
  readinessScore: number; 
  readinessLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm font-medium text-muted-foreground">Alignment Score</div>
      <div className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 ${getReadinessLabelBg(readinessLabel)}`}>
        <span className={`text-3xl font-bold ${getReadinessLabelColor(readinessLabel)}`}>{alignmentScore}</span>
        <span className="text-muted-foreground text-xs">/ 100</span>
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-medium">Readiness Score: <span className={getReadinessLabelColor(readinessLabel)}>{readinessScore}</span>/10</div>
        <Badge variant="outline" className={`${getReadinessLabelBg(readinessLabel)} ${getReadinessLabelColor(readinessLabel)} border-current`}>
          {readinessLabel}
        </Badge>
      </div>
    </div>
  );
}

function AlignmentScoreCard({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-green-500';
    if (s >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Gauge className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">Alignment Score</div>
        <div className={`text-lg font-bold ${getScoreColor(score)}`}>{score}/100</div>
      </div>
    </div>
  );
}

function DimensionScoresTable({ scores }: { scores: ScoringResult['dimensionScores'] }) {
  const dimensions = [
    { key: 'painUrgency' as const, label: 'Pain Urgency', maxScore: 25 },
    { key: 'buyingPower' as const, label: 'Buying Power', maxScore: 20 },
    { key: 'pricingFit' as const, label: 'Pricing Fit', maxScore: 20 },
    { key: 'executionFeasibility' as const, label: 'Execution Feasibility', maxScore: 20 },
    { key: 'riskAlignment' as const, label: 'Risk Alignment', maxScore: 15 },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dimension</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dimensions.map(({ key, label, maxScore }) => {
          const score = scores[key];
          const percentage = (score / maxScore) * 100;
          return (
            <TableRow key={key}>
              <TableCell className="font-medium">{label}</TableCell>
              <TableCell className="text-right">
                <span className={percentage < 50 ? 'text-red-500 font-semibold' : ''}>
                  {score}/{maxScore}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FixArchetypeCard({ fix, index }: { fix: FixArchetype; index: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {index + 1}
          </span>
          <span className="font-semibold">{fix.whatToChange}</span>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={getEffortColor(fix.effort)}>
            {fix.effort} Effort
          </Badge>
          <Badge variant="outline" className={getImpactColor(fix.impact)}>
            {fix.impact} Impact
          </Badge>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span>{fix.howToChangeIt}</span>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <Zap className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>When:</strong> {fix.whenToChooseThis}</span>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <Target className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Target:</strong> {fix.targetCondition}</span>
        </div>
      </div>
    </div>
  );
}

function ProblemCard({ problem, index }: { problem: DetectedProblem; index: number }) {
  return (
    <AccordionItem value={`problem-${index}`} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <div className="font-semibold">{PROBLEM_CATEGORY_LABELS[problem.category]}</div>
            <div className="text-sm text-muted-foreground">{problem.problem}</div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-4 space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <span>{problem.whyItMatters}</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Recommended Fixes</span>
          </div>
          <div className="space-y-3">
            {problem.fixes.map((fix, fixIndex) => (
              <FixArchetypeCard key={fixIndex} fix={fix} index={fixIndex} />
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// Context Modifiers Display
function ContextModifiersPanel({ modifiers }: { modifiers: ContextModifiers }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const modifierEntries = Object.entries(modifiers) as [keyof ContextModifiers, string][];
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-muted">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Context Modifiers</CardTitle>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-2 sm:grid-cols-5">
              {modifierEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xs text-muted-foreground">{MODIFIER_LABELS[key]}</div>
                  <div className="font-medium text-sm">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Context-Aware Fix Card
function ContextAwareFixCard({ fix, index }: { fix: ContextAwareFix; index: number }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {index + 1}
            </span>
            <span className="font-semibold">{fix.whatToChange}</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={getEffortColor(fix.effort)}>
              {fix.effort} Effort
            </Badge>
            <Badge variant="outline" className={getImpactColor(fix.impact)}>
              {fix.impact} Impact
            </Badge>
          </div>
        </div>
        
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 text-sm">
          <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span>{fix.instruction}</span>
        </div>
        
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Target:</strong> {fix.targetCondition}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Top Fixes Display
function TopFixesDisplay({ fixes }: { fixes: ContextAwareFix[] }) {
  if (fixes.length === 0) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <div className="font-semibold">Well Optimized</div>
              <div className="text-sm text-muted-foreground">No major improvements needed at this time.</div>
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
          Top {fixes.length} Recommended Fixes
        </CardTitle>
        <CardDescription>
          Context-aware recommendations based on your specific configuration. Prioritized by strategic impact.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fixes.map((fix, index) => (
          <ContextAwareFixCard key={fix.id} fix={fix} index={index} />
        ))}
      </CardContent>
    </Card>
  );
}

// Detected Problems Display (simplified, no fix archetypes here)
function DetectedProblemsDisplay({ problems }: { problems: DetectedProblem[] }) {
  if (problems.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Detected Issues ({problems.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {problems.map((problem, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm">{PROBLEM_CATEGORY_LABELS[problem.category]}</div>
                <div className="text-sm text-muted-foreground">{problem.whyItMatters}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OfferDiagnostic() {
  const [formData, setFormData] = useState<DiagnosticFormData>(initialFormData);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);

  const isFormComplete = useMemo(() => {
    const { offerType, icpIndustry, icpSize, icpMaturity, pricingStructure, riskModel, fulfillmentComplexity } = formData;
    
    // Base required fields including riskModel
    if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !riskModel || !fulfillmentComplexity) {
      return false;
    }

    if (pricingStructure === 'recurring' && !formData.recurringPriceTier) {
      return false;
    }
    if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) {
      return false;
    }
    if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) {
      return false;
    }

    return true;
  }, [formData]);

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
      }
      
      return newData;
    });
    setScoringResult(null);
  };

  const handleSubmit = () => {
    const result = calculateScore(formData);
    if (result) {
      setScoringResult(result);
    }
  };

  const contextAwareFixStack = useMemo(() => {
    if (!scoringResult) return null;
    return generateContextAwareFixStack(formData, scoringResult.extendedScores, scoringResult.visibleScore100);
  }, [scoringResult, formData]);

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
              <CardDescription>Define your core service offering</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSelect<OfferType>('Offer Type', 'offerType', OFFER_TYPE_OPTIONS, formData.offerType)}
            </CardContent>
          </Card>

          {/* Section: ICP */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">ICP (Ideal Customer Profile)</CardTitle>
              <CardDescription>Define your target customer characteristics</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {renderSelect<ICPIndustry>('Industry', 'icpIndustry', ICP_INDUSTRY_OPTIONS, formData.icpIndustry)}
              {renderSelect<ICPSize>('Company Size', 'icpSize', ICP_SIZE_OPTIONS, formData.icpSize)}
              {renderSelect<ICPMaturity>('Business Maturity', 'icpMaturity', ICP_MATURITY_OPTIONS, formData.icpMaturity)}
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
            disabled={!isFormComplete}
            className="w-full"
          >
            Evaluate Offer
          </Button>

          {/* Results Section */}
          {scoringResult && contextAwareFixStack && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Diagnostic Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
                    <ScoreDisplay 
                      alignmentScore={contextAwareFixStack.alignmentScore}
                      readinessScore={contextAwareFixStack.readinessScore}
                      readinessLabel={contextAwareFixStack.readinessLabel}
                    />
                    
                    <div className="flex-1 w-full space-y-4">
                      <AlignmentScoreCard score={contextAwareFixStack.alignmentScore} />
                      
                      <Separator />
                      
                      <DimensionScoresTable scores={scoringResult.dimensionScores} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ContextModifiersPanel modifiers={contextAwareFixStack.contextModifiers} />
              <DetectedProblemsDisplay problems={contextAwareFixStack.problems} />
              <TopFixesDisplay fixes={contextAwareFixStack.topFixes} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
