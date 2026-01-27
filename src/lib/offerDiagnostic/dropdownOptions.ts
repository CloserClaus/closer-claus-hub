// Dropdown options for Offer Diagnostic form - Updated to match new spec

// ========== OFFER TYPE OPTIONS ==========
export const OFFER_TYPE_OPTIONS = [
  { value: 'demand_creation', label: 'Demand Creation' },
  { value: 'demand_capture', label: 'Demand Capture' },
  { value: 'outbound_sales_enablement', label: 'Outbound & Sales Enablement' },
  { value: 'retention_monetization', label: 'Retention & Monetization' },
  { value: 'operational_enablement', label: 'Operational Enablement' },
] as const;

// ========== PROMISE OPTIONS ==========
export const PROMISE_OPTIONS = [
  { value: 'top_of_funnel_volume', label: 'Top-of-funnel volume' },
  { value: 'mid_funnel_engagement', label: 'Mid-funnel engagement' },
  { value: 'top_line_revenue', label: 'Top-line revenue' },
  { value: 'efficiency_cost_savings', label: 'Efficiency & cost savings' },
  { value: 'ops_compliance_outcomes', label: 'Ops & compliance outcomes' },
] as const;

// ========== ICP INDUSTRY OPTIONS ==========
export const ICP_INDUSTRY_OPTIONS = [
  { value: 'local_services', label: 'Local Services' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'dtc_ecommerce', label: 'DTC/Ecommerce' },
  { value: 'b2b_service_agency', label: 'B2B Service Agency' },
  { value: 'saas_tech', label: 'SaaS/Tech' },
] as const;

// ========== VERTICAL SEGMENT SYSTEM ==========
// Dynamic options based on selected industry
export const VERTICAL_SEGMENTS_BY_INDUSTRY: Record<string, { value: string; label: string }[]> = {
  local_services: [
    { value: 'home_services', label: 'Home services' },
    { value: 'medical_clinics', label: 'Medical clinics' },
    { value: 'legal_offices', label: 'Legal offices' },
    { value: 'real_estate_brokers', label: 'Real estate brokers' },
    { value: 'local_retail', label: 'Local retail' },
  ],
  professional_services: [
    { value: 'accounting', label: 'Accounting' },
    { value: 'law_firms', label: 'Law firms' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'insurance_brokers', label: 'Insurance brokers' },
  ],
  dtc_ecommerce: [
    { value: 'fashion', label: 'Fashion' },
    { value: 'beauty', label: 'Beauty' },
    { value: 'health', label: 'Health' },
    { value: 'home_lifestyle', label: 'Home & lifestyle' },
    { value: 'electronics', label: 'Electronics' },
  ],
  b2b_service_agency: [
    { value: 'marketing_agency', label: 'Marketing agency' },
    { value: 'creative_agency', label: 'Creative agency' },
    { value: 'dev_agency', label: 'Dev agency' },
    { value: 'branding', label: 'Branding' },
    { value: 'lead_gen', label: 'Lead gen' },
  ],
  saas_tech: [
    { value: 'b2b_saas', label: 'B2B SaaS' },
    { value: 'dev_tools', label: 'Dev tools' },
    { value: 'productivity_software', label: 'Productivity software' },
    { value: 'security_tools', label: 'Security tools' },
    { value: 'analytics', label: 'Analytics' },
  ],
};

// Helper to get scoring segment from vertical segment
export function getScoringSegmentFromVertical(verticalSegment: string): string | null {
  // Map verticals to scoring segments based on industry
  const verticalToSegment: Record<string, string> = {
    // Local Services → Local
    'home_services': 'Local',
    'medical_clinics': 'Local',
    'legal_offices': 'Local',
    'real_estate_brokers': 'Local',
    'local_retail': 'Local',
    // Professional Services → Professional
    'accounting': 'Professional',
    'law_firms': 'Professional',
    'consulting': 'Professional',
    'architecture': 'Professional',
    'insurance_brokers': 'Professional',
    // DTC/Ecommerce → DTC
    'fashion': 'DTC',
    'beauty': 'DTC',
    'health': 'DTC',
    'home_lifestyle': 'DTC',
    'electronics': 'DTC',
    // B2B Service Agency → Professional
    'marketing_agency': 'Professional',
    'creative_agency': 'Professional',
    'dev_agency': 'Professional',
    'branding': 'Professional',
    'lead_gen': 'Professional',
    // SaaS/Tech → SaaS
    'b2b_saas': 'SaaS',
    'dev_tools': 'SaaS',
    'productivity_software': 'SaaS',
    'security_tools': 'SaaS',
    'analytics': 'SaaS',
  };
  return verticalToSegment[verticalSegment] || null;
}

// ========== ICP SIZE OPTIONS ==========
export const ICP_SIZE_OPTIONS = [
  { value: 'solo_founder', label: 'Solo founder' },
  { value: '1_5_employees', label: '1–5 employees' },
  { value: '6_20_employees', label: '6–20 employees' },
  { value: '21_100_employees', label: '21–100 employees' },
  { value: '100_plus_employees', label: '100+ employees' },
] as const;

// ========== ICP MATURITY OPTIONS ==========
export const ICP_MATURITY_OPTIONS = [
  { value: 'pre_revenue', label: 'Pre-revenue' },
  { value: 'early_traction', label: 'Early traction' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'mature', label: 'Mature' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

// ========== PRICING STRUCTURE OPTIONS ==========
export const PRICING_STRUCTURE_OPTIONS = [
  { value: 'retainer', label: 'Retainer' },
  { value: 'hybrid', label: 'Hybrid (retainer + performance)' },
  { value: 'performance_only', label: 'Performance-only' },
  { value: 'one_time_project', label: 'One-time project' },
  { value: 'usage_based', label: 'Usage-based' },
] as const;

// ========== PRICE TIER OPTIONS ==========
export const PRICE_TIER_OPTIONS = [
  { value: 'under_150', label: '<$150/mo' },
  { value: '150_500', label: '$150–$500/mo' },
  { value: '500_2k', label: '$500–$2,000/mo' },
  { value: '2k_5k', label: '$2,000–$5,000/mo' },
  { value: '5k_plus', label: '$5,000+/mo' },
] as const;

// Legacy aliases for compatibility
export const RECURRING_PRICE_TIER_OPTIONS = PRICE_TIER_OPTIONS;
export const ONE_TIME_PRICE_TIER_OPTIONS = [
  { value: 'under_3k', label: '< $3k' },
  { value: '3k_10k', label: '$3k–$10k' },
  { value: '10k_plus', label: '$10k+' },
] as const;

export const USAGE_OUTPUT_TYPE_OPTIONS = [
  { value: 'lead_based', label: 'Lead-based (per lead / per booked call)' },
  { value: 'conversion_based', label: 'Conversion-based (per demo / per sale)' },
  { value: 'task_based', label: 'Task-based (per workflow / per task)' },
] as const;

export const USAGE_VOLUME_TIER_OPTIONS = [
  { value: 'low', label: 'Low (<1k units/mo)' },
  { value: 'mid', label: 'Mid (1k–10k units/mo)' },
  { value: 'high', label: 'High (>10k units/mo)' },
] as const;

// ========== RISK MODEL OPTIONS ==========
export const RISK_MODEL_OPTIONS = [
  { value: 'no_guarantee', label: 'No guarantee' },
  { value: 'conditional_guarantee', label: 'Conditional guarantee' },
  { value: 'full_guarantee', label: 'Full guarantee' },
  { value: 'pay_on_performance', label: 'Pay on performance' },
  { value: 'pay_after_results', label: 'Pay after results' },
] as const;

// ========== PROOF LEVEL OPTIONS ==========
export const PROOF_LEVEL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'weak', label: 'Weak' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'strong', label: 'Strong' },
] as const;

// ========== FULFILLMENT OPTIONS ==========
export const FULFILLMENT_COMPLEXITY_OPTIONS = [
  { value: 'custom_dfy', label: 'Custom DFY', tooltip: 'Fully custom done-for-you work (high labor, low leverage)' },
  { value: 'productized_service', label: 'Productized service', tooltip: 'Standardized service packages with defined scope' },
  { value: 'coaching_advisory', label: 'Coaching/advisory', tooltip: 'Strategy, guidance, and coaching without execution' },
  { value: 'software_platform', label: 'Software/platform access', tooltip: 'SaaS tool or platform access with minimal service' },
  { value: 'staffing_placement', label: 'Staffing/placement', tooltip: 'Placing talent or contractors in client organizations' },
] as const;

// ========== LEGACY EXPORTS FOR COMPATIBILITY ==========

// Promise outcome system (simplified for new spec)
export interface OutcomeGroup {
  groupLabel: string;
  outcomes: { value: string; label: string }[];
}

export const OUTCOMES_BY_OFFER_TYPE: Record<string, OutcomeGroup[]> = {
  outbound_sales_enablement: [
    {
      groupLabel: 'Lead Generation',
      outcomes: [
        { value: 'more_booked_meetings', label: 'More booked meetings' },
        { value: 'more_qualified_pipeline', label: 'More qualified pipeline' },
      ],
    },
    {
      groupLabel: 'Revenue',
      outcomes: [
        { value: 'increase_new_client_sales', label: 'Increase new client sales' },
      ],
    },
  ],
  demand_capture: [
    {
      groupLabel: 'Lead Generation',
      outcomes: [
        { value: 'increase_inbound_leads', label: 'Increase inbound leads' },
        { value: 'increase_landing_page_conversion', label: 'Increase conversion rate' },
      ],
    },
    {
      groupLabel: 'Revenue',
      outcomes: [
        { value: 'increase_roas', label: 'Increase ROAS' },
      ],
    },
  ],
  demand_creation: [
    {
      groupLabel: 'Awareness & Traffic',
      outcomes: [
        { value: 'build_brand_awareness', label: 'Build brand awareness' },
        { value: 'increase_social_traffic', label: 'Increase social traffic' },
      ],
    },
  ],
  retention_monetization: [
    {
      groupLabel: 'Revenue Growth',
      outcomes: [
        { value: 'increase_client_ltv', label: 'Increase client LTV' },
        { value: 'reduce_client_churn', label: 'Reduce client churn' },
      ],
    },
  ],
  operational_enablement: [
    {
      groupLabel: 'Efficiency',
      outcomes: [
        { value: 'reduce_manual_work_time', label: 'Reduce time spent on manual work' },
        { value: 'automate_repetitive_tasks', label: 'Automate repetitive tasks' },
      ],
    },
  ],
};

export const OUTCOME_TO_BUCKET_MAP: Record<string, string> = {
  'more_booked_meetings': 'top_of_funnel_volume',
  'more_qualified_pipeline': 'top_of_funnel_volume',
  'increase_new_client_sales': 'top_line_revenue',
  'increase_inbound_leads': 'top_of_funnel_volume',
  'increase_landing_page_conversion': 'mid_funnel_engagement',
  'increase_roas': 'top_line_revenue',
  'build_brand_awareness': 'top_of_funnel_volume',
  'increase_social_traffic': 'top_of_funnel_volume',
  'increase_client_ltv': 'top_line_revenue',
  'reduce_client_churn': 'top_line_revenue',
  'reduce_manual_work_time': 'efficiency_cost_savings',
  'automate_repetitive_tasks': 'efficiency_cost_savings',
};

export function getPromiseBucketFromOutcome(outcome: string): string | null {
  return OUTCOME_TO_BUCKET_MAP[outcome] || null;
}
