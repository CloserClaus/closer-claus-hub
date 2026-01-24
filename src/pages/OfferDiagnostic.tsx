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
  PricingModel,
  PriceTier,
  RiskStructure,
  FulfillmentComplexity,
  ScoringResult,
  Prescription,
} from '@/lib/offerDiagnostic/types';
import { calculateScore } from '@/lib/offerDiagnostic/scoringEngine';
import { generatePrescription, getDimensionLabel } from '@/lib/offerDiagnostic/prescriptionEngine';
import {
  OFFER_TYPE_OPTIONS,
  ICP_INDUSTRY_OPTIONS,
  ICP_SIZE_OPTIONS,
  ICP_MATURITY_OPTIONS,
  PRICING_MODEL_OPTIONS,
  PRICE_TIER_OPTIONS,
  RISK_STRUCTURE_OPTIONS,
  FULFILLMENT_COMPLEXITY_OPTIONS,
} from '@/lib/offerDiagnostic/dropdownOptions';

const initialFormData: DiagnosticFormData = {
  offerType: null,
  icpIndustry: null,
  icpSize: null,
  icpMaturity: null,
  pricingModel: null,
  priceTier: null,
  riskStructure: null,
  fulfillmentComplexity: null,
};

function ScoreDisplay({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/10 border-green-500/20';
    if (score >= 5) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className={`flex items-center justify-center w-24 h-24 rounded-full border-4 ${getScoreBg(score)}`}>
      <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
      <span className="text-muted-foreground text-lg">/10</span>
    </div>
  );
}

function DimensionScoresTable({ scores }: { scores: ScoringResult['dimensionScores'] }) {
  const dimensions = [
    { key: 'painUrgency' as const, label: 'Pain Urgency', maxScore: 25 },
    { key: 'buyingPower' as const, label: 'Buying Power', maxScore: 25 },
    { key: 'executionFeasibility' as const, label: 'Execution Feasibility', maxScore: 20 },
    { key: 'pricingSanity' as const, label: 'Pricing Sanity', maxScore: 20 },
    { key: 'riskAlignment' as const, label: 'Risk Alignment', maxScore: 10 },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dimension</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Max</TableHead>
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
                  {score}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{maxScore}</TableCell>
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
          Recommendations
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
  const [showPrescription, setShowPrescription] = useState(false);

  const isFormComplete = useMemo(() => {
    return Object.values(formData).every((value) => value !== null);
  }, [formData]);

  const handleFieldChange = <K extends keyof DiagnosticFormData>(
    field: K,
    value: DiagnosticFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset scoring when form changes
    setScoringResult(null);
    setShowPrescription(false);
  };

  const handleSubmit = () => {
    const result = calculateScore(formData);
    if (result) {
      setScoringResult(result);
      setShowPrescription(false);
    }
  };

  const prescription = useMemo(() => {
    if (!scoringResult) return null;
    return generatePrescription(scoringResult.visibleScore, scoringResult.dimensionScores, formData);
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
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {renderSelect<PricingModel>('Pricing Model', 'pricingModel', PRICING_MODEL_OPTIONS, formData.pricingModel)}
              {renderSelect<PriceTier>('Price Tier', 'priceTier', PRICE_TIER_OPTIONS, formData.priceTier)}
              {renderSelect<RiskStructure>('Risk Structure', 'riskStructure', RISK_STRUCTURE_OPTIONS, formData.riskStructure)}
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
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Overall Score</span>
                    <ScoreDisplay score={scoringResult.visibleScore} />
                  </div>
                  <div className="flex-1 w-full">
                    <DimensionScoresTable scores={scoringResult.dimensionScores} />
                  </div>
                </div>

                {!showPrescription && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPrescription(true)}
                    className="w-full"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Show Recommendations
                  </Button>
                )}

                {showPrescription && prescription && (
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
