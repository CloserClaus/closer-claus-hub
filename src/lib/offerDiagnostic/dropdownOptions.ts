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
  { value: 'dtc_ecommerce', label: 'DTC/Ecommerce' },
  { value: 'saas_tech', label: 'SaaS/Tech' },
  { value: 'other_b2b', label: 'Other B2B' },
] as const;

export const ICP_SIZE_OPTIONS = [
  { value: 'solo_founder', label: 'Solo founder' },
  { value: '1_5_employees', label: '1–5 employees' },
  { value: '6_20_employees', label: '6–20 employees' },
  { value: '21_100_employees', label: '21–100 employees' },
  { value: '100_plus_employees', label: '100+ employees' },
] as const;

export const ICP_MATURITY_OPTIONS = [
  { value: 'pre_revenue', label: 'Pre-revenue' },
  { value: 'early_traction', label: 'Early traction' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'mature', label: 'Mature' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

export const PRICING_MODEL_OPTIONS = [
  { value: 'retainer', label: 'Retainer' },
  { value: 'hybrid', label: 'Hybrid (retainer + performance)' },
  { value: 'performance_only', label: 'Performance-only' },
  { value: 'one_time_project', label: 'One-time project' },
  { value: 'usage_based', label: 'Usage-based' },
] as const;

export const PRICE_TIER_OPTIONS = [
  { value: 'under_1k', label: '<$1k/mo' },
  { value: '1k_3k', label: '$1k–$3k/mo' },
  { value: '3k_10k', label: '$3k–$10k/mo' },
  { value: '10k_plus', label: '$10k+/mo' },
  { value: 'performance_only', label: 'Performance-only' },
] as const;

export const RISK_STRUCTURE_OPTIONS = [
  { value: 'no_guarantee', label: 'No guarantee' },
  { value: 'conditional_guarantee', label: 'Conditional guarantee' },
  { value: 'full_guarantee', label: 'Full guarantee' },
  { value: 'pay_on_performance', label: 'Pay on performance' },
  { value: 'pay_after_results', label: 'Pay after results' },
] as const;

export const FULFILLMENT_COMPLEXITY_OPTIONS = [
  { value: 'hands_on_labor', label: 'Hands-on labor' },
  { value: 'hands_off_strategy', label: 'Hands-off strategy' },
  { value: 'hybrid_labor_systems', label: 'Hybrid (labor + systems)' },
  { value: 'software_automation', label: 'Software/automation' },
  { value: 'staffing_placement', label: 'Staffing/placement' },
] as const;
