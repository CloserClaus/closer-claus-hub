

# Replace Signal Scraper Templates with Marketing Agency Signal Templates

## Current State
The `signal_templates` table has 3 templates focused on general sales/SDR hiring. Need to replace them with templates that track signals useful specifically for **marketing agencies** looking for clients.

## Plan

### Database Migration: Replace all 3 existing templates

Delete existing templates and insert new ones tailored to marketing agency prospecting signals:

1. **"Businesses Hiring for Marketing Roles"** — Companies posting marketing manager/coordinator/CMO jobs signal they're investing in growth but may need agency help. (`hiring_intent`, icon: `Briefcase`)

2. **"New Businesses Without Websites"** — Recently registered businesses or startups that lack a web presence — prime prospects for web design, SEO, and branding services. (`discovery`, icon: `Search`)

3. **"Local Businesses with Poor Google Reviews"** — Businesses with low review counts or poor ratings need reputation management, local SEO, and digital marketing help. (`discovery`, icon: `MapPin`)

4. **"Companies Running Job Ads but No Social Media"** — Businesses actively hiring (growth signal) but with minimal social media presence — need social media marketing, content, and brand awareness services. (`discovery`, icon: `Zap`)

5. **"E-commerce Stores with Low Traffic"** — Online stores that are underperforming in search/traffic — signals need for SEO, PPC, email marketing, or conversion optimization. (`discovery`, icon: `Rocket`)

6. **"Businesses Recently Funded"** — Startups/companies that recently raised funding often allocate budget to marketing — ideal time to pitch agency services. (`discovery`, icon: `Sparkles`)

### Single SQL migration
- `DELETE` all existing rows from `signal_templates`
- `INSERT` 6 new marketing-agency-focused templates with appropriate `query_template`, `description`, `category`, `icon`, and `sort_order`

### No frontend changes needed
The component already renders templates dynamically from the database.

