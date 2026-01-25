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

export type RiskModel =
  | 'no_guarantee'
  | 'conditional_guarantee'
  | 'full_guarantee'
  | 'performance_only'
  | 'pay_after_results';

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
  riskModel: RiskModel | null;
  fulfillmentComplexity: FulfillmentComplexity | null;
}

export interface DimensionScores {
  painUrgency: number;
  buyingPower: number;
  pricingFit: number;
  executionFeasibility: number;
  riskAlignment: number;
}

export interface ExtendedScores extends DimensionScores {
  alignmentScore: number; // 0-100 composite
  powerScore: number; // 0-100 composite
  switchingCost: number; // 0-20
  riskModifier: number; // -15 to +10 based on maturity x risk model
}

export type Grade = 'Weak' | 'Average' | 'Strong' | 'Excellent';

export interface ScoringResult {
  hiddenScore: number;
  visibleScore100: number;
  visibleScore10: number;
  grade: Grade;
  dimensionScores: DimensionScores;
  extendedScores: ExtendedScores;
}

export type DimensionName = keyof DimensionScores;

export interface Prescription {
  score: number;
  weakestDimension: DimensionName;
  businessImpact: string;
  recommendations: string[];
  callToAction: string;
}

// ========== Context Modifier Types ==========

export type CashFlowLevel = 'Low' | 'Moderate' | 'High';
export type PainType = 'Revenue' | 'Brand' | 'Retention' | 'Efficiency';
export type MaturityLevel = 'Pre' | 'Early' | 'Scaling' | 'Mature';
export type FulfillmentType = 'Labor' | 'Hybrid' | 'Automation' | 'Staffing';
export type MechanismStrength = 'Weak' | 'Medium' | 'Strong' | 'VeryStrong';

export interface ContextModifiers {
  cashFlow: CashFlowLevel;
  painType: PainType;
  maturity: MaturityLevel;
  fulfillment: FulfillmentType;
  mechanismStrength: MechanismStrength;
}

// ========== Fix Stack Types ==========

export type ProblemCategory =
  | 'icp_mismatch'
  | 'low_buying_power'
  | 'pricing_misfit'
  | 'risk_misalignment'
  | 'low_pain_urgency'
  | 'offer_type_misfit'
  | 'fulfillment_misalignment'
  | 'low_switching_cost'
  | 'low_mechanism_power';

export type EffortLevel = 'Low' | 'Medium' | 'High';
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export interface FixArchetype {
  whatToChange: string;
  howToChangeIt: string;
  whenToChooseThis: string;
  targetCondition: string;
  effort: EffortLevel;
  impact: ImpactLevel;
}

export interface DetectedProblem {
  category: ProblemCategory;
  problem: string;
  whyItMatters: string;
  severity: number;
  fixes: FixArchetype[];
}

export interface FixStackResult {
  finalScore: number;
  alignmentScore: number;
  powerScore: number;
  problems: DetectedProblem[];
}

// ========== Context-Aware Fix Types ==========

export type ContextFixId =
  | 'SwitchToPerformance'
  | 'SwitchToHybrid'
  | 'ReduceRisk'
  | 'Retainer'
  | 'ConditionalGuarantee'
  | 'IncreaseRetainer'
  | 'ShiftUpmarket'
  | 'ShiftVertical'
  | 'ImproveMechanism'
  | 'Downmarket'
  | 'DurationBrand'
  | 'OperationalSimplify'
  | 'IncreaseAOV'
  | 'SimplifyOffer'
  | 'PerformancePricing'
  | 'RemoveGuarantee'
  | 'SimplifyFulfillment'
  | 'HybridPricing'
  | 'AddConditionalGuarantee'
  | 'IncreasePricing'
  | 'AddGuarantee'
  | 'RequireRetainers'
  | 'EnterprisePackaging'
  | 'LandAndExpand'
  | 'Productize'
  | 'Systemize'
  | 'Hybridize'
  | 'IncreasePrice'
  | 'Upmarket'
  | 'Guarantee'
  | 'AddServices'
  | 'UsageBasedPricing'
  | 'AddRetainerComponent'
  | 'IncreaseProof'
  | 'ImproveProof'
  | 'CaseStudies'
  | 'Upsell'
  | 'RaisePricing';

export interface ContextAwareFix {
  id: ContextFixId;
  whatToChange: string;
  howToChangeIt: string;
  targetCondition: string;
  effort: EffortLevel;
  impact: ImpactLevel;
  strategicImpact: number;
  feasibility: number;
  instruction: string;
}

export interface ContextAwareFixStackResult {
  finalScore: number;
  alignmentScore: number;
  powerScore: number;
  contextModifiers: ContextModifiers;
  problems: DetectedProblem[];
  topFixes: ContextAwareFix[];
}
