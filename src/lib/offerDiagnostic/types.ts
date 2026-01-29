// Dropdown option types for Offer Diagnostic

export type OfferType = 
  | 'demand_creation'
  | 'demand_capture'
  | 'outbound_sales_enablement'
  | 'retention_monetization'
  | 'operational_enablement';

// Internal promise buckets used for scoring (not shown to user)
export type PromiseBucket = 
  | 'top_of_funnel_volume'
  | 'mid_funnel_engagement'
  | 'top_line_revenue'
  | 'efficiency_cost_savings'
  | 'ops_compliance_outcomes';

// Keep Promise as alias for PromiseBucket for backward compatibility with scoring engine
export type Promise = PromiseBucket;

// Concrete promise outcomes shown to users
export type PromiseOutcome = 
  // Outbound & Sales Enablement - TOFU
  | 'more_booked_meetings'
  | 'more_qualified_pipeline'
  | 'more_demos_on_calendar'
  | 'replace_founder_led_outreach'
  | 'build_outbound_system'
  | 'increase_show_up_rates'
  // Outbound & Sales Enablement - MOFU
  | 'higher_demo_to_close_rate'
  | 'shorter_sales_cycles'
  | 'improve_follow_up_performance'
  // Outbound & Sales Enablement - Revenue
  | 'increase_new_client_sales'
  | 'increase_mrr_from_outbound'
  // Demand Capture - TOFU
  | 'increase_inbound_leads'
  | 'increase_landing_page_conversion'
  | 'increase_ecommerce_conversions'
  | 'generate_more_calls_from_paid'
  // Demand Capture - Revenue
  | 'increase_roas'
  | 'increase_sales_from_paid'
  | 'increase_ltv_from_ad_spend'
  // Demand Creation - TOFU
  | 'build_brand_awareness'
  | 'increase_social_traffic'
  | 'increase_content_driven_leads'
  | 'improve_engagement_across_channels'
  // Demand Creation - MOFU
  | 'improve_nurture_conversion'
  | 'increase_pipeline_handoff_rates'
  // Retention & Monetization - Revenue
  | 'increase_client_ltv'
  | 'increase_repeat_purchases'
  | 'increase_upsells'
  | 'increase_referrals'
  | 'reduce_client_churn'
  // Retention & Monetization - MOFU
  | 'increase_onboarding_activation'
  | 'increase_product_adoption'
  // Operational Enablement - Efficiency
  | 'reduce_manual_work_time'
  | 'reduce_support_workload'
  | 'automate_repetitive_tasks'
  | 'standardize_processes'
  // Operational Enablement - Ops
  | 'improve_data_accuracy'
  | 'improve_reporting_visibility'
  | 'systemize_compliance_documentation';

export type ICPIndustry = 
  | 'local_services'
  | 'professional_services'
  | 'b2b_service_agency'
  | 'dtc_ecommerce'
  | 'saas_tech'
  | 'information_coaching'
  | 'real_estate'
  | 'healthcare'
  | 'other_b2b';

// Vertical Segment (conditional on Industry) - what user sees
export type VerticalSegment = 
  // Local Services
  | 'home_services' | 'health_wellness' | 'trades' | 'hospitality' | 'real_estate_services' | 'events'
  // Professional Services
  | 'accounting' | 'legal' | 'consulting' | 'insurance' | 'engineering_architecture' | 'financial_advisors'
  // Ecommerce / DTC
  | 'fashion' | 'health_supplements' | 'consumer_electronics' | 'home_kitchen' | 'beauty' | 'other_dtc'
  // SaaS / Tech
  | 'workflow_tools' | 'devtools' | 'ecommerce_enablement' | 'sales_marketing_tools' | 'healthcare_tech' | 'vertical_saas'
  // B2B Service Agency
  | 'marketing_agency' | 'sales_agency' | 'branding_agency' | 'creative_agency' | 'dev_agency' | 'it_services'
  // Information / Coaching
  | 'business_coaching' | 'fitness_coaching' | 'career_coaching' | 'info_products' | 'education' | 'certification'
  // Real Estate
  | 'brokerages' | 'investors' | 'property_management' | 'wholesaling' | 'development' | 'rentals'
  // Healthcare
  | 'clinics' | 'dental' | 'chiro_pt' | 'medspa' | 'home_care' | 'specialty_practices'
  // Other B2B
  | 'industrial_b2b' | 'manufacturing' | 'supply_chain' | 'staffing' | 'logistics' | 'other';

// ICP Specificity — NEW REQUIRED FIELD
export type ICPSpecificity = 'broad' | 'narrow' | 'exact';

// Internal scoring segments (6 buckets)
export type ScoringSegment = 
  | 'Local'
  | 'Professional'
  | 'DTC'
  | 'SaaS'
  | 'Info'
  | 'RealEstate'
  | 'Healthcare'
  | 'OtherB2B';

// Proof Level for market validation
export type ProofLevel = 
  | 'none'
  | 'weak'
  | 'moderate'
  | 'strong'
  | 'category_killer';

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
  | 'usage_based'
  | 'hybrid';

export type HybridRetainerTier =
  | 'under_150'
  | '150_500'
  | '500_2k'
  | '2k_5k'
  | '5k_plus';

export type PerformanceBasis =
  | 'per_appointment'
  | 'per_opportunity'
  | 'per_closed_deal'
  | 'percent_revenue'
  | 'percent_profit'
  | 'percent_ad_spend';

export type PerformanceCompTier =
  | 'under_15_percent'
  | '15_30_percent'
  | 'over_30_percent'
  | 'under_250_unit'
  | '250_500_unit'
  | 'over_500_unit';

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
  | 'api_calls'
  | 'seats'
  | 'credits'
  | 'bandwidth';

export type UsageVolumeTier = 
  | 'low'
  | 'medium'
  | 'high';

export type FulfillmentComplexity = 
  | 'custom_dfy'
  | 'package_based'
  | 'coaching_advisory'
  | 'software_platform'
  | 'staffing_placement';

export type RiskModel =
  | 'no_guarantee'
  | 'conditional_guarantee'
  | 'full_guarantee'
  | 'performance_only'
  | 'pay_after_results';

export interface DiagnosticFormData {
  offerType: OfferType | null;
  promiseOutcome: PromiseOutcome | null;  // What user selects (concrete outcome)
  promise: PromiseBucket | null;           // Auto-mapped bucket for scoring
  icpIndustry: ICPIndustry | null;
  verticalSegment: VerticalSegment | null; // Conditional on Industry
  scoringSegment: ScoringSegment | null;   // Auto-mapped for scoring
  icpSize: ICPSize | null;
  icpMaturity: ICPMaturity | null;
  icpSpecificity: ICPSpecificity | null;   // NEW REQUIRED FIELD
  pricingStructure: PricingStructure | null;
  recurringPriceTier: RecurringPriceTier | null;
  oneTimePriceTier: OneTimePriceTier | null;
  usageOutputType: UsageOutputType | null;
  usageVolumeTier: UsageVolumeTier | null;
  // Hybrid pricing fields
  hybridRetainerTier: HybridRetainerTier | null;
  performanceBasis: PerformanceBasis | null;
  performanceCompTier: PerformanceCompTier | null;
  riskModel: RiskModel | null;
  fulfillmentComplexity: FulfillmentComplexity | null;
  proofLevel: ProofLevel | null;           // Market proof/validation
}

export interface DimensionScores {
  painUrgency: number;      // 0-20 (segment-based)
  buyingPower: number;      // 0-20 (segment-based)
  executionFeasibility: number; // 0-15
  pricingFit: number;       // 0-15
  riskAlignment: number;    // 0-10 (includes proof level)
  outboundFit: number;      // 0-20 (VerticalFit + ProofFit + PromiseFit)
}

export interface ExtendedScores extends DimensionScores {
  alignmentScore: number; // 0-100 composite
  switchingCost: number; // 0-20
}

export type ReadinessLabel = 'Weak' | 'Moderate' | 'Strong';

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

// ========== Violation Types ==========

export type ViolationSeverity = 'high' | 'medium' | 'low';

export interface Violation {
  id: string;
  rule: string;
  severity: ViolationSeverity;
  recommendation: string;
  fixCategory?: 'icp_shift' | 'promise_shift' | 'fulfillment_shift' | 'pricing_shift' | 'risk_shift';
}

// ========== Structured Recommendation Types ==========

export type FixCategory = 
  | 'icp_shift'
  | 'promise_shift'
  | 'fulfillment_shift'
  | 'pricing_shift'
  | 'risk_shift'
  | 'positioning_shift'
  | 'founder_psychology_check';

export interface StructuredRecommendation {
  id: string;
  category: FixCategory;
  headline: string;
  plainExplanation: string;
  actionSteps: string[];
  desiredState: string;
}

export interface ContextAwareFixStackResult {
  finalScore: number;
  alignmentScore: number;
  readinessScore: number;
  readinessLabel: ReadinessLabel;
  contextModifiers: ContextModifiers;
  problems: DetectedProblem[];
  topFixes: ContextAwareFix[];
  violations: Violation[];
  structuredRecommendations: StructuredRecommendation[]; // NEW: Founder-friendly recommendations
}

// ========== Latent Scoring Types ==========

export interface LatentScores {
  economicHeadroom: number;       // 0-20 (derived from EFI)
  proofToPromise: number;         // 0-20
  fulfillmentScalability: number; // 0-20
  riskAlignment: number;          // 0-20
  channelFit: number;             // 0-20
  icpSpecificityStrength: number; // 0-20 (NEW)
}

export type LatentBottleneckKey = keyof LatentScores;

// Economic Friction Index (EFI) class
export type EFIClass = 'VeryLow' | 'Low' | 'Moderate' | 'High' | 'Extreme';

export interface LatentScoringResult {
  alignmentScore: number;          // 0-100
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
}

export type AIRecommendationCategory = 
  | 'pricing_shift' 
  | 'icp_shift' 
  | 'promise_shift' 
  | 'fulfillment_shift' 
  | 'risk_shift' 
  | 'channel_shift';

export interface AIRecommendation {
  id: string;
  headline: string;
  plainExplanation: string;
  actionSteps: string[];
  desiredState: string;
  category: AIRecommendationCategory;
}

export interface OfferDiagnosticSnapshot {
  id?: string;
  workspaceId: string;
  createdAt?: string;
  version: number;
  formData: DiagnosticFormData;
  latentScores: LatentScores;
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentBottleneckKey: LatentBottleneckKey;
  aiRecommendations: StructuredRecommendation[];
}

export interface ActiveOfferContext {
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  promise: PromiseBucket | null;
  offerType: OfferType | null;
  pricingStructure: PricingStructure | null;
  proofLevel: ProofLevel | null;
  fulfillmentComplexity: FulfillmentComplexity | null;
}
