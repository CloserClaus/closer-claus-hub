import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, TrendingUp, Target, Lightbulb } from 'lucide-react';
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
  FulfillmentComplexity,
  ScoringResult,
  Prescription,
  Grade,
} from '@/lib/offerDiagnostic/types';
import { calculateScore } from '@/lib/offerDiagnostic/scoringEngine';
import { generatePrescription, getDimensionLabel, getDimensionMaxScore } from '@/lib/offerDiagnostic/prescriptionEngine';
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
  fulfillmentComplexity: null,
};

function getGradeColor(grade: Grade) {
  switch (grade) {
    case 'Excellent': return 'text-green-500';
    case 'Strong': return 'text-blue-500';
    case 'Average': return 'text-yellow-500';
    case 'Weak': return 'text-red-500';
  }
}

function getGradeBg(grade: Grade) {
  switch (grade) {
    case 'Excellent': return 'bg-green-500/10 border-green-500/30';
    case 'Strong': return 'bg-blue-500/10 border-blue-500/30';
    case 'Average': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'Weak': return 'bg-red-500/10 border-red-500/30';
  }
}

function ScoreDisplay({ score100, score10, grade }: { score100: number; score10: number; grade: Grade }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm font-medium text-muted-foreground">Your Offer Diagnostic Score</div>
      <div className={`flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 ${getGradeBg(grade)}`}>
        <span className={`text-4xl font-bold ${getGradeColor(grade)}`}>{score100}</span>
        <span className="text-muted-foreground text-sm">/ 100</span>
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm text-muted-foreground">({score10} out of 10)</div>
        <Badge variant="outline" className={`${getGradeBg(grade)} ${getGradeColor(grade)} border-current`}>
          {grade}
        </Badge>
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

function PrescriptionDisplay({ prescription }: { prescription: Prescription }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Top Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-sm">Weakest Dimension:</span>
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              {getDimensionLabel(prescription.weakestDimension)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {prescription.businessImpact}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Action Items:</span>
          </div>
          <ul className="space-y-1 pl-6">
            {prescription.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <TrendingUp className="h-4 w-4" />
          {prescription.callToAction}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OfferDiagnostic() {
  const [formData, setFormData] = useState<DiagnosticFormData>(initialFormData);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);

  const isFormComplete = useMemo(() => {
    const { offerType, icpIndustry, icpSize, icpMaturity, pricingStructure, fulfillmentComplexity } = formData;
    
    // Base required fields
    if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !fulfillmentComplexity) {
      return false;
    }

    // Conditional field validation
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
      
      // Clear conditional fields when pricing structure changes
      if (field === 'pricingStructure') {
        newData.recurringPriceTier = null;
        newData.oneTimePriceTier = null;
        newData.usageOutputType = null;
        newData.usageVolumeTier = null;
      }
      
      return newData;
    });
    // Reset scoring when form changes
    setScoringResult(null);
  };

  const handleSubmit = () => {
    const result = calculateScore(formData);
    if (result) {
      setScoringResult(result);
    }
  };

  const prescription = useMemo(() => {
    if (!scoringResult) return null;
    return generatePrescription(scoringResult.visibleScore100, scoringResult.dimensionScores, formData);
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
                
                {/* Conditional: Recurring Price Tier */}
                {formData.pricingStructure === 'recurring' && (
                  renderSelect<RecurringPriceTier>('Recurring Price Tier', 'recurringPriceTier', RECURRING_PRICE_TIER_OPTIONS, formData.recurringPriceTier)
                )}
                
                {/* Conditional: One-Time Price Tier */}
                {formData.pricingStructure === 'one_time' && (
                  renderSelect<OneTimePriceTier>('One-Time Price Tier', 'oneTimePriceTier', ONE_TIME_PRICE_TIER_OPTIONS, formData.oneTimePriceTier)
                )}
              </div>
              
              {/* Conditional: Usage-Based fields */}
              {formData.pricingStructure === 'usage_based' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {renderSelect<UsageOutputType>('Usage Output Type', 'usageOutputType', USAGE_OUTPUT_TYPE_OPTIONS, formData.usageOutputType)}
                  {renderSelect<UsageVolumeTier>('Usage Volume Tier', 'usageVolumeTier', USAGE_VOLUME_TIER_OPTIONS, formData.usageVolumeTier)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Fulfillment */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Fulfillment</CardTitle>
              <CardDescription>How you deliver your service</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSelect<FulfillmentComplexity>('Fulfillment Complexity', 'fulfillmentComplexity', FULFILLMENT_COMPLEXITY_OPTIONS, formData.fulfillmentComplexity)}
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
          {scoringResult && (
            <Card>
              <CardHeader>
                <CardTitle>Diagnostic Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
                  <ScoreDisplay 
                    score100={scoringResult.visibleScore100} 
                    score10={scoringResult.visibleScore10}
                    grade={scoringResult.grade}
                  />
                  <div className="flex-1 w-full">
                    <DimensionScoresTable scores={scoringResult.dimensionScores} />
                  </div>
                </div>

                {prescription && (
                  <PrescriptionDisplay prescription={prescription} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
