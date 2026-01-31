import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowDown, Loader2, Info, Zap } from 'lucide-react';
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
  PromiseBucket,
  PromiseOutcome,
  VerticalSegment,
  ScoringSegment,
} from '@/lib/offerDiagnostic/types';
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
import { getLatentScoresSync } from '@/lib/offerDiagnostic/evaluateOfferV2';
import { SoftGateModal } from '@/components/offer-diagnostic/SoftGateModal';

const initialFormData: DiagnosticFormData = {
  offerType: null,
  promiseOutcome: null,
  promise: null,
  icpIndustry: null,
  verticalSegment: null,
  scoringSegment: null,
  icpSize: null,
  icpMaturity: null,
  icpSpecificity: null,
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

export default function PublicOfferDiagnostic() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<DiagnosticFormData>(initialFormData);
  const [showSoftGate, setShowSoftGate] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isFormComplete = useMemo(() => {
    const { offerType, promiseOutcome, promise, icpIndustry, verticalSegment, scoringSegment, icpSize, icpMaturity, icpSpecificity, pricingStructure, riskModel, fulfillmentComplexity, proofLevel } = formData;
    
    if (!offerType || !promiseOutcome || !promise || !icpIndustry || !verticalSegment || !scoringSegment || !icpSize || !icpMaturity || !icpSpecificity || !pricingStructure || !riskModel || !fulfillmentComplexity || proofLevel === null || proofLevel === undefined) {
      return false;
    }

    if (pricingStructure === 'recurring' && !formData.recurringPriceTier) return false;
    if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) return false;
    if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) return false;
    if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) return false;
    if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) return false;

    return true;
  }, [formData]);

  const availableOutcomeGroups = useMemo(() => {
    if (!formData.offerType) return [];
    return OUTCOMES_BY_OFFER_TYPE[formData.offerType] || [];
  }, [formData.offerType]);

  const availableVerticalSegments = useMemo(() => {
    if (!formData.icpIndustry) return [];
    return VERTICAL_SEGMENTS_BY_INDUSTRY[formData.icpIndustry] || [];
  }, [formData.icpIndustry]);

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
  };

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
  };

  const handleSubmit = () => {
    if (!isFormComplete) return;
    setShowSoftGate(true);
  };

  const handleSoftGateComplete = (firstName: string, email: string) => {
    // Get the latent scores synchronously for navigation
    const latentResult = getLatentScoresSync(formData);
    
    if (!latentResult) {
      console.error('Failed to compute scores');
      return;
    }

    // Navigate to results with state
    navigate('/offer-diagnostic/results', {
      state: {
        formData,
        latentResult,
        firstName,
        email,
        source: 'offer_diagnostic_lead_magnet',
      },
    });
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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="relative container max-w-4xl mx-auto px-4 py-20 md:py-32">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Is your offer actually{' '}
              <span className="text-primary">outbound-ready?</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Most founders fail at outbound not because of scripts or reps, but because their offer collapses under cold attention.
            </p>
            <Button 
              size="lg" 
              onClick={scrollToForm}
              className="gap-2 text-lg px-8 py-6"
            >
              <Zap className="h-5 w-5" />
              Evaluate My Offer
              <ArrowDown className="h-5 w-5 animate-bounce" />
            </Button>
          </div>
        </div>
      </section>

      {/* Diagnostic Form */}
      <section ref={formRef} className="py-16 bg-muted/30">
        <div className="container max-w-3xl mx-auto px-4 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Offer Diagnostic</h2>
            <p className="text-muted-foreground">
              Configure your offer details to receive a personalized outbound readiness assessment
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
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Evaluate My Offer
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Soft Gate Modal */}
      <SoftGateModal
        open={showSoftGate}
        onOpenChange={setShowSoftGate}
        onComplete={handleSoftGateComplete}
      />
    </div>
  );
}
