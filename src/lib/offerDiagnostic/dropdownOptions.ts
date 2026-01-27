// Dropdown options for Offer Diagnostic form

export const OFFER_TYPE_OPTIONS = [
  { value: 'demand_creation', label: 'Demand Creation' },
  { value: 'demand_capture', label: 'Demand Capture' },
  { value: 'outbound_sales_enablement', label: 'Outbound & Sales Enablement' },
  { value: 'retention_monetization', label: 'Retention & Monetization' },
  { value: 'operational_enablement', label: 'Operational Enablement' },
] as const;

// ========== PROMISE OUTCOME SYSTEM ==========

// Internal bucket definitions (not shown to user)
export const PROMISE_BUCKET_DEFINITIONS = {
  top_of_funnel_volume: 'Lead flow, booked calls, demos, traffic',
  mid_funnel_engagement: 'Show rates, pipeline conversion, speed',
  top_line_revenue: 'MRR, sales, ACV, LTV',
  efficiency_cost_savings: 'Time reduction, cost reduction',
  ops_compliance_outcomes: 'Systems, data, compliance outcomes',
} as const;

// Outcome to bucket mapping
export const OUTCOME_TO_BUCKET_MAP: Record<string, string> = {
  // Outbound & Sales Enablement - TOFU
  'more_booked_meetings': 'top_of_funnel_volume',
  'more_qualified_pipeline': 'top_of_funnel_volume',
  'more_demos_on_calendar': 'top_of_funnel_volume',
  'replace_founder_led_outreach': 'top_of_funnel_volume',
  'build_outbound_system': 'top_of_funnel_volume',
  'increase_show_up_rates': 'top_of_funnel_volume',
  // Outbound & Sales Enablement - MOFU
  'higher_demo_to_close_rate': 'mid_funnel_engagement',
  'shorter_sales_cycles': 'mid_funnel_engagement',
  'improve_follow_up_performance': 'mid_funnel_engagement',
  // Outbound & Sales Enablement - Revenue
  'increase_new_client_sales': 'top_line_revenue',
  'increase_mrr_from_outbound': 'top_line_revenue',
  // Demand Capture - TOFU
  'increase_inbound_leads': 'top_of_funnel_volume',
  'increase_landing_page_conversion': 'top_of_funnel_volume',
  'increase_ecommerce_conversions': 'top_of_funnel_volume',
  'generate_more_calls_from_paid': 'top_of_funnel_volume',
  // Demand Capture - Revenue
  'increase_roas': 'top_line_revenue',
  'increase_sales_from_paid': 'top_line_revenue',
  'increase_ltv_from_ad_spend': 'top_line_revenue',
  // Demand Creation - TOFU
  'build_brand_awareness': 'top_of_funnel_volume',
  'increase_social_traffic': 'top_of_funnel_volume',
  'increase_content_driven_leads': 'top_of_funnel_volume',
  'improve_engagement_across_channels': 'top_of_funnel_volume',
  // Demand Creation - MOFU
  'improve_nurture_conversion': 'mid_funnel_engagement',
  'increase_pipeline_handoff_rates': 'mid_funnel_engagement',
  // Retention & Monetization - Revenue
  'increase_client_ltv': 'top_line_revenue',
  'increase_repeat_purchases': 'top_line_revenue',
  'increase_upsells': 'top_line_revenue',
  'increase_referrals': 'top_line_revenue',
  'reduce_client_churn': 'top_line_revenue',
  // Retention & Monetization - MOFU
  'increase_onboarding_activation': 'mid_funnel_engagement',
  'increase_product_adoption': 'mid_funnel_engagement',
  // Operational Enablement - Efficiency
  'reduce_manual_work_time': 'efficiency_cost_savings',
  'reduce_support_workload': 'efficiency_cost_savings',
  'automate_repetitive_tasks': 'efficiency_cost_savings',
  'standardize_processes': 'efficiency_cost_savings',
  // Operational Enablement - Ops
  'improve_data_accuracy': 'ops_compliance_outcomes',
  'improve_reporting_visibility': 'ops_compliance_outcomes',
  'systemize_compliance_documentation': 'ops_compliance_outcomes',
};

// Grouped outcomes by offer type
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
        { value: 'more_demos_on_calendar', label: 'More demos on calendar' },
        { value: 'replace_founder_led_outreach', label: 'Replace founder-led outreach' },
        { value: 'build_outbound_system', label: 'Build outbound system' },
        { value: 'increase_show_up_rates', label: 'Increase show-up rates' },
      ],
    },
    {
      groupLabel: 'Sales Performance',
      outcomes: [
        { value: 'higher_demo_to_close_rate', label: 'Higher demo-to-close rate' },
        { value: 'shorter_sales_cycles', label: 'Shorter sales cycles' },
        { value: 'improve_follow_up_performance', label: 'Improve follow-up performance' },
      ],
    },
    {
      groupLabel: 'Revenue',
      outcomes: [
        { value: 'increase_new_client_sales', label: 'Increase new client sales' },
        { value: 'increase_mrr_from_outbound', label: 'Increase MRR from outbound' },
      ],
    },
  ],
  demand_capture: [
    {
      groupLabel: 'Lead Generation',
      outcomes: [
        { value: 'increase_inbound_leads', label: 'Increase inbound leads' },
        { value: 'increase_landing_page_conversion', label: 'Increase conversion rate on landing pages' },
        { value: 'increase_ecommerce_conversions', label: 'Increase ecommerce conversions' },
        { value: 'generate_more_calls_from_paid', label: 'Generate more calls from paid traffic' },
      ],
    },
    {
      groupLabel: 'Revenue',
      outcomes: [
        { value: 'increase_roas', label: 'Increase ROAS' },
        { value: 'increase_sales_from_paid', label: 'Increase sales from paid traffic' },
        { value: 'increase_ltv_from_ad_spend', label: 'Increase LTV from ad spend' },
      ],
    },
  ],
  demand_creation: [
    {
      groupLabel: 'Awareness & Traffic',
      outcomes: [
        { value: 'build_brand_awareness', label: 'Build brand awareness' },
        { value: 'increase_social_traffic', label: 'Increase social traffic' },
        { value: 'increase_content_driven_leads', label: 'Increase content-driven leads' },
        { value: 'improve_engagement_across_channels', label: 'Improve engagement across channels' },
      ],
    },
    {
      groupLabel: 'Pipeline Movement',
      outcomes: [
        { value: 'improve_nurture_conversion', label: 'Improve nurture conversion' },
        { value: 'increase_pipeline_handoff_rates', label: 'Increase pipeline handoff rates' },
      ],
    },
  ],
  retention_monetization: [
    {
      groupLabel: 'Revenue Growth',
      outcomes: [
        { value: 'increase_client_ltv', label: 'Increase client LTV' },
        { value: 'increase_repeat_purchases', label: 'Increase repeat purchases' },
        { value: 'increase_upsells', label: 'Increase upsells' },
        { value: 'increase_referrals', label: 'Increase referrals' },
        { value: 'reduce_client_churn', label: 'Reduce client churn' },
      ],
    },
    {
      groupLabel: 'Customer Success',
      outcomes: [
        { value: 'increase_onboarding_activation', label: 'Increase onboarding activation' },
        { value: 'increase_product_adoption', label: 'Increase product adoption' },
      ],
    },
  ],
  operational_enablement: [
    {
      groupLabel: 'Efficiency',
      outcomes: [
        { value: 'reduce_manual_work_time', label: 'Reduce time spent on manual work' },
        { value: 'reduce_support_workload', label: 'Reduce support workload' },
        { value: 'automate_repetitive_tasks', label: 'Automate repetitive tasks' },
        { value: 'standardize_processes', label: 'Standardize processes' },
      ],
    },
    {
      groupLabel: 'Operations & Compliance',
      outcomes: [
        { value: 'improve_data_accuracy', label: 'Improve data accuracy' },
        { value: 'improve_reporting_visibility', label: 'Improve reporting visibility' },
        { value: 'systemize_compliance_documentation', label: 'Systemize compliance and documentation' },
      ],
    },
  ],
};

// Helper to get bucket from outcome
export function getPromiseBucketFromOutcome(outcome: string): string | null {
  return OUTCOME_TO_BUCKET_MAP[outcome] || null;
}

// Legacy promise options (kept for backward compatibility)
export const PROMISE_OPTIONS = [
  { 
    value: 'top_of_funnel_volume', 
    label: 'Top-of-Funnel Volume',
    tooltip: 'More leads, more booked calls',
  },
  { 
    value: 'mid_funnel_engagement', 
    label: 'Mid-Funnel Engagement',
    tooltip: 'Better pipeline movement, demo attendance',
  },
  { 
    value: 'top_line_revenue', 
    label: 'Top-Line Revenue',
    tooltip: 'Increased MRR/ARR or new client revenue',
  },
  { 
    value: 'efficiency_cost_savings', 
    label: 'Efficiency & Cost Savings',
    tooltip: 'Reduced CAC, reduced labor time, improved margins',
  },
  { 
    value: 'ops_compliance_outcomes', 
    label: 'Ops & Compliance Outcomes',
    tooltip: 'Clean data, accurate reporting, compliance',
  },
] as const;

// Legacy promise filtering (kept for backward compatibility)
export const PROMISE_BY_OFFER_TYPE: Record<string, string[]> = {
  demand_creation: ['top_of_funnel_volume', 'mid_funnel_engagement'],
  demand_capture: ['mid_funnel_engagement', 'top_line_revenue'],
  outbound_sales_enablement: ['top_of_funnel_volume', 'mid_funnel_engagement', 'top_line_revenue'],
  retention_monetization: ['top_line_revenue'],
  operational_enablement: ['efficiency_cost_savings', 'ops_compliance_outcomes'],
};

export const ICP_INDUSTRY_OPTIONS = [
  { value: 'local_services', label: 'Local Services' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'dtc_ecommerce', label: 'Ecommerce / DTC' },
  { value: 'saas_tech', label: 'SaaS / Tech' },
  { value: 'b2b_service_agency', label: 'B2B Service Agency' },
  { value: 'information_coaching', label: 'Information / Coaching' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'other_b2b', label: 'Other B2B' },
] as const;

// ========== VERTICAL SEGMENT SYSTEM ==========

// Vertical segments grouped by industry
export const VERTICAL_SEGMENTS_BY_INDUSTRY: Record<string, { value: string; label: string }[]> = {
  local_services: [
    { value: 'home_services', label: 'Home Services' },
    { value: 'health_wellness', label: 'Health/Wellness' },
    { value: 'trades', label: 'Trades' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'real_estate_services', label: 'Real Estate Services' },
    { value: 'events', label: 'Events' },
  ],
  professional_services: [
    { value: 'accounting', label: 'Accounting' },
    { value: 'legal', label: 'Legal' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'engineering_architecture', label: 'Engineering & Architecture' },
    { value: 'financial_advisors', label: 'Financial Advisors' },
  ],
  dtc_ecommerce: [
    { value: 'fashion', label: 'Fashion' },
    { value: 'health_supplements', label: 'Health & Supplements' },
    { value: 'consumer_electronics', label: 'Consumer Electronics' },
    { value: 'home_kitchen', label: 'Home & Kitchen' },
    { value: 'beauty', label: 'Beauty' },
    { value: 'other_dtc', label: 'Other DTC' },
  ],
  saas_tech: [
    { value: 'workflow_tools', label: 'Workflow Tools' },
    { value: 'devtools', label: 'DevTools' },
    { value: 'ecommerce_enablement', label: 'Ecommerce Enablement' },
    { value: 'sales_marketing_tools', label: 'Sales/Marketing Tools' },
    { value: 'healthcare_tech', label: 'Healthcare Tech' },
    { value: 'vertical_saas', label: 'Vertical SaaS' },
  ],
  b2b_service_agency: [
    { value: 'marketing_agency', label: 'Marketing Agency' },
    { value: 'sales_agency', label: 'Sales Agency' },
    { value: 'branding_agency', label: 'Branding Agency' },
    { value: 'creative_agency', label: 'Creative Agency' },
    { value: 'dev_agency', label: 'Dev Agency' },
    { value: 'it_services', label: 'IT Services' },
  ],
  information_coaching: [
    { value: 'business_coaching', label: 'Business Coaching' },
    { value: 'fitness_coaching', label: 'Fitness Coaching' },
    { value: 'career_coaching', label: 'Career Coaching' },
    { value: 'info_products', label: 'Info Products' },
    { value: 'education', label: 'Education' },
    { value: 'certification', label: 'Certification' },
  ],
  real_estate: [
    { value: 'brokerages', label: 'Brokerages' },
    { value: 'investors', label: 'Investors' },
    { value: 'property_management', label: 'Property Management' },
    { value: 'wholesaling', label: 'Wholesaling' },
    { value: 'development', label: 'Development' },
    { value: 'rentals', label: 'Rentals' },
  ],
  healthcare: [
    { value: 'clinics', label: 'Clinics' },
    { value: 'dental', label: 'Dental' },
    { value: 'chiro_pt', label: 'Chiro/PT' },
    { value: 'medspa', label: 'Medspa' },
    { value: 'home_care', label: 'Home Care' },
    { value: 'specialty_practices', label: 'Specialty Practices' },
  ],
  other_b2b: [
    { value: 'industrial_b2b', label: 'Industrial B2B' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'supply_chain', label: 'Supply Chain' },
    { value: 'staffing', label: 'Staffing' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'other', label: 'Other' },
  ],
};

// Internal mapping: VerticalSegment → ScoringSegment
export const VERTICAL_TO_SCORING_SEGMENT: Record<string, string> = {
  // Local Services → Local
  'home_services': 'Local',
  'health_wellness': 'Local',
  'trades': 'Local',
  'hospitality': 'Local',
  'events': 'Local',
  'real_estate_services': 'RealEstate',
  
  // Professional Services → Professional
  'accounting': 'Professional',
  'legal': 'Professional',
  'consulting': 'Professional',
  'insurance': 'Professional',
  'engineering_architecture': 'Professional',
  'financial_advisors': 'Professional',
  
  // Ecommerce / DTC → DTC
  'fashion': 'DTC',
  'health_supplements': 'DTC',
  'consumer_electronics': 'DTC',
  'home_kitchen': 'DTC',
  'beauty': 'DTC',
  'other_dtc': 'DTC',
  
  // SaaS / Tech → SaaS
  'workflow_tools': 'SaaS',
  'devtools': 'SaaS',
  'ecommerce_enablement': 'SaaS',
  'sales_marketing_tools': 'SaaS',
  'healthcare_tech': 'SaaS',
  'vertical_saas': 'SaaS',
  
  // B2B Service Agency → Professional
  'marketing_agency': 'Professional',
  'sales_agency': 'Professional',
  'branding_agency': 'Professional',
  'creative_agency': 'Professional',
  'dev_agency': 'Professional',
  'it_services': 'Professional',
  
  // Information / Coaching → Info
  'business_coaching': 'Info',
  'fitness_coaching': 'Info',
  'career_coaching': 'Info',
  'info_products': 'Info',
  'education': 'Info',
  'certification': 'Info',
  
  // Real Estate → RealEstate
  'brokerages': 'RealEstate',
  'investors': 'RealEstate',
  'property_management': 'RealEstate',
  'wholesaling': 'RealEstate',
  'development': 'RealEstate',
  'rentals': 'RealEstate',
  
  // Healthcare → Healthcare
  'clinics': 'Healthcare',
  'dental': 'Healthcare',
  'chiro_pt': 'Healthcare',
  'medspa': 'Healthcare',
  'home_care': 'Healthcare',
  'specialty_practices': 'Healthcare',
  
  // Other B2B → OtherB2B
  'industrial_b2b': 'OtherB2B',
  'manufacturing': 'OtherB2B',
  'supply_chain': 'OtherB2B',
  'staffing': 'OtherB2B',
  'logistics': 'OtherB2B',
  'other': 'OtherB2B',
};

// Helper to get scoring segment from vertical segment
export function getScoringSegmentFromVertical(verticalSegment: string): string | null {
  return VERTICAL_TO_SCORING_SEGMENT[verticalSegment] || null;
}

// ========== PROOF LEVEL SYSTEM ==========

export const PROOF_LEVEL_OPTIONS = [
  { value: 'none', label: 'None (no results yet)' },
  { value: 'weak', label: 'Weak (1–2 case studies)' },
  { value: 'moderate', label: 'Moderate (consistent small outcomes)' },
  { value: 'strong', label: 'Strong (multiple wins)' },
  { value: 'category_killer', label: 'Category Killer (dominant in niche)' },
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
  { value: 'recurring', label: 'Recurring (Retainer)' },
  { value: 'one_time', label: 'One-Time (Project)' },
  { value: 'performance_only', label: 'Performance Only' },
  { value: 'usage_based', label: 'Usage-Based (Operational Output)' },
  { value: 'hybrid', label: 'Hybrid (Retainer + Performance)' },
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
  { value: 'api_calls', label: 'API Calls' },
  { value: 'seats', label: 'Seats' },
  { value: 'credits', label: 'Credits' },
  { value: 'bandwidth', label: 'Bandwidth' },
] as const;

export const USAGE_VOLUME_TIER_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

// Hybrid retainer tier options
export const HYBRID_RETAINER_TIER_OPTIONS = [
  { value: 'under_150', label: '<$150/mo' },
  { value: '150_500', label: '$150–$500/mo' },
  { value: '500_2k', label: '$500–$2,000/mo' },
  { value: '2k_5k', label: '$2,000–$5,000/mo' },
  { value: '5k_plus', label: '$5,000+/mo' },
] as const;

// Performance basis options
export const PERFORMANCE_BASIS_OPTIONS = [
  { value: 'per_appointment', label: '$ per appointment' },
  { value: 'per_opportunity', label: '$ per opportunity' },
  { value: 'per_closed_deal', label: '$ per closed deal' },
  { value: 'percent_revenue', label: '% of revenue' },
  { value: 'percent_profit', label: '% of profit' },
  { value: 'percent_ad_spend', label: '% of ad spend' },
] as const;

// Performance compensation tier options
export const PERFORMANCE_COMP_TIER_OPTIONS = [
  { value: 'under_15_percent', label: '<15%' },
  { value: '15_30_percent', label: '15–30%' },
  { value: 'over_30_percent', label: '30%+' },
  { value: 'under_250_unit', label: '<$250/unit' },
  { value: '250_500_unit', label: '$250–$500/unit' },
  { value: 'over_500_unit', label: '$500+/unit' },
] as const;

export const FULFILLMENT_COMPLEXITY_OPTIONS = [
  { 
    value: 'custom_dfy', 
    label: 'Custom Done-For-You',
    tooltip: 'Definition: Scope varies per client. Example: Custom PPC + landing pages.',
  },
  { 
    value: 'package_based', 
    label: 'Productized Service',
    tooltip: 'Definition: Pre-defined packages with fixed deliverables. Example: Video editing packages.',
  },
  { 
    value: 'coaching_advisory', 
    label: 'Coaching / Advisory',
    tooltip: 'Definition: Strategy only, client implements. Example: Sales coaching.',
  },
  { 
    value: 'software_platform', 
    label: 'Software / Platform',
    tooltip: 'Definition: Client pays to use a platform. Example: CRM SaaS.',
  },
  { 
    value: 'staffing_placement', 
    label: 'Staffing / Placement',
    tooltip: 'Definition: You recruit/place talent. Example: SDR placement.',
  },
] as const;

export const RISK_MODEL_OPTIONS = [
  { value: 'no_guarantee', label: 'No guarantee' },
  { value: 'conditional_guarantee', label: 'Conditional guarantee' },
  { value: 'full_guarantee', label: 'Full guarantee' },
  { value: 'performance_only', label: 'Performance only' },
  { value: 'pay_after_results', label: 'Pay after results' },
] as const;
