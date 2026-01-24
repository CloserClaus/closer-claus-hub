// Dropdown option types for Offer Diagnostic

export type OfferType = 
  | 'demand_creation'
  | 'demand_capture'
  | 'outbound_sales_enablement'
  | 'retention_monetization'
  | 'operational_enablement';

export type ICPIndustry = 
  | 'local_services'
  | 'professional_services'
  | 'b2b_service_agency'
  | 'dtc_ecommerce'
  | 'saas_tech';

export type ICPSize = 
  | 'solo_founder'
  | '1_5_employees'
  | '6_20_employees'
  | '21_100_employees'
  | '100_plus_employees';

export type ICPMaturity = 
  | 'pre_revenue'
  | 'early_traction'
  | 'scaling'
  | 'mature'
  | 'enterprise';

export type PricingStructure = 
  | 'recurring'
  | 'one_time'
  | 'performance_only'
  | 'usage_based';

export type RecurringPriceTier = 
  | 'under_150'
  | '150_500'
  | '500_2k'
  | '2k_5k'
  | '5k_plus';

export type OneTimePriceTier = 
  | 'under_3k'
  | '3k_10k'
  | '10k_plus';

export type UsageOutputType = 
  | 'lead_based'
  | 'conversion_based'
  | 'task_based';

export type UsageVolumeTier = 
  | 'low'
  | 'mid'
  | 'high';

export type FulfillmentComplexity = 
  | 'hands_on_labor'
  | 'hands_off_strategy'
  | 'hybrid_labor_systems'
  | 'software'
  | 'automation';

export interface DiagnosticFormData {
  offerType: OfferType | null;
  icpIndustry: ICPIndustry | null;
  icpSize: ICPSize | null;
  icpMaturity: ICPMaturity | null;
  pricingStructure: PricingStructure | null;
  recurringPriceTier: RecurringPriceTier | null;
  oneTimePriceTier: OneTimePriceTier | null;
  usageOutputType: UsageOutputType | null;
  usageVolumeTier: UsageVolumeTier | null;
  fulfillmentComplexity: FulfillmentComplexity | null;
}

export interface DimensionScores {
  painUrgency: number;
  buyingPower: number;
  pricingFit: number;
  executionFeasibility: number;
  riskAlignment: number;
}

export type Grade = 'Weak' | 'Average' | 'Strong' | 'Excellent';

export interface ScoringResult {
  hiddenScore: number;
  visibleScore100: number;
  visibleScore10: number;
  grade: Grade;
  dimensionScores: DimensionScores;
}

export type DimensionName = keyof DimensionScores;

export interface Prescription {
  score: number;
  weakestDimension: DimensionName;
  businessImpact: string;
  recommendations: string[];
  callToAction: string;
}
