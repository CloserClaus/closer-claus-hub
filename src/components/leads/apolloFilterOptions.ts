import { ComboboxOption } from '@/components/ui/multi-select-combobox';

// Seniority Options
export const SENIORITY_OPTIONS: ComboboxOption[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'vp', label: 'VP' },
  { value: 'head', label: 'Head' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior', label: 'Senior' },
  { value: 'entry', label: 'Entry' },
  { value: 'intern', label: 'Intern' },
];

// Department Options
export const DEPARTMENT_OPTIONS: ComboboxOption[] = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'operations', label: 'Operations' },
  { value: 'information_technology', label: 'IT' },
  { value: 'legal', label: 'Legal' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'product_management', label: 'Product Management' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'support', label: 'Support' },
  { value: 'education', label: 'Education' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'media_and_comms', label: 'Media & Communications' },
  { value: 'arts_and_design', label: 'Arts & Design' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'data_science', label: 'Data Science' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'medical_and_health', label: 'Medical & Health' },
];

// Employee Range Options
export const EMPLOYEE_RANGE_OPTIONS: ComboboxOption[] = [
  { value: '1,10', label: '1-10 employees' },
  { value: '11,20', label: '11-20 employees' },
  { value: '21,50', label: '21-50 employees' },
  { value: '51,100', label: '51-100 employees' },
  { value: '101,200', label: '101-200 employees' },
  { value: '201,500', label: '201-500 employees' },
  { value: '501,1000', label: '501-1,000 employees' },
  { value: '1001,2000', label: '1,001-2,000 employees' },
  { value: '2001,5000', label: '2,001-5,000 employees' },
  { value: '5001,10000', label: '5,001-10,000 employees' },
  { value: '10001,', label: '10,000+ employees' },
];

// Comprehensive Country List
export const COUNTRY_OPTIONS: ComboboxOption[] = [
  // North America
  { value: 'United States', label: 'United States', group: 'North America' },
  { value: 'Canada', label: 'Canada', group: 'North America' },
  { value: 'Mexico', label: 'Mexico', group: 'North America' },
  
  // Europe
  { value: 'United Kingdom', label: 'United Kingdom', group: 'Europe' },
  { value: 'Germany', label: 'Germany', group: 'Europe' },
  { value: 'France', label: 'France', group: 'Europe' },
  { value: 'Netherlands', label: 'Netherlands', group: 'Europe' },
  { value: 'Spain', label: 'Spain', group: 'Europe' },
  { value: 'Italy', label: 'Italy', group: 'Europe' },
  { value: 'Switzerland', label: 'Switzerland', group: 'Europe' },
  { value: 'Sweden', label: 'Sweden', group: 'Europe' },
  { value: 'Norway', label: 'Norway', group: 'Europe' },
  { value: 'Denmark', label: 'Denmark', group: 'Europe' },
  { value: 'Finland', label: 'Finland', group: 'Europe' },
  { value: 'Belgium', label: 'Belgium', group: 'Europe' },
  { value: 'Austria', label: 'Austria', group: 'Europe' },
  { value: 'Poland', label: 'Poland', group: 'Europe' },
  { value: 'Ireland', label: 'Ireland', group: 'Europe' },
  { value: 'Portugal', label: 'Portugal', group: 'Europe' },
  { value: 'Czech Republic', label: 'Czech Republic', group: 'Europe' },
  { value: 'Romania', label: 'Romania', group: 'Europe' },
  { value: 'Greece', label: 'Greece', group: 'Europe' },
  { value: 'Hungary', label: 'Hungary', group: 'Europe' },
  { value: 'Ukraine', label: 'Ukraine', group: 'Europe' },
  
  // Asia Pacific
  { value: 'India', label: 'India', group: 'Asia Pacific' },
  { value: 'China', label: 'China', group: 'Asia Pacific' },
  { value: 'Japan', label: 'Japan', group: 'Asia Pacific' },
  { value: 'Singapore', label: 'Singapore', group: 'Asia Pacific' },
  { value: 'Australia', label: 'Australia', group: 'Asia Pacific' },
  { value: 'New Zealand', label: 'New Zealand', group: 'Asia Pacific' },
  { value: 'South Korea', label: 'South Korea', group: 'Asia Pacific' },
  { value: 'Hong Kong', label: 'Hong Kong', group: 'Asia Pacific' },
  { value: 'Taiwan', label: 'Taiwan', group: 'Asia Pacific' },
  { value: 'Indonesia', label: 'Indonesia', group: 'Asia Pacific' },
  { value: 'Malaysia', label: 'Malaysia', group: 'Asia Pacific' },
  { value: 'Thailand', label: 'Thailand', group: 'Asia Pacific' },
  { value: 'Philippines', label: 'Philippines', group: 'Asia Pacific' },
  { value: 'Vietnam', label: 'Vietnam', group: 'Asia Pacific' },
  { value: 'Pakistan', label: 'Pakistan', group: 'Asia Pacific' },
  { value: 'Bangladesh', label: 'Bangladesh', group: 'Asia Pacific' },
  
  // Middle East
  { value: 'United Arab Emirates', label: 'United Arab Emirates', group: 'Middle East' },
  { value: 'Israel', label: 'Israel', group: 'Middle East' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia', group: 'Middle East' },
  { value: 'Qatar', label: 'Qatar', group: 'Middle East' },
  { value: 'Turkey', label: 'Turkey', group: 'Middle East' },
  { value: 'Egypt', label: 'Egypt', group: 'Middle East' },
  
  // South America
  { value: 'Brazil', label: 'Brazil', group: 'South America' },
  { value: 'Argentina', label: 'Argentina', group: 'South America' },
  { value: 'Chile', label: 'Chile', group: 'South America' },
  { value: 'Colombia', label: 'Colombia', group: 'South America' },
  { value: 'Peru', label: 'Peru', group: 'South America' },
  
  // Africa
  { value: 'South Africa', label: 'South Africa', group: 'Africa' },
  { value: 'Nigeria', label: 'Nigeria', group: 'Africa' },
  { value: 'Kenya', label: 'Kenya', group: 'Africa' },
  { value: 'Morocco', label: 'Morocco', group: 'Africa' },
];

// US States
export const US_STATE_OPTIONS: ComboboxOption[] = [
  { value: 'Alabama', label: 'Alabama' },
  { value: 'Alaska', label: 'Alaska' },
  { value: 'Arizona', label: 'Arizona' },
  { value: 'Arkansas', label: 'Arkansas' },
  { value: 'California', label: 'California' },
  { value: 'Colorado', label: 'Colorado' },
  { value: 'Connecticut', label: 'Connecticut' },
  { value: 'Delaware', label: 'Delaware' },
  { value: 'Florida', label: 'Florida' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Hawaii', label: 'Hawaii' },
  { value: 'Idaho', label: 'Idaho' },
  { value: 'Illinois', label: 'Illinois' },
  { value: 'Indiana', label: 'Indiana' },
  { value: 'Iowa', label: 'Iowa' },
  { value: 'Kansas', label: 'Kansas' },
  { value: 'Kentucky', label: 'Kentucky' },
  { value: 'Louisiana', label: 'Louisiana' },
  { value: 'Maine', label: 'Maine' },
  { value: 'Maryland', label: 'Maryland' },
  { value: 'Massachusetts', label: 'Massachusetts' },
  { value: 'Michigan', label: 'Michigan' },
  { value: 'Minnesota', label: 'Minnesota' },
  { value: 'Mississippi', label: 'Mississippi' },
  { value: 'Missouri', label: 'Missouri' },
  { value: 'Montana', label: 'Montana' },
  { value: 'Nebraska', label: 'Nebraska' },
  { value: 'Nevada', label: 'Nevada' },
  { value: 'New Hampshire', label: 'New Hampshire' },
  { value: 'New Jersey', label: 'New Jersey' },
  { value: 'New Mexico', label: 'New Mexico' },
  { value: 'New York', label: 'New York' },
  { value: 'North Carolina', label: 'North Carolina' },
  { value: 'North Dakota', label: 'North Dakota' },
  { value: 'Ohio', label: 'Ohio' },
  { value: 'Oklahoma', label: 'Oklahoma' },
  { value: 'Oregon', label: 'Oregon' },
  { value: 'Pennsylvania', label: 'Pennsylvania' },
  { value: 'Rhode Island', label: 'Rhode Island' },
  { value: 'South Carolina', label: 'South Carolina' },
  { value: 'South Dakota', label: 'South Dakota' },
  { value: 'Tennessee', label: 'Tennessee' },
  { value: 'Texas', label: 'Texas' },
  { value: 'Utah', label: 'Utah' },
  { value: 'Vermont', label: 'Vermont' },
  { value: 'Virginia', label: 'Virginia' },
  { value: 'Washington', label: 'Washington' },
  { value: 'West Virginia', label: 'West Virginia' },
  { value: 'Wisconsin', label: 'Wisconsin' },
  { value: 'Wyoming', label: 'Wyoming' },
  { value: 'District of Columbia', label: 'Washington D.C.' },
];

// Major US Cities
export const US_CITY_OPTIONS: ComboboxOption[] = [
  { value: 'New York', label: 'New York', group: 'Northeast' },
  { value: 'Los Angeles', label: 'Los Angeles', group: 'West' },
  { value: 'Chicago', label: 'Chicago', group: 'Midwest' },
  { value: 'Houston', label: 'Houston', group: 'South' },
  { value: 'Phoenix', label: 'Phoenix', group: 'West' },
  { value: 'Philadelphia', label: 'Philadelphia', group: 'Northeast' },
  { value: 'San Antonio', label: 'San Antonio', group: 'South' },
  { value: 'San Diego', label: 'San Diego', group: 'West' },
  { value: 'Dallas', label: 'Dallas', group: 'South' },
  { value: 'San Jose', label: 'San Jose', group: 'West' },
  { value: 'Austin', label: 'Austin', group: 'South' },
  { value: 'Jacksonville', label: 'Jacksonville', group: 'South' },
  { value: 'Fort Worth', label: 'Fort Worth', group: 'South' },
  { value: 'Columbus', label: 'Columbus', group: 'Midwest' },
  { value: 'Indianapolis', label: 'Indianapolis', group: 'Midwest' },
  { value: 'Charlotte', label: 'Charlotte', group: 'South' },
  { value: 'San Francisco', label: 'San Francisco', group: 'West' },
  { value: 'Seattle', label: 'Seattle', group: 'West' },
  { value: 'Denver', label: 'Denver', group: 'West' },
  { value: 'Washington', label: 'Washington D.C.', group: 'Northeast' },
  { value: 'Boston', label: 'Boston', group: 'Northeast' },
  { value: 'Nashville', label: 'Nashville', group: 'South' },
  { value: 'Detroit', label: 'Detroit', group: 'Midwest' },
  { value: 'Portland', label: 'Portland', group: 'West' },
  { value: 'Las Vegas', label: 'Las Vegas', group: 'West' },
  { value: 'Memphis', label: 'Memphis', group: 'South' },
  { value: 'Louisville', label: 'Louisville', group: 'South' },
  { value: 'Baltimore', label: 'Baltimore', group: 'Northeast' },
  { value: 'Milwaukee', label: 'Milwaukee', group: 'Midwest' },
  { value: 'Albuquerque', label: 'Albuquerque', group: 'West' },
  { value: 'Tucson', label: 'Tucson', group: 'West' },
  { value: 'Fresno', label: 'Fresno', group: 'West' },
  { value: 'Sacramento', label: 'Sacramento', group: 'West' },
  { value: 'Atlanta', label: 'Atlanta', group: 'South' },
  { value: 'Miami', label: 'Miami', group: 'South' },
  { value: 'Raleigh', label: 'Raleigh', group: 'South' },
  { value: 'Minneapolis', label: 'Minneapolis', group: 'Midwest' },
  { value: 'Cleveland', label: 'Cleveland', group: 'Midwest' },
  { value: 'Tampa', label: 'Tampa', group: 'South' },
  { value: 'St. Louis', label: 'St. Louis', group: 'Midwest' },
  { value: 'Pittsburgh', label: 'Pittsburgh', group: 'Northeast' },
  { value: 'Salt Lake City', label: 'Salt Lake City', group: 'West' },
  { value: 'Orlando', label: 'Orlando', group: 'South' },
];

// Industry Options (Apollo Industry Tags)
export const INDUSTRY_OPTIONS: ComboboxOption[] = [
  // Technology
  { value: '5567e2c773696439a10b0000', label: 'Computer Software', group: 'Technology' },
  { value: '5567e2c173696439a1090000', label: 'Information Technology & Services', group: 'Technology' },
  { value: '5567e2c873696439a10c0000', label: 'Internet', group: 'Technology' },
  { value: '5567e2cd73696439a10f0000', label: 'Telecommunications', group: 'Technology' },
  { value: '5567e2c973696439a10d0000', label: 'Computer Hardware', group: 'Technology' },
  { value: '5567e2cf73696439a1110000', label: 'Semiconductors', group: 'Technology' },
  { value: '5567e2d073696439a1120000', label: 'Computer Networking', group: 'Technology' },
  { value: '5567e2d173696439a1130000', label: 'Wireless', group: 'Technology' },
  
  // Finance
  { value: '5567e2bb73696439a1060000', label: 'Financial Services', group: 'Finance' },
  { value: '5567e2bc73696439a1070000', label: 'Banking', group: 'Finance' },
  { value: '5567e2bd73696439a1080000', label: 'Insurance', group: 'Finance' },
  { value: '5567e2be73696439a1090000', label: 'Investment Banking', group: 'Finance' },
  { value: '5567e2bf73696439a10a0000', label: 'Investment Management', group: 'Finance' },
  { value: '5567e2c073696439a10b0000', label: 'Venture Capital & Private Equity', group: 'Finance' },
  { value: '5567e2d273696439a1140000', label: 'Accounting', group: 'Finance' },
  
  // Healthcare
  { value: '5567e2d373696439a1150000', label: 'Hospital & Health Care', group: 'Healthcare' },
  { value: '5567e2d473696439a1160000', label: 'Medical Devices', group: 'Healthcare' },
  { value: '5567e2d573696439a1170000', label: 'Pharmaceuticals', group: 'Healthcare' },
  { value: '5567e2d673696439a1180000', label: 'Biotechnology', group: 'Healthcare' },
  { value: '5567e2d773696439a1190000', label: 'Health, Wellness & Fitness', group: 'Healthcare' },
  { value: '5567e2d873696439a11a0000', label: 'Mental Health Care', group: 'Healthcare' },
  
  // Manufacturing
  { value: '5567e2d973696439a11b0000', label: 'Manufacturing', group: 'Manufacturing' },
  { value: '5567e2da73696439a11c0000', label: 'Automotive', group: 'Manufacturing' },
  { value: '5567e2db73696439a11d0000', label: 'Machinery', group: 'Manufacturing' },
  { value: '5567e2dc73696439a11e0000', label: 'Industrial Automation', group: 'Manufacturing' },
  { value: '5567e2dd73696439a11f0000', label: 'Electrical/Electronic Manufacturing', group: 'Manufacturing' },
  { value: '5567e2de73696439a1200000', label: 'Aviation & Aerospace', group: 'Manufacturing' },
  
  // Retail & Consumer
  { value: '5567e2df73696439a1210000', label: 'Retail', group: 'Retail & Consumer' },
  { value: '5567e2e073696439a1220000', label: 'Consumer Goods', group: 'Retail & Consumer' },
  { value: '5567e2e173696439a1230000', label: 'Consumer Electronics', group: 'Retail & Consumer' },
  { value: '5567e2e273696439a1240000', label: 'Apparel & Fashion', group: 'Retail & Consumer' },
  { value: '5567e2e373696439a1250000', label: 'Food & Beverages', group: 'Retail & Consumer' },
  { value: '5567e2e473696439a1260000', label: 'Luxury Goods & Jewelry', group: 'Retail & Consumer' },
  { value: '5567e2e573696439a1270000', label: 'Sporting Goods', group: 'Retail & Consumer' },
  
  // Business Services
  { value: '5567e2e673696439a1280000', label: 'Management Consulting', group: 'Business Services' },
  { value: '5567e2e773696439a1290000', label: 'Human Resources', group: 'Business Services' },
  { value: '5567e2e873696439a12a0000', label: 'Staffing & Recruiting', group: 'Business Services' },
  { value: '5567e2e973696439a12b0000', label: 'Marketing & Advertising', group: 'Business Services' },
  { value: '5567e2ea73696439a12c0000', label: 'Market Research', group: 'Business Services' },
  { value: '5567e2eb73696439a12d0000', label: 'Public Relations & Communications', group: 'Business Services' },
  { value: '5567e2ec73696439a12e0000', label: 'Events Services', group: 'Business Services' },
  { value: '5567e2ed73696439a12f0000', label: 'Design', group: 'Business Services' },
  
  // Real Estate
  { value: '5567e2ee73696439a1300000', label: 'Real Estate', group: 'Real Estate' },
  { value: '5567e2ef73696439a1310000', label: 'Commercial Real Estate', group: 'Real Estate' },
  { value: '5567e2f073696439a1320000', label: 'Construction', group: 'Real Estate' },
  { value: '5567e2f173696439a1330000', label: 'Architecture & Planning', group: 'Real Estate' },
  
  // Energy
  { value: '5567e2f273696439a1340000', label: 'Oil & Energy', group: 'Energy' },
  { value: '5567e2f373696439a1350000', label: 'Renewables & Environment', group: 'Energy' },
  { value: '5567e2f473696439a1360000', label: 'Utilities', group: 'Energy' },
  { value: '5567e2f573696439a1370000', label: 'Mining & Metals', group: 'Energy' },
  
  // Education
  { value: '5567e2f673696439a1380000', label: 'Higher Education', group: 'Education' },
  { value: '5567e2f773696439a1390000', label: 'Education Management', group: 'Education' },
  { value: '5567e2f873696439a13a0000', label: 'E-Learning', group: 'Education' },
  { value: '5567e2f973696439a13b0000', label: 'Primary/Secondary Education', group: 'Education' },
  
  // Legal & Government
  { value: '5567e2fa73696439a13c0000', label: 'Law Practice', group: 'Legal & Government' },
  { value: '5567e2fb73696439a13d0000', label: 'Legal Services', group: 'Legal & Government' },
  { value: '5567e2fc73696439a13e0000', label: 'Government Administration', group: 'Legal & Government' },
  { value: '5567e2fd73696439a13f0000', label: 'Government Relations', group: 'Legal & Government' },
  
  // Media & Entertainment
  { value: '5567e2fe73696439a1400000', label: 'Media Production', group: 'Media & Entertainment' },
  { value: '5567e2ff73696439a1410000', label: 'Broadcast Media', group: 'Media & Entertainment' },
  { value: '5567e30073696439a1420000', label: 'Entertainment', group: 'Media & Entertainment' },
  { value: '5567e30173696439a1430000', label: 'Music', group: 'Media & Entertainment' },
  { value: '5567e30273696439a1440000', label: 'Online Media', group: 'Media & Entertainment' },
  { value: '5567e30373696439a1450000', label: 'Publishing', group: 'Media & Entertainment' },
  { value: '5567e30473696439a1460000', label: 'Newspapers', group: 'Media & Entertainment' },
  
  // Transportation & Logistics
  { value: '5567e30573696439a1470000', label: 'Logistics & Supply Chain', group: 'Transportation' },
  { value: '5567e30673696439a1480000', label: 'Transportation/Trucking/Railroad', group: 'Transportation' },
  { value: '5567e30773696439a1490000', label: 'Airlines/Aviation', group: 'Transportation' },
  { value: '5567e30873696439a14a0000', label: 'Maritime', group: 'Transportation' },
  { value: '5567e30973696439a14b0000', label: 'Warehousing', group: 'Transportation' },
  
  // Hospitality
  { value: '5567e30a73696439a14c0000', label: 'Hospitality', group: 'Hospitality' },
  { value: '5567e30b73696439a14d0000', label: 'Restaurants', group: 'Hospitality' },
  { value: '5567e30c73696439a14e0000', label: 'Leisure, Travel & Tourism', group: 'Hospitality' },
  { value: '5567e30d73696439a14f0000', label: 'Hotels', group: 'Hospitality' },
  
  // Non-Profit
  { value: '5567e30e73696439a1500000', label: 'Non-Profit Organization Management', group: 'Non-Profit' },
  { value: '5567e30f73696439a1510000', label: 'Philanthropy', group: 'Non-Profit' },
  { value: '5567e31073696439a1520000', label: 'Civic & Social Organization', group: 'Non-Profit' },
];

// Revenue Range Options
export const REVENUE_OPTIONS: ComboboxOption[] = [
  { value: '0,1000000', label: 'Under $1M' },
  { value: '1000000,10000000', label: '$1M - $10M' },
  { value: '10000000,50000000', label: '$10M - $50M' },
  { value: '50000000,100000000', label: '$50M - $100M' },
  { value: '100000000,500000000', label: '$100M - $500M' },
  { value: '500000000,1000000000', label: '$500M - $1B' },
  { value: '1000000000,', label: '$1B+' },
];

// Founding Year Options
export const FOUNDING_YEAR_OPTIONS: ComboboxOption[] = [
  { value: '2020,', label: '2020 or later' },
  { value: '2015,2019', label: '2015-2019' },
  { value: '2010,2014', label: '2010-2014' },
  { value: '2005,2009', label: '2005-2009' },
  { value: '2000,2004', label: '2000-2004' },
  { value: '1990,1999', label: '1990-1999' },
  { value: '1980,1989', label: '1980-1989' },
  { value: ',1979', label: 'Before 1980' },
];

// Technology Stack Options
export const TECHNOLOGY_OPTIONS: ComboboxOption[] = [
  // CRM
  { value: 'salesforce', label: 'Salesforce', group: 'CRM' },
  { value: 'hubspot', label: 'HubSpot', group: 'CRM' },
  { value: 'zoho_crm', label: 'Zoho CRM', group: 'CRM' },
  { value: 'pipedrive', label: 'Pipedrive', group: 'CRM' },
  { value: 'microsoft_dynamics', label: 'Microsoft Dynamics', group: 'CRM' },

  // Marketing Automation
  { value: 'marketo', label: 'Marketo', group: 'Marketing' },
  { value: 'pardot', label: 'Pardot', group: 'Marketing' },
  { value: 'mailchimp', label: 'Mailchimp', group: 'Marketing' },
  { value: 'constant_contact', label: 'Constant Contact', group: 'Marketing' },
  { value: 'activecampaign', label: 'ActiveCampaign', group: 'Marketing' },

  // Analytics
  { value: 'google_analytics', label: 'Google Analytics', group: 'Analytics' },
  { value: 'mixpanel', label: 'Mixpanel', group: 'Analytics' },
  { value: 'amplitude', label: 'Amplitude', group: 'Analytics' },
  { value: 'heap', label: 'Heap', group: 'Analytics' },
  { value: 'segment', label: 'Segment', group: 'Analytics' },

  // Cloud
  { value: 'aws', label: 'Amazon Web Services (AWS)', group: 'Cloud' },
  { value: 'azure', label: 'Microsoft Azure', group: 'Cloud' },
  { value: 'google_cloud', label: 'Google Cloud Platform', group: 'Cloud' },
  { value: 'heroku', label: 'Heroku', group: 'Cloud' },
  { value: 'digitalocean', label: 'DigitalOcean', group: 'Cloud' },

  // E-commerce
  { value: 'shopify', label: 'Shopify', group: 'E-commerce' },
  { value: 'magento', label: 'Magento', group: 'E-commerce' },
  { value: 'woocommerce', label: 'WooCommerce', group: 'E-commerce' },
  { value: 'bigcommerce', label: 'BigCommerce', group: 'E-commerce' },

  // Collaboration
  { value: 'slack', label: 'Slack', group: 'Collaboration' },
  { value: 'microsoft_teams', label: 'Microsoft Teams', group: 'Collaboration' },
  { value: 'zoom', label: 'Zoom', group: 'Collaboration' },
  { value: 'google_workspace', label: 'Google Workspace', group: 'Collaboration' },
  { value: 'microsoft_365', label: 'Microsoft 365', group: 'Collaboration' },

  // Development
  { value: 'github', label: 'GitHub', group: 'Development' },
  { value: 'gitlab', label: 'GitLab', group: 'Development' },
  { value: 'jira', label: 'Jira', group: 'Development' },
  { value: 'confluence', label: 'Confluence', group: 'Development' },
  { value: 'jenkins', label: 'Jenkins', group: 'Development' },

  // HR
  { value: 'workday', label: 'Workday', group: 'HR' },
  { value: 'bamboohr', label: 'BambooHR', group: 'HR' },
  { value: 'adp', label: 'ADP', group: 'HR' },
  { value: 'gusto', label: 'Gusto', group: 'HR' },
  { value: 'namely', label: 'Namely', group: 'HR' },
];

// Email Status Options
export const EMAIL_STATUS_OPTIONS: ComboboxOption[] = [
  { value: 'verified', label: 'Verified' },
  { value: 'guessed', label: 'Guessed' },
  { value: 'unavailable', label: 'Unavailable' },
];

// Company Type Options
export const COMPANY_TYPE_OPTIONS: ComboboxOption[] = [
  { value: 'public_company', label: 'Public Company' },
  { value: 'privately_held', label: 'Privately Held' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'self_employed', label: 'Self Employed' },
  { value: 'government_agency', label: 'Government Agency' },
  { value: 'non_profit', label: 'Non-Profit' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'educational_institution', label: 'Educational Institution' },
];

// Keywords / Buzzwords
export const KEYWORD_OPTIONS: ComboboxOption[] = [
  { value: 'artificial intelligence', label: 'Artificial Intelligence' },
  { value: 'machine learning', label: 'Machine Learning' },
  { value: 'saas', label: 'SaaS' },
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'startup', label: 'Startup' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'healthtech', label: 'Healthtech' },
  { value: 'edtech', label: 'Edtech' },
  { value: 'proptech', label: 'Proptech' },
  { value: 'martech', label: 'Martech' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'blockchain', label: 'Blockchain' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'cloud computing', label: 'Cloud Computing' },
  { value: 'data analytics', label: 'Data Analytics' },
  { value: 'iot', label: 'IoT' },
  { value: 'automation', label: 'Automation' },
  { value: 'digital transformation', label: 'Digital Transformation' },
];

// Job Title Suggestions
export const JOB_TITLE_SUGGESTIONS: ComboboxOption[] = [
  // C-Suite
  { value: 'CEO', label: 'CEO', group: 'C-Suite' },
  { value: 'CTO', label: 'CTO', group: 'C-Suite' },
  { value: 'CFO', label: 'CFO', group: 'C-Suite' },
  { value: 'COO', label: 'COO', group: 'C-Suite' },
  { value: 'CMO', label: 'CMO', group: 'C-Suite' },
  { value: 'CIO', label: 'CIO', group: 'C-Suite' },
  { value: 'CISO', label: 'CISO', group: 'C-Suite' },
  { value: 'CRO', label: 'CRO', group: 'C-Suite' },
  { value: 'CPO', label: 'CPO', group: 'C-Suite' },

  // VP Level
  { value: 'VP of Sales', label: 'VP of Sales', group: 'VP' },
  { value: 'VP of Marketing', label: 'VP of Marketing', group: 'VP' },
  { value: 'VP of Engineering', label: 'VP of Engineering', group: 'VP' },
  { value: 'VP of Product', label: 'VP of Product', group: 'VP' },
  { value: 'VP of Operations', label: 'VP of Operations', group: 'VP' },
  { value: 'VP of Finance', label: 'VP of Finance', group: 'VP' },
  { value: 'VP of HR', label: 'VP of HR', group: 'VP' },

  // Director Level
  { value: 'Sales Director', label: 'Sales Director', group: 'Director' },
  { value: 'Marketing Director', label: 'Marketing Director', group: 'Director' },
  { value: 'Engineering Director', label: 'Engineering Director', group: 'Director' },
  { value: 'Product Director', label: 'Product Director', group: 'Director' },
  { value: 'IT Director', label: 'IT Director', group: 'Director' },
  { value: 'HR Director', label: 'HR Director', group: 'Director' },
  { value: 'Finance Director', label: 'Finance Director', group: 'Director' },

  // Manager Level
  { value: 'Sales Manager', label: 'Sales Manager', group: 'Manager' },
  { value: 'Marketing Manager', label: 'Marketing Manager', group: 'Manager' },
  { value: 'Product Manager', label: 'Product Manager', group: 'Manager' },
  { value: 'Project Manager', label: 'Project Manager', group: 'Manager' },
  { value: 'Account Manager', label: 'Account Manager', group: 'Manager' },
  { value: 'Operations Manager', label: 'Operations Manager', group: 'Manager' },
  { value: 'HR Manager', label: 'HR Manager', group: 'Manager' },

  // Other
  { value: 'Founder', label: 'Founder', group: 'Other' },
  { value: 'Co-Founder', label: 'Co-Founder', group: 'Other' },
  { value: 'Owner', label: 'Owner', group: 'Other' },
  { value: 'Partner', label: 'Partner', group: 'Other' },
  { value: 'Head of Sales', label: 'Head of Sales', group: 'Other' },
  { value: 'Head of Marketing', label: 'Head of Marketing', group: 'Other' },
  { value: 'Head of Engineering', label: 'Head of Engineering', group: 'Other' },
  { value: 'Head of Product', label: 'Head of Product', group: 'Other' },
];

// Funding Rounds
export const FUNDING_OPTIONS: ComboboxOption[] = [
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'series_d', label: 'Series D+' },
  { value: 'ipo', label: 'IPO' },
  { value: 'acquired', label: 'Acquired' },
  { value: 'private_equity', label: 'Private Equity' },
];
