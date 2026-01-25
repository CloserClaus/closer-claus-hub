// Dropdown options for Offer Diagnostic form

export const OFFER_TYPE_OPTIONS = [
  { value: 'demand_creation', label: 'Demand Creation' },
  { value: 'demand_capture', label: 'Demand Capture' },
  { value: 'outbound_sales_enablement', label: 'Outbound & Sales Enablement' },
  { value: 'retention_monetization', label: 'Retention & Monetization' },
  { value: 'operational_enablement', label: 'Operational Enablement' },
] as const;

export const ICP_INDUSTRY_OPTIONS = [
  { value: 'local_services', label: 'Local Services' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'b2b_service_agency', label: 'B2B Service Agency' },
  { value: 'dtc_ecommerce', label: 'DTC/Ecommerce' },
  { value: 'saas_tech', label: 'SaaS/Tech' },
] as const;

export const ICP_SIZE_OPTIONS = [
  { value: 'solo_founder', label: 'Solo Founder' },
  { value: '1_5_employees', label: '1–5 employees' },
  { value: '6_20_employees', label: '6–20 employees' },
  { value: '21_100_employees', label: '21–100 employees' },
  { value: '100_plus_employees', label: '100+ employees' },
] as const;

export const ICP_MATURITY_OPTIONS = [
  { value: 'pre_revenue', label: 'Pre-Revenue' },
  { value: 'early_traction', label: 'Early Traction' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'mature', label: 'Mature' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

export const PRICING_STRUCTURE_OPTIONS = [
  { value: 'recurring', label: 'Recurring (retainer)' },
  { value: 'one_time', label: 'One-Time (project)' },
  { value: 'performance_only', label: 'Performance-Only' },
  { value: 'usage_based', label: 'Usage-Based (operational output)' },
] as const;

export const RECURRING_PRICE_TIER_OPTIONS = [
  { value: 'under_150', label: '< $150/mo' },
  { value: '150_500', label: '$150–$500/mo' },
  { value: '500_2k', label: '$500–$2k/mo' },
  { value: '2k_5k', label: '$2k–$5k/mo' },
  { value: '5k_plus', label: '$5k+/mo' },
] as const;

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
  { value: 'high', label: 'High (10k+ units/mo)' },
] as const;

export const FULFILLMENT_COMPLEXITY_OPTIONS = [
  { value: 'hands_on_labor', label: 'Hands-on labor (typically < $2k/mo or < $5k one-time)' },
  { value: 'hands_off_strategy', label: 'Hands-off strategy (typically $2k–$10k/mo or $5k–$20k one-time)' },
  { value: 'hybrid_labor_systems', label: 'Hybrid (labor + systems) (typically $2k–$7k/mo or $5k–$20k one-time)' },
  { value: 'software', label: 'Software (typically < $500/mo or < $5k one-time)' },
  { value: 'automation', label: 'Automation (operational enablement) (typically $2k–$5k/mo or $10k–$25k one-time)' },
] as const;

export const RISK_MODEL_OPTIONS = [
  { value: 'no_guarantee', label: 'No guarantee' },
  { value: 'conditional_guarantee', label: 'Conditional guarantee' },
  { value: 'full_guarantee', label: 'Full guarantee' },
  { value: 'performance_only', label: 'Performance only' },
  { value: 'pay_after_results', label: 'Pay after results' },
] as const;
