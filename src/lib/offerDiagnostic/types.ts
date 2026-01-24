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
  | 'dtc_ecommerce'
  | 'saas_tech'
  | 'other_b2b';

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

export type PricingModel = 
  | 'retainer'
  | 'hybrid'
  | 'performance_only'
  | 'one_time_project'
  | 'usage_based';

export type PriceTier = 
  | 'under_1k'
  | '1k_3k'
  | '3k_10k'
  | '10k_plus'
  | 'performance_only';

export type RiskStructure = 
  | 'no_guarantee'
  | 'conditional_guarantee'
  | 'full_guarantee'
  | 'pay_on_performance'
  | 'pay_after_results';

export type FulfillmentComplexity = 
  | 'hands_on_labor'
  | 'hands_off_strategy'
  | 'hybrid_labor_systems'
  | 'software_automation'
  | 'staffing_placement';

export interface DiagnosticFormData {
  offerType: OfferType | null;
  icpIndustry: ICPIndustry | null;
  icpSize: ICPSize | null;
  icpMaturity: ICPMaturity | null;
  pricingModel: PricingModel | null;
  priceTier: PriceTier | null;
  riskStructure: RiskStructure | null;
  fulfillmentComplexity: FulfillmentComplexity | null;
}

export interface DimensionScores {
  painUrgency: number;
  buyingPower: number;
  executionFeasibility: number;
  pricingSanity: number;
  riskAlignment: number;
}

export interface ScoringResult {
  hiddenScore: number;
  visibleScore: number;
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
