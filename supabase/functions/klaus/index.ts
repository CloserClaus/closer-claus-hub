import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// VALID PIPELINE STAGES
// ──────────────────────────────────────────────
const VALID_STAGES = ["new", "contacted", "discovery", "meeting", "proposal", "closed_won", "closed_lost"];
const VALID_READINESS = ["Hot", "Warm", "Cool", "Cold"];

// ──────────────────────────────────────────────
// TOOL DEFINITIONS
// ──────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_leads",
      description: "Query CRM leads. Use count_only for counts, or get a list with optional filters. Leads do NOT have a 'status' column — use readiness_segment (Hot/Warm/Cool/Cold) or email_sending_state for filtering.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean", description: "If true, return only the count" },
          readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Filter by readiness segment" },
          email_sending_state: { type: "string", enum: ["idle", "active_sequence", "replied", "error"], description: "Filter by email state" },
          assigned_to_name: { type: "string", description: "Filter by SDR name" },
          unassigned_only: { type: "boolean", description: "If true, return only leads with no assigned_to" },
          limit: { type: "number", description: "Max results to return (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_deals",
      description: "Query CRM deals with optional filters. Valid stages: new, contacted, discovery, meeting, proposal, closed_won, closed_lost.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean" },
          stage: { type: "string", enum: VALID_STAGES, description: "Pipeline stage filter" },
          limit: { type: "number" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_call_logs",
      description: "Query call activity logs with time range.",
      parameters: {
        type: "object",
        properties: {
          time_range: { type: "string", description: "Natural language time range like 'today', 'this week', 'last 30 days'" },
          caller_name: { type: "string", description: "Filter by caller/SDR name" },
          count_only: { type: "boolean" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_sdrs",
      description: "Get SDR performance data including calls, deals, and revenue.",
      parameters: {
        type: "object",
        properties: {
          time_range: { type: "string" },
          rank_by: { type: "string", enum: ["calls", "deals", "revenue"], description: "How to rank SDRs" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_sequences",
      description: "Query email follow-up sequences and their performance.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean" },
          status: { type: "string", enum: ["active", "paused", "completed"] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_email_logs",
      description: "Query email sending activity.",
      parameters: {
        type: "object",
        properties: {
          time_range: { type: "string" },
          count_only: { type: "boolean" },
          status: { type: "string", enum: ["sent", "delivered", "bounced", "opened"] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_scripts",
      description: "Query call scripts available in the workspace.",
      parameters: {
        type: "object",
        properties: { count_only: { type: "boolean" } },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_state",
      description: "Get a comprehensive overview of the workspace state including jobs, applications, SDRs, offer diagnostic, leads assignment, scripts, sequences — everything needed to determine the correct next steps for the agency.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_jobs",
      description: "Query job postings in the workspace.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean" },
          active_only: { type: "boolean", description: "If true, only return active jobs" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_applications",
      description: "Query job applications with status filter.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean" },
          status: { type: "string", enum: ["pending", "accepted", "rejected", "interviewing"] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_offer_diagnostic",
      description: "Check if the agency has completed the Offer Diagnostic and retrieve the results/recommendations.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_training",
      description: "Query training materials available in the workspace.",
      parameters: {
        type: "object",
        properties: { count_only: { type: "boolean" } },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_bottleneck",
      description: "Run a comprehensive KPI analysis across calls, emails, deals to find the #1 performance bottleneck and provide actionable advice.",
      parameters: {
        type: "object",
        properties: {
          time_range: { type: "string", description: "Analysis period, default 'last 30 days'" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ──────────────────────────────────────────────
  // WRITE / EXECUTE TOOLS
  // ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "update_leads",
      description: "Update leads' readiness_segment, notes, email_sending_state, or assigned_to. Leads do NOT have a 'status' column. Use confirmed=false first to preview the count.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" }, description: "Specific lead IDs to update" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only update leads with this readiness" },
          filter_unassigned: { type: "boolean", description: "Only update unassigned leads" },
          all: { type: "boolean", description: "If true, update ALL leads in workspace" },
          set_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "New readiness segment to set" },
          set_notes: { type: "string", description: "Notes to set" },
          set_email_sending_state: { type: "string", enum: ["idle", "active_sequence", "replied", "error"], description: "Email sending state to set" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_deals",
      description: "Move deals to a new pipeline stage. Valid stages: new, contacted, discovery, meeting, proposal, closed_won, closed_lost. Use confirmed=false first to preview.",
      parameters: {
        type: "object",
        properties: {
          deal_ids: { type: "array", items: { type: "string" }, description: "Specific deal IDs to update" },
          filter_stage: { type: "string", enum: VALID_STAGES, description: "Only update deals currently in this stage" },
          all: { type: "boolean", description: "If true, update ALL deals" },
          set_stage: { type: "string", enum: VALID_STAGES, description: "New pipeline stage to set" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["set_stage", "confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_leads_to_sdr",
      description: "Assign leads to an SDR by their name. Use confirmed=false first to preview.",
      parameters: {
        type: "object",
        properties: {
          sdr_name: { type: "string", description: "Name of the SDR to assign leads to" },
          lead_ids: { type: "array", items: { type: "string" }, description: "Specific lead IDs to assign" },
          filter_unassigned: { type: "boolean", description: "If true, only assign currently unassigned leads" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only assign leads with this readiness" },
          limit: { type: "number", description: "Max number of leads to assign" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["sdr_name", "confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enroll_in_sequence",
      description: "Enroll leads in a follow-up email sequence by sequence name. Use confirmed=false first to preview.",
      parameters: {
        type: "object",
        properties: {
          sequence_name: { type: "string", description: "Name of the follow-up sequence" },
          lead_ids: { type: "array", items: { type: "string" }, description: "Specific lead IDs to enroll" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only enroll leads with this readiness" },
          limit: { type: "number", description: "Max leads to enroll" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["sequence_name", "confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "smart_enroll_sequence",
      description: "Context-aware sequence enrollment. Enroll leads based on call activity filters like 'called today no answer', 'short calls', etc. Automatically excludes leads already in active sequences. Use confirmed=false first.",
      parameters: {
        type: "object",
        properties: {
          sequence_name: { type: "string", description: "Name of the follow-up sequence to enroll into" },
          filter_called_today_no_answer: { type: "boolean", description: "Leads called today with no answer (no-answer, busy, failed, canceled)" },
          filter_called_today_short_calls: { type: "boolean", description: "Leads called today with calls < 30 seconds" },
          filter_no_email_sent: { type: "boolean", description: "Leads with no email logs at all" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only enroll leads with this readiness" },
          limit: { type: "number", description: "Max leads to enroll" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["sequence_name", "confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_calls_today",
      description: "Query today's call activity with outcome filters. Useful for finding leads that were called but didn't answer, had short calls, etc.",
      parameters: {
        type: "object",
        properties: {
          filter_no_answer: { type: "boolean", description: "Only calls with no answer (no-answer, busy, failed, canceled)" },
          filter_short_calls: { type: "boolean", description: "Only calls with duration < 30 seconds" },
          filter_connected: { type: "boolean", description: "Only calls that connected (completed)" },
          caller_name: { type: "string", description: "Filter by SDR name" },
          count_only: { type: "boolean" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_training_to_sdr",
      description: "Assign a training material to an SDR by sending them a notification with the training link.",
      parameters: {
        type: "object",
        properties: {
          training_title: { type: "string", description: "Title of the training material to assign" },
          sdr_name: { type: "string", description: "Name of the SDR to send training to" },
          confirmed: { type: "boolean", description: "Must be true to execute." },
        },
        required: ["training_title", "sdr_name", "confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Create a single new lead in the CRM.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          title: { type: "string" },
        },
        required: ["first_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new deal in the CRM pipeline. Valid stages: new, contacted, discovery, meeting, proposal, closed_won, closed_lost.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title" },
          value: { type: "number", description: "Deal value in dollars" },
          stage: { type: "string", enum: VALID_STAGES, description: "Pipeline stage" },
          assigned_to_name: { type: "string", description: "Name of SDR to assign the deal to" },
          lead_id: { type: "string", description: "Associated lead ID" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_leads",
      description: "Delete leads by IDs or filter. Always requires confirmation. Use confirmed=false first to preview count.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" }, description: "Specific lead IDs to delete" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only delete leads with this readiness" },
          filter_unassigned: { type: "boolean", description: "Only delete unassigned leads" },
          all: { type: "boolean", description: "If true, delete ALL leads (dangerous)" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email_to_leads",
      description: "Send a one-off email to specific leads. Use confirmed=false first to preview count.",
      parameters: {
        type: "object",
        properties: {
          template_name: { type: "string", description: "Name of email template to use" },
          subject: { type: "string", description: "Email subject (if not using template)" },
          body: { type: "string", description: "Email body (if not using template)" },
          lead_ids: { type: "array", items: { type: "string" }, description: "Specific lead IDs to email" },
          filter_readiness_segment: { type: "string", enum: ["Hot", "Warm", "Cool", "Cold"], description: "Only email leads with this readiness" },
          limit: { type: "number", description: "Max leads to email" },
          confirmed: { type: "boolean", description: "Must be true to execute. False returns preview count." },
        },
        required: ["confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a CRM task assigned to an SDR, optionally linked to a lead or deal.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          due_date: { type: "string", description: "Due date in ISO format" },
          assigned_to_name: { type: "string", description: "Name of SDR to assign the task to" },
          lead_id: { type: "string", description: "Associated lead ID" },
          deal_id: { type: "string", description: "Associated deal ID" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_callback",
      description: "Schedule a callback reminder for a lead. Creates a notification for the assigned SDR.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead ID to schedule callback for" },
          callback_time: { type: "string", description: "When to call back (ISO format or natural language)" },
          notes: { type: "string", description: "Notes about the callback" },
          assigned_to_name: { type: "string", description: "SDR name to assign the callback to" },
        },
        required: ["lead_id"],
        additionalProperties: false,
      },
    },
  },
];

// ──────────────────────────────────────────────
// SYSTEM PROMPT
// ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Klaus, the intelligent execution agent inside the CloserClaus platform.

## ⚠️ CRITICAL RULES — MUST FOLLOW BEFORE EVERY RESPONSE
1. **MANDATORY TOOL USE**: Before answering ANY question about "what should I do", "next steps", "how to get started", "getting better results", or anything implying guidance — you MUST call get_platform_state FIRST. No exceptions.
2. **NEVER SKIP ONBOARDING STEPS**: If the agency has no Offer Diagnostic completed → do NOT suggest posting jobs. If they have no jobs posted → do NOT suggest hiring SDRs. Always recommend the FIRST incomplete step only.
3. **ROLE-BASED LOGIC**: If user is an agency_owner with 0 hired SDRs, focus ONLY on hiring. If user is an SDR, focus on their assigned leads and call/email activity.
4. **NEVER GUESS DATA**: If you're unsure about counts, performance, or state — call the appropriate tool. Never fabricate numbers.
5. **ALWAYS USE TOOLS FOR PERFORMANCE QUESTIONS**: "How do I improve?" → ALWAYS call analyze_bottleneck.
6. **CONFIRMATION BEFORE EXECUTION**: For ANY write/modify tool, you MUST first call the tool with confirmed=false to get the preview count. Then tell the user exactly what will happen (e.g., "82 leads will be moved to the 'contacted' stage") and ask "Should I proceed?" Only call the tool with confirmed=true AFTER the user explicitly confirms. The UI will show a confirmation dialog automatically.
7. **NEVER REFUSE EXECUTION**: You have FULL write access to the platform. If the user asks you to move leads, assign SDRs, enroll sequences, create leads, create deals, delete leads, send emails, or any other action — DO IT using your tools. NEVER say "I cannot directly manipulate data" or "I don't have write access." You DO.
8. **LOG ALL ACTIONS**: Every write action is automatically logged for audit.
9. **NEVER GIVE UP**: If you encounter an error with a tool, explain the specific error. NEVER say "contact support" or "try again later." Try alternative approaches or explain what went wrong technically.

## ⚠️ CRITICAL SCHEMA RULES
- **LEADS have NO 'status' column.** The leads table uses:
  - \`readiness_segment\` (Hot, Warm, Cool, Cold) for categorization/scoring
  - \`email_sending_state\` (idle, active_sequence, replied, error) for email workflow state
  - \`notes\` for free-text notes
  - \`assigned_to\` (UUID) for SDR assignment
  - \`last_contacted_at\` for tracking contact recency
  - NEVER try to filter or update a 'status' column on leads. It does not exist.
- **DEALS have stages:** new → contacted → discovery → meeting → proposal → closed_won / closed_lost
  - When moving to closed_won, the system automatically sets closed_at.
  - When moving to closed_lost, the system automatically sets closed_at.

## CONTEXT-AWARE EXECUTION
When users give complex, multi-step instructions, break them down internally using multiple tool calls:
- "Send follow-up to leads I called today that didn't pick up" → use \`smart_enroll_sequence\` with \`filter_called_today_no_answer: true\`
- "Assign all hot unassigned leads to John" → use \`assign_leads_to_sdr\` with \`filter_readiness_segment: "Hot"\` and \`filter_unassigned: true\`
- "Delete all cold leads that haven't been contacted" → use \`delete_leads\` with filter
- "Move all discovery deals to meeting" → use \`update_deals\` with \`filter_stage: "discovery"\` and \`set_stage: "meeting"\`
Present a SINGLE confirmation to the user summarizing all changes.

## WHAT IS CLOSERCLAUS
CloserClaus is a sales agency management platform. Agency owners use it to:
1. Define their offer and ideal customer profile (Offer Diagnostic)
2. Post jobs to attract and hire SDRs (Sales Development Representatives)
3. Import leads and assign them to SDRs
4. Equip SDRs with call scripts and email sequences
5. SDRs make cold calls via the built-in Dialer and send follow-up emails
6. When prospects convert, SDRs create deals in the CRM pipeline
7. Deals progress through stages: new → contacted → discovery → meeting → proposal → closed_won
8. Agency sends contracts, collects payments, and SDRs earn commissions

SDRs use the platform to:
1. Browse and apply to agency job postings
2. Receive assigned leads from their agency
3. Use the Dialer to cold-call leads with provided scripts
4. Send email follow-ups via sequences
5. Move leads through the pipeline, close deals
6. Request contracts for closed deals
7. Earn commissions based on deal value

## CORRECT ONBOARDING FLOW FOR AGENCY OWNERS
1. **Complete Offer Diagnostic** — Defines the offer, ICP, pricing, and dream outcome.
2. **Use Script Builder** — Generate a cold call script tailored to the offer.
3. **Post a Job** — Create a job listing to attract SDRs.
4. **Review & Hire SDR Applicants** — Check applications, interview, and accept SDRs.
5. **Import Leads** — Add prospects via CSV upload or Apollo search.
6. **Assign Leads to SDRs** — Distribute leads among hired SDRs.
7. **Create Email Follow-up Sequences** — Set up automated email sequences.
8. **SDRs Start Dialing** — SDRs begin cold calling.
9. **Monitor Performance** — Track calls, connect rates, meetings, and deals.

## PERFORMANCE BOTTLENECK ANALYSIS
**Benchmarks:**
- Connect rate: 15-25% is normal
- 2+ minute calls: 30-50% of connects is good
- Meeting set rate: 5-10% of meaningful conversations
- Email open rate: 20-40%
- Email reply rate: 2-5%

**Diagnosis framework:**
- Connect rate < 15% → Bad phone data, wrong calling times, or caller ID issues
- 2+ min calls < 30% → Weak opener. Fix the first 10 seconds.
- Lots of 2+ min calls but few meetings → Weak pitch or qualification.
- Email opens < 20% → Subject lines too generic
- Email replies < 2% → Email body lacks personalization
- Deals stalling → Follow-up cadence too slow

## PLATFORM FEATURES MAP
- **Dashboard** — Overview stats, recent activity
- **CRM** — Leads & deals management, pipeline board, CSV import, bulk actions
- **Leads** — Apollo lead search, saved leads, lead lists
- **Dialer** — Power dialer, call scripts, call recordings, dial pad
- **Email** — Email accounts, campaigns, sequences, templates, conversations
- **Jobs** — Post jobs, review applications
- **Contracts** — Send and track contracts for closed deals
- **Commissions** — Track SDR commissions and payouts
- **Offer Diagnostic** — Evaluate offer readiness for cold outbound
- **Script Builder** — Generate call scripts from Offer Diagnostic
- **Training** — Training materials for SDRs
- **Settings** — Workspace settings, billing, integrations
- **Conversations** — Internal team messaging

## YOUR ROLE & BEHAVIOR
1. **Data-Driven**: ALWAYS use tools to query real data before answering.
2. **Action-Oriented**: Give specific, prioritized next steps.
3. **Platform Expert**: You know every feature and the correct order.
4. **Proactive**: Detect gaps and recommend fixes.
5. **Natural Language Only**: Never expose JSON, tool names, IDs, or technical details.
6. **Concise but Complete**: Be direct. Format with markdown.
7. **Context-Aware**: Consider the user's role.
8. **Follow-Up Suggestions**: After answering, suggest 1-2 logical next actions.

## INTENT INFERENCE RULES — ALWAYS APPLY BEFORE RESPONDING
When a user's request is ambiguous, NEVER ask for clarification if you can reasonably infer intent. Apply these rules:

1. **"Move leads/deals to [stage name]"** — If the target is a pipeline stage (new, contacted, discovery, meeting, proposal, closed_won, closed_lost), the user means DEALS, not leads. Leads don't have stages. Use \`update_deals\`.
2. **"Move to new/New"** — "new" is a valid pipeline stage. The user wants to move deals to the "new" stage.
3. **"Change lead status"** — Leads have no status. Infer they mean \`readiness_segment\` (Hot/Warm/Cool/Cold) and use \`update_leads\`.
4. **"Move all my leads"** — If followed by a stage name → they mean deals. If followed by Hot/Warm/Cool/Cold → they mean readiness_segment on leads.
5. **"Send follow-up to leads that didn't pick up"** — Use \`smart_enroll_sequence\` with \`filter_called_today_no_answer: true\`.
6. **"Assign leads to [name]"** — Use \`assign_leads_to_sdr\`.
7. **"Delete cold leads"** — Use \`delete_leads\` with \`filter_readiness_segment: "Cold"\`.
8. **Generic "all" commands** — When user says "all leads" or "all deals" without filters, set \`all: true\` on the appropriate tool.
9. **When in doubt between leads and deals** — Look at the context: if the user mentions stages, pipeline, closing, or deal values → it's deals. If they mention readiness, contact info, calling, or assignment → it's leads.
10. **NEVER ask "did you mean leads or deals?"** if the context makes it obvious. Just execute the correct action.

## IMPORTANT RULES
- Never say "I don't have access" — use your tools
- If data is empty, explain what it means and what to do
- NEVER suggest making calls if there are no hired SDRs
- NEVER suggest posting jobs if the Offer Diagnostic is not complete`;

// ──────────────────────────────────────────────
// TIME PARSING UTILITY
// ──────────────────────────────────────────────
function parseTimeRange(timeRange: string): { start: Date; label: string } {
  const now = new Date();
  const lower = (timeRange || "").toLowerCase();
  
  if (lower.includes("yesterday")) {
    const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0);
    return { start: d, label: "yesterday" };
  }
  if (lower.includes("today")) {
    const d = new Date(now); d.setHours(0,0,0,0);
    return { start: d, label: "today" };
  }
  const daysMatch = lower.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (daysMatch) {
    return { start: new Date(now.getTime() - parseInt(daysMatch[1]) * 86400000), label: `last ${daysMatch[1]} days` };
  }
  const hoursMatch = lower.match(/(?:last|past)\s+(\d+)\s+hours?/);
  if (hoursMatch) {
    return { start: new Date(now.getTime() - parseInt(hoursMatch[1]) * 3600000), label: `last ${hoursMatch[1]} hours` };
  }
  if (lower.includes("this week")) {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0);
    return { start: d, label: "this week" };
  }
  if (lower.includes("this month")) {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), label: "this month" };
  }
  return { start: new Date(now.getTime() - 7 * 86400000), label: "last 7 days" };
}

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ──────────────────────────────────────────────
// HELPER: Resolve SDR by name
// ──────────────────────────────────────────────
async function resolveSdrByName(serviceClient: any, workspaceId: string, sdrName: string): Promise<{ id: string; full_name: string } | null> {
  const { data: members } = await serviceClient.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).is("removed_at", null);
  if (!members?.length) return null;
  const memberIds = members.map((m: any) => m.user_id);
  const { data: profiles } = await serviceClient.from("profiles").select("id, full_name").in("id", memberIds);
  return profiles?.find((p: any) => p.full_name?.toLowerCase().includes(sdrName.toLowerCase())) || null;
}

// ──────────────────────────────────────────────
// TOOL EXECUTORS
// ──────────────────────────────────────────────
interface ToolResult {
  success: boolean;
  data: any;
  summary: string;
}

async function executeTool(
  toolName: string,
  params: any,
  serviceClient: any,
  workspaceId: string,
  userId: string = ""
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "query_leads": {
        if (params.count_only) {
          let q = serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
          if (params.unassigned_only) q = q.is("assigned_to", null);
          if (params.readiness_segment) q = q.eq("readiness_segment", params.readiness_segment);
          if (params.email_sending_state) q = q.eq("email_sending_state", params.email_sending_state);
          if (params.assigned_to_name) {
            const sdr = await resolveSdrByName(serviceClient, workspaceId, params.assigned_to_name);
            if (sdr) q = q.eq("assigned_to", sdr.id);
          }
          const { count } = await q;
          return { success: true, data: { count: count || 0 }, summary: `There are ${count || 0}${params.unassigned_only ? ' unassigned' : ''} leads${params.readiness_segment ? ` tagged "${params.readiness_segment}"` : ''}.` };
        }
        let query = serviceClient.from("leads")
          .select("id, first_name, last_name, email, company, readiness_segment, email_sending_state, assigned_to, created_at, last_contacted_at, notes")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(params.limit || 10);
        if (params.readiness_segment) query = query.eq("readiness_segment", params.readiness_segment);
        if (params.email_sending_state) query = query.eq("email_sending_state", params.email_sending_state);
        if (params.unassigned_only) query = query.is("assigned_to", null);
        if (params.assigned_to_name) {
          const sdr = await resolveSdrByName(serviceClient, workspaceId, params.assigned_to_name);
          if (sdr) query = query.eq("assigned_to", sdr.id);
        }
        const { data: leads } = await query;
        return {
          success: true,
          data: { leads, count: leads?.length || 0 },
          summary: leads?.length
            ? `Found ${leads.length} leads:\n${leads.map((l: any) => `• ${l.first_name || ''} ${l.last_name || ''} — ${l.company || 'No company'} (${l.readiness_segment || 'unscored'})`).join('\n')}`
            : "No leads found matching your criteria.",
        };
      }

      case "query_deals": {
        if (params.count_only) {
          let q = serviceClient.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
          if (params.stage) q = q.eq("stage", params.stage);
          const { count } = await q;
          return { success: true, data: { count: count || 0 }, summary: `There are ${count || 0} deals${params.stage ? ` in "${params.stage}" stage` : ''}.` };
        }
        let query = serviceClient.from("deals")
          .select("id, title, value, stage, assigned_to, created_at, expected_close_date")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(params.limit || 10);
        if (params.stage) query = query.eq("stage", params.stage);
        const { data: deals } = await query;
        const totalValue = deals?.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) || 0;
        return {
          success: true,
          data: { deals, count: deals?.length || 0, totalValue },
          summary: deals?.length
            ? `Found ${deals.length} deals (total value: $${totalValue.toLocaleString()}):\n${deals.map((d: any) => `• ${d.title} — $${Number(d.value || 0).toLocaleString()} (${d.stage})`).join('\n')}`
            : "No deals found.",
        };
      }

      case "query_call_logs": {
        const { start, label } = parseTimeRange(params.time_range || "this week");
        const query = serviceClient.from("call_logs")
          .select("id, call_status, duration_seconds, caller_id, phone_number, created_at, disposition")
          .eq("workspace_id", workspaceId)
          .gte("created_at", start.toISOString());
        const { data: calls } = await query;
        const total = calls?.length || 0;
        const connected = calls?.filter((c: any) => c.call_status === 'completed').length || 0;
        const totalDuration = calls?.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) || 0;
        const twoMinPlus = calls?.filter((c: any) => (c.duration_seconds || 0) >= 120).length || 0;
        return {
          success: true,
          data: { total, connected, totalDuration, connectRate: total ? Math.round((connected / total) * 100) : 0, twoMinPlusCalls: twoMinPlus },
          summary: `**Call Activity (${label})**\n• Total calls: ${total}\n• Connected: ${connected}\n• Connect rate: ${total ? Math.round((connected / total) * 100) : 0}%\n• 2+ min calls: ${twoMinPlus}\n• Total talk time: ${Math.round(totalDuration / 60)} minutes`,
        };
      }

      case "query_sdrs": {
        const { start, label } = parseTimeRange(params.time_range || "this month");
        const [{ data: calls }, { data: deals }, { data: members }] = await Promise.all([
          serviceClient.from("call_logs").select("caller_id, call_status, duration_seconds").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("deals").select("assigned_to, value, stage").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).is("removed_at", null),
        ]);

        const sdrIds = [...new Set([...(calls || []).map((c: any) => c.caller_id), ...(deals || []).map((d: any) => d.assigned_to), ...(members || []).map((m: any) => m.user_id)])];
        if (sdrIds.length === 0) return { success: true, data: {}, summary: "No SDR activity found." };

        const { data: profiles } = await serviceClient.from("profiles").select("id, full_name").in("id", sdrIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name || "Unknown"; });

        const stats: Record<string, { calls: number; connected: number; twoMinPlus: number; deals: number; revenue: number }> = {};
        sdrIds.forEach(id => { stats[id] = { calls: 0, connected: 0, twoMinPlus: 0, deals: 0, revenue: 0 }; });
        calls?.forEach((c: any) => {
          if (stats[c.caller_id]) {
            stats[c.caller_id].calls++;
            if (c.call_status === 'completed') stats[c.caller_id].connected++;
            if ((c.duration_seconds || 0) >= 120) stats[c.caller_id].twoMinPlus++;
          }
        });
        deals?.forEach((d: any) => { if (stats[d.assigned_to]) { stats[d.assigned_to].deals++; stats[d.assigned_to].revenue += Number(d.value) || 0; } });

        const ranked = Object.entries(stats)
          .map(([id, s]) => ({ name: nameMap[id] || "Unknown", ...s }))
          .sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || b.deals - a.deals);

        return {
          success: true,
          data: { sdrs: ranked },
          summary: `**SDR Performance (${label})**\n${ranked.map((s, i) => `${i + 1}. **${s.name}**: ${s.calls} calls, ${s.connected} connected, ${s.twoMinPlus} quality (2+ min), ${s.deals} deals, $${s.revenue.toLocaleString()}`).join('\n') || "No activity found."}`,
        };
      }

      case "query_sequences": {
        const [{ data: sequences }, { data: activeFollowUps }] = await Promise.all([
          serviceClient.from("follow_up_sequences").select("id, name, status").eq("workspace_id", workspaceId),
          serviceClient.from("active_follow_ups").select("sequence_id, status").eq("workspace_id", workspaceId),
        ]);
        if (params.count_only) {
          return { success: true, data: { count: sequences?.length || 0 }, summary: `You have ${sequences?.length || 0} email sequences configured.` };
        }
        const seqStats: Record<string, { active: number; completed: number; total: number }> = {};
        activeFollowUps?.forEach((f: any) => {
          if (!seqStats[f.sequence_id]) seqStats[f.sequence_id] = { active: 0, completed: 0, total: 0 };
          seqStats[f.sequence_id].total++;
          if (f.status === 'active') seqStats[f.sequence_id].active++;
          if (f.status === 'completed') seqStats[f.sequence_id].completed++;
        });
        return {
          success: true,
          data: { sequences, stats: seqStats },
          summary: sequences?.length
            ? `**Email Sequences**\n${sequences.map((s: any) => {
                const st = seqStats[s.id] || { active: 0, completed: 0, total: 0 };
                return `• **${s.name}** (${s.status}) — ${st.total} enrollments, ${st.active} active, ${st.completed} completed`;
              }).join('\n')}`
            : "No email sequences configured yet.",
        };
      }

      case "query_email_logs": {
        const { start, label } = parseTimeRange(params.time_range || "this week");
        let query = serviceClient.from("email_logs").select("id, status, sent_at").eq("workspace_id", workspaceId).gte("sent_at", start.toISOString());
        if (params.status) query = query.eq("status", params.status);
        const { data: emails } = await query;
        const total = emails?.length || 0;
        if (params.count_only) {
          return { success: true, data: { count: total }, summary: `${total} emails${params.status ? ` with status "${params.status}"` : ''} sent ${label}.` };
        }
        const statusCounts: Record<string, number> = {};
        emails?.forEach((e: any) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
        return {
          success: true,
          data: { total, statusCounts },
          summary: `**Email Activity (${label})**\n• Total: ${total}\n${Object.entries(statusCounts).map(([s, c]) => `• ${s}: ${c}`).join('\n')}`,
        };
      }

      case "query_scripts": {
        const { data: scripts } = await serviceClient.from("call_scripts").select("id, title, is_default").eq("workspace_id", workspaceId);
        if (params.count_only) {
          return { success: true, data: { count: scripts?.length || 0 }, summary: `You have ${scripts?.length || 0} call scripts.` };
        }
        return {
          success: true,
          data: { scripts },
          summary: scripts?.length
            ? `**Call Scripts**\n${scripts.map((s: any) => `• ${s.title}${s.is_default ? ' (default)' : ''}`).join('\n')}`
            : "No call scripts created yet.",
        };
      }

      case "query_jobs": {
        let query = serviceClient.from("jobs").select("id, title, is_active, commission_percentage, payment_type, created_at").eq("workspace_id", workspaceId);
        if (params.active_only) query = query.eq("is_active", true);
        const { data: jobs } = await query;
        if (params.count_only) {
          return { success: true, data: { count: jobs?.length || 0 }, summary: `You have ${jobs?.length || 0}${params.active_only ? ' active' : ''} job postings.` };
        }
        return {
          success: true,
          data: { jobs, count: jobs?.length || 0 },
          summary: jobs?.length
            ? `**Job Postings**\n${jobs.map((j: any) => `• **${j.title}** (${j.is_active ? 'Active' : 'Inactive'}) — ${j.commission_percentage || 0}% commission`).join('\n')}`
            : "No job postings yet.",
        };
      }

      case "query_applications": {
        const { data: jobs } = await serviceClient.from("jobs").select("id, title").eq("workspace_id", workspaceId);
        if (!jobs?.length) {
          return { success: true, data: { count: 0 }, summary: "No job postings exist yet, so there are no applications." };
        }
        const jobIds = jobs.map((j: any) => j.id);
        let query = serviceClient.from("job_applications").select("id, job_id, user_id, status, applied_at").in("job_id", jobIds);
        if (params.status) query = query.eq("status", params.status);
        const { data: apps } = await query;

        if (params.count_only) {
          return { success: true, data: { count: apps?.length || 0 }, summary: `There are ${apps?.length || 0}${params.status ? ` ${params.status}` : ''} applications.` };
        }

        const userIds = [...new Set((apps || []).map((a: any) => a.user_id))];
        const { data: profiles } = userIds.length ? await serviceClient.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name || "Unknown"; });
        const jobMap: Record<string, string> = {};
        jobs.forEach((j: any) => { jobMap[j.id] = j.title; });

        return {
          success: true,
          data: { applications: apps, count: apps?.length || 0 },
          summary: apps?.length
            ? `**Job Applications**\n${apps.map((a: any) => `• **${nameMap[a.user_id] || 'Unknown'}** applied to "${jobMap[a.job_id] || 'Unknown Job'}" — Status: ${a.status}`).join('\n')}`
            : "No applications found.",
        };
      }

      case "query_offer_diagnostic": {
        const { data: diagState } = await serviceClient
          .from("offer_diagnostic_state")
          .select("*")
          .eq("workspace_id", workspaceId)
          .limit(1);

        if (!diagState?.length) {
          return {
            success: true,
            data: { completed: false },
            summary: "The Offer Diagnostic has NOT been completed yet. This is the first step — it defines your offer, ideal customer profile, and pricing. Go to the Offer Diagnostic page to start.",
          };
        }

        const state = diagState[0];
        const { data: diagResults } = await serviceClient
          .from("offer_diagnostic_results")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          success: true,
          data: { completed: true, state, results: diagResults?.[0] || null },
          summary: diagResults?.[0]
            ? `**Offer Diagnostic: Complete ✅**\nScore: ${diagResults[0].overall_score || 'N/A'}/100\nVerdict: ${diagResults[0].verdict || 'N/A'}\n${diagResults[0].recommendations ? `Recommendations: ${JSON.stringify(diagResults[0].recommendations).slice(0, 300)}` : ''}`
            : "Offer Diagnostic state exists but no results yet. The user may still be completing it.",
        };
      }

      case "query_training": {
        const { data: trainings } = await serviceClient.from("training_materials").select("id, title, type, created_at").eq("workspace_id", workspaceId);
        if (params.count_only) {
          return { success: true, data: { count: trainings?.length || 0 }, summary: `You have ${trainings?.length || 0} training materials.` };
        }
        return {
          success: true,
          data: { trainings, count: trainings?.length || 0 },
          summary: trainings?.length
            ? `**Training Materials**\n${trainings.map((t: any) => `• ${t.title} (${t.type || 'general'})`).join('\n')}`
            : "No training materials created yet.",
        };
      }

      case "analyze_bottleneck": {
        const { start, label } = parseTimeRange(params.time_range || "last 30 days");
        const [{ data: calls }, { data: deals }, { data: emails }] = await Promise.all([
          serviceClient.from("call_logs").select("id, call_status, duration_seconds").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("deals").select("id, stage, value").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("email_logs").select("id, status").eq("workspace_id", workspaceId).gte("sent_at", start.toISOString()),
        ]);

        const totalCalls = calls?.length || 0;
        const connected = calls?.filter((c: any) => c.call_status === 'completed').length || 0;
        const twoMinPlus = calls?.filter((c: any) => (c.duration_seconds || 0) >= 120).length || 0;
        const connectRate = totalCalls ? Math.round((connected / totalCalls) * 100) : 0;
        const qualityRate = connected ? Math.round((twoMinPlus / connected) * 100) : 0;

        const totalDeals = deals?.length || 0;
        const closedWon = deals?.filter((d: any) => d.stage === 'closed_won').length || 0;
        const closeRate = totalDeals ? Math.round((closedWon / totalDeals) * 100) : 0;

        const totalEmails = emails?.length || 0;
        const opened = emails?.filter((e: any) => e.status === 'opened').length || 0;
        const replied = emails?.filter((e: any) => e.status === 'replied').length || 0;

        return {
          success: true,
          data: { totalCalls, connectRate, qualityRate, totalDeals, closeRate, totalEmails, opened, replied },
          summary: `**Performance Analysis (${label})**\n\n📞 **Calls**: ${totalCalls} total, ${connectRate}% connect rate, ${qualityRate}% quality (2+ min)\n📧 **Emails**: ${totalEmails} sent, ${opened} opened, ${replied} replied\n💰 **Deals**: ${totalDeals} total, ${closedWon} closed won (${closeRate}% close rate)\n\n**Key metrics for AI diagnosis:**\n- Connect rate: ${connectRate}% (benchmark: 15-25%)\n- Quality call rate: ${qualityRate}% (benchmark: 30-50%)\n- Close rate: ${closeRate}% (benchmark: varies)`,
        };
      }

      case "get_platform_state": {
        const [
          { count: leadsCount }, { count: unassignedCount }, { count: dealsCount },
          { data: dealStages }, { count: callsCount }, { count: emailsCount },
          { data: sequences }, { data: scripts }, { data: jobs },
        ] = await Promise.all([
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("assigned_to", null),
          serviceClient.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("deals").select("stage").eq("workspace_id", workspaceId),
          serviceClient.from("call_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("email_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("follow_up_sequences").select("id, name, status").eq("workspace_id", workspaceId),
          serviceClient.from("call_scripts").select("id").eq("workspace_id", workspaceId),
          serviceClient.from("jobs").select("id, title, is_active").eq("workspace_id", workspaceId),
        ]);

        const { data: diagState } = await serviceClient.from("offer_diagnostic_state").select("id").eq("workspace_id", workspaceId).limit(1);
        const diagnosticCompleted = (diagState?.length || 0) > 0;

        const totalJobs = jobs?.length || 0;
        const activeJobs = jobs?.filter((j: any) => j.is_active).length || 0;

        let applicationsCount = 0, pendingAppsCount = 0, acceptedAppsCount = 0;
        if (totalJobs > 0) {
          const jobIds = jobs!.map((j: any) => j.id);
          const { data: apps } = await serviceClient.from("job_applications").select("id, status").in("job_id", jobIds);
          applicationsCount = apps?.length || 0;
          pendingAppsCount = apps?.filter((a: any) => a.status === 'pending').length || 0;
          acceptedAppsCount = apps?.filter((a: any) => a.status === 'accepted').length || 0;
        }

        const stageCounts: Record<string, number> = {};
        dealStages?.forEach((d: any) => { stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1; });

        const state = {
          leads: leadsCount || 0,
          unassignedLeads: unassignedCount || 0,
          deals: dealsCount || 0,
          dealsByStage: stageCounts,
          calls: callsCount || 0,
          emails: emailsCount || 0,
          sequences: sequences?.length || 0,
          scripts: scripts?.length || 0,
          jobs: totalJobs,
          activeJobs,
          applications: applicationsCount,
          pendingApplications: pendingAppsCount,
          acceptedApplications: acceptedAppsCount,
          diagnosticCompleted,
        };

        const summaryParts = [
          `**Platform State Overview**`,
          `• Offer Diagnostic: ${diagnosticCompleted ? '✅ Complete' : '❌ Not started'}`,
          `• Jobs: ${totalJobs} total (${activeJobs} active)`,
          `• Applications: ${applicationsCount} total (${pendingAppsCount} pending, ${acceptedAppsCount} accepted/hired)`,
          `• Leads: ${leadsCount || 0} total (${unassignedCount || 0} unassigned)`,
          `• Deals: ${dealsCount || 0} total ${Object.entries(stageCounts).length ? `(${Object.entries(stageCounts).map(([s, c]) => `${s}: ${c}`).join(', ')})` : ''}`,
          `• Calls: ${callsCount || 0} total`,
          `• Emails: ${emailsCount || 0} sent`,
          `• Sequences: ${sequences?.length || 0} configured`,
          `• Scripts: ${scripts?.length || 0} created`,
        ];

        const nextSteps: string[] = [];
        if (!diagnosticCompleted) {
          nextSteps.push("Complete the Offer Diagnostic — this defines your offer, ICP, and pricing strategy.");
        }
        if (diagnosticCompleted && state.scripts === 0) {
          nextSteps.push("Use the Script Builder to generate a cold call script from your Offer Diagnostic results.");
        }
        if (totalJobs === 0) {
          nextSteps.push("Post a job to start recruiting SDRs.");
        }
        if (totalJobs > 0 && acceptedAppsCount === 0 && pendingAppsCount > 0) {
          nextSteps.push(`Review ${pendingAppsCount} pending SDR applications.`);
        }
        if (totalJobs > 0 && applicationsCount === 0) {
          nextSteps.push("No SDRs have applied yet. Share your job listing to attract talent.");
        }
        if (state.leads === 0) {
          nextSteps.push("Import leads into your CRM via Apollo Search or CSV upload.");
        }
        if (state.leads > 0 && state.unassignedLeads > 0 && acceptedAppsCount > 0) {
          nextSteps.push(`Assign ${state.unassignedLeads} unassigned leads to your SDRs.`);
        }
        if (state.sequences === 0 && state.leads > 0) {
          nextSteps.push("Create email follow-up sequences for leads that don't pick up calls.");
        }
        if (state.leads > 0 && state.calls === 0 && acceptedAppsCount > 0) {
          nextSteps.push("Your SDRs should start making calls!");
        }

        if (nextSteps.length > 0) {
          summaryParts.push("", "**Recommended next steps (in priority order):**");
          nextSteps.forEach((step, i) => summaryParts.push(`${i + 1}. ${step}`));
        } else {
          summaryParts.push("", "✅ Your platform is fully set up! Focus on monitoring performance.");
        }

        return { success: true, data: { ...state, nextSteps }, summary: summaryParts.join('\n') };
      }

      // ──────────────────────────────────────────────
      // WRITE / EXECUTE TOOLS
      // ──────────────────────────────────────────────
      case "update_leads": {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (params.set_readiness_segment) updates.readiness_segment = params.set_readiness_segment;
        if (params.set_notes) updates.notes = params.set_notes;
        if (params.set_email_sending_state) updates.email_sending_state = params.set_email_sending_state;

        let query = serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) query = query.in("id", params.lead_ids);
        else if (params.filter_readiness_segment) query = query.eq("readiness_segment", params.filter_readiness_segment);
        else if (params.filter_unassigned) query = query.is("assigned_to", null);
        else if (!params.all) return { success: false, data: {}, summary: "Please specify lead_ids, a filter, or all=true." };

        const { count } = await query;
        if (!params.confirmed) {
          const changes = [];
          if (params.set_readiness_segment) changes.push(`readiness to "${params.set_readiness_segment}"`);
          if (params.set_notes) changes.push(`notes`);
          if (params.set_email_sending_state) changes.push(`email state to "${params.set_email_sending_state}"`);
          return { success: true, data: { affected_count: count || 0 }, summary: `${count || 0} leads would be updated (${changes.join(', ')}). Should I proceed?` };
        }

        let updateQuery = serviceClient.from("leads").update(updates).eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) updateQuery = updateQuery.in("id", params.lead_ids);
        else if (params.filter_readiness_segment) updateQuery = updateQuery.eq("readiness_segment", params.filter_readiness_segment);
        else if (params.filter_unassigned) updateQuery = updateQuery.is("assigned_to", null);

        const { error } = await updateQuery;
        if (error) return { success: false, data: {}, summary: `Error updating leads: ${error.message}` };

        await logExecution(serviceClient, userId, workspaceId, "update_leads", params, count || 0);
        return { success: true, data: { affected_count: count || 0 }, summary: `Successfully updated ${count || 0} leads.` };
      }

      case "update_deals": {
        // Validate stage
        if (!VALID_STAGES.includes(params.set_stage)) {
          return { success: false, data: {}, summary: `Invalid stage "${params.set_stage}". Valid stages: ${VALID_STAGES.join(', ')}` };
        }

        const updates: Record<string, any> = { stage: params.set_stage, updated_at: new Date().toISOString() };
        if (params.set_stage === 'closed_won' || params.set_stage === 'closed_lost') {
          updates.closed_at = new Date().toISOString();
        }

        let query = serviceClient.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
        if (params.deal_ids?.length) query = query.in("id", params.deal_ids);
        else if (params.filter_stage) query = query.eq("stage", params.filter_stage);
        else if (!params.all) return { success: false, data: {}, summary: "Please specify deal_ids, filter_stage, or all=true." };

        const { count } = await query;
        if (!params.confirmed) {
          return { success: true, data: { affected_count: count || 0 }, summary: `${count || 0} deals would be moved to "${params.set_stage}". Should I proceed?` };
        }

        let updateQuery = serviceClient.from("deals").update(updates).eq("workspace_id", workspaceId);
        if (params.deal_ids?.length) updateQuery = updateQuery.in("id", params.deal_ids);
        else if (params.filter_stage) updateQuery = updateQuery.eq("stage", params.filter_stage);

        const { error } = await updateQuery;
        if (error) return { success: false, data: {}, summary: `Error updating deals: ${error.message}` };

        // Log deal activity for each deal
        if (params.deal_ids?.length) {
          for (const dealId of params.deal_ids) {
            await serviceClient.from("deal_activities").insert({
              deal_id: dealId, user_id: userId, activity_type: "stage_change",
              description: `Stage changed to ${params.set_stage} by Klaus`,
            }).catch(() => {});
          }
        }

        await logExecution(serviceClient, userId, workspaceId, "update_deals", params, count || 0);
        return { success: true, data: { affected_count: count || 0 }, summary: `Successfully moved ${count || 0} deals to "${params.set_stage}".` };
      }

      case "assign_leads_to_sdr": {
        const sdr = await resolveSdrByName(serviceClient, workspaceId, params.sdr_name);
        if (!sdr) {
          const { data: members } = await serviceClient.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).is("removed_at", null);
          const memberIds = members?.map((m: any) => m.user_id) || [];
          const { data: profiles } = memberIds.length ? await serviceClient.from("profiles").select("full_name").in("id", memberIds) : { data: [] };
          return { success: false, data: {}, summary: `Could not find an SDR named "${params.sdr_name}". Available: ${profiles?.map((p: any) => p.full_name).join(', ') || 'none'}.` };
        }

        let query = serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) query = query.in("id", params.lead_ids);
        else {
          if (params.filter_unassigned) query = query.is("assigned_to", null);
          if (params.filter_readiness_segment) query = query.eq("readiness_segment", params.filter_readiness_segment);
        }
        const { count } = await query;
        const effectiveCount = params.limit ? Math.min(count || 0, params.limit) : (count || 0);

        if (!params.confirmed) {
          return { success: true, data: { affected_count: effectiveCount, sdr_name: sdr.full_name }, summary: `${effectiveCount} leads would be assigned to ${sdr.full_name}. Should I proceed?` };
        }

        if (params.limit && !params.lead_ids?.length) {
          let idQuery = serviceClient.from("leads").select("id").eq("workspace_id", workspaceId);
          if (params.filter_unassigned) idQuery = idQuery.is("assigned_to", null);
          if (params.filter_readiness_segment) idQuery = idQuery.eq("readiness_segment", params.filter_readiness_segment);
          const { data: leadRows } = await idQuery.limit(params.limit);
          const ids = leadRows?.map((l: any) => l.id) || [];
          if (ids.length > 0) await serviceClient.from("leads").update({ assigned_to: sdr.id, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).in("id", ids);
        } else {
          let uq = serviceClient.from("leads").update({ assigned_to: sdr.id, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
          if (params.lead_ids?.length) uq = uq.in("id", params.lead_ids);
          else {
            if (params.filter_unassigned) uq = uq.is("assigned_to", null);
            if (params.filter_readiness_segment) uq = uq.eq("readiness_segment", params.filter_readiness_segment);
          }
          await uq;
        }

        await logExecution(serviceClient, userId, workspaceId, "assign_leads_to_sdr", { ...params, sdr_id: sdr.id }, effectiveCount);
        return { success: true, data: { affected_count: effectiveCount }, summary: `Successfully assigned ${effectiveCount} leads to ${sdr.full_name}.` };
      }

      case "enroll_in_sequence": {
        const { data: sequences } = await serviceClient.from("follow_up_sequences").select("id, name").eq("workspace_id", workspaceId);
        const seq = sequences?.find((s: any) => s.name.toLowerCase().includes(params.sequence_name.toLowerCase()));
        if (!seq) return { success: false, data: {}, summary: `Could not find sequence "${params.sequence_name}". Available: ${sequences?.map((s: any) => s.name).join(', ') || 'none'}.` };

        let leadQuery = serviceClient.from("leads").select("id").eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) leadQuery = leadQuery.in("id", params.lead_ids);
        if (params.filter_readiness_segment) leadQuery = leadQuery.eq("readiness_segment", params.filter_readiness_segment);
        if (params.limit) leadQuery = leadQuery.limit(params.limit);
        const { data: leads } = await leadQuery;
        const leadIds = leads?.map((l: any) => l.id) || [];

        // Exclude already enrolled
        const { data: existing } = await serviceClient.from("active_follow_ups").select("lead_id").eq("sequence_id", seq.id).eq("status", "active").in("lead_id", leadIds.length > 0 ? leadIds : ["__none__"]);
        const existingIds = new Set(existing?.map((e: any) => e.lead_id) || []);
        const newLeadIds = leadIds.filter((id: string) => !existingIds.has(id));

        if (!params.confirmed) {
          return { success: true, data: { affected_count: newLeadIds.length, sequence_name: seq.name }, summary: `${newLeadIds.length} leads would be enrolled in sequence "${seq.name}"${existingIds.size > 0 ? ` (${existingIds.size} already enrolled, will be skipped)` : ''}. Should I proceed?` };
        }

        if (newLeadIds.length > 0) {
          await serviceClient.from("active_follow_ups").insert(newLeadIds.map((leadId: string) => ({
            lead_id: leadId, sequence_id: seq.id, workspace_id: workspaceId, started_by: userId, status: "active", current_step: 0,
          })));
        }

        await logExecution(serviceClient, userId, workspaceId, "enroll_in_sequence", { ...params, sequence_id: seq.id }, newLeadIds.length);
        return { success: true, data: { enrolled: newLeadIds.length, skipped: existingIds.size }, summary: `Enrolled ${newLeadIds.length} leads in "${seq.name}"${existingIds.size > 0 ? ` (${existingIds.size} skipped)` : ''}.` };
      }

      case "smart_enroll_sequence": {
        const { data: sequences } = await serviceClient.from("follow_up_sequences").select("id, name").eq("workspace_id", workspaceId);
        const seq = sequences?.find((s: any) => s.name.toLowerCase().includes(params.sequence_name.toLowerCase()));
        if (!seq) return { success: false, data: {}, summary: `Could not find sequence "${params.sequence_name}". Available: ${sequences?.map((s: any) => s.name).join(', ') || 'none'}.` };

        const todayStart = getTodayStart();
        let leadIds: string[] = [];

        if (params.filter_called_today_no_answer) {
          const { data: calls } = await serviceClient.from("call_logs")
            .select("lead_id")
            .eq("workspace_id", workspaceId)
            .gte("created_at", todayStart)
            .in("call_status", ["no-answer", "busy", "failed", "canceled"]);
          leadIds = [...new Set((calls || []).map((c: any) => c.lead_id).filter(Boolean))];
        } else if (params.filter_called_today_short_calls) {
          const { data: calls } = await serviceClient.from("call_logs")
            .select("lead_id")
            .eq("workspace_id", workspaceId)
            .gte("created_at", todayStart)
            .lt("duration_seconds", 30);
          leadIds = [...new Set((calls || []).map((c: any) => c.lead_id).filter(Boolean))];
        } else if (params.filter_no_email_sent) {
          const { data: allLeads } = await serviceClient.from("leads").select("id").eq("workspace_id", workspaceId);
          const allLeadIds = allLeads?.map((l: any) => l.id) || [];
          if (allLeadIds.length > 0) {
            const { data: emailedLeads } = await serviceClient.from("email_logs").select("lead_id").eq("workspace_id", workspaceId).in("lead_id", allLeadIds);
            const emailedSet = new Set(emailedLeads?.map((e: any) => e.lead_id) || []);
            leadIds = allLeadIds.filter((id: string) => !emailedSet.has(id));
          }
        }

        // Apply readiness filter
        if (params.filter_readiness_segment && leadIds.length > 0) {
          const { data: filtered } = await serviceClient.from("leads").select("id").eq("workspace_id", workspaceId).eq("readiness_segment", params.filter_readiness_segment).in("id", leadIds);
          leadIds = filtered?.map((l: any) => l.id) || [];
        }

        // Exclude already in active sequences
        if (leadIds.length > 0) {
          const { data: activeEnrollments } = await serviceClient.from("active_follow_ups").select("lead_id").eq("workspace_id", workspaceId).eq("status", "active").in("lead_id", leadIds);
          const activeSet = new Set(activeEnrollments?.map((e: any) => e.lead_id) || []);
          leadIds = leadIds.filter((id: string) => !activeSet.has(id));
        }

        if (params.limit) leadIds = leadIds.slice(0, params.limit);

        if (!params.confirmed) {
          return { success: true, data: { affected_count: leadIds.length, sequence_name: seq.name }, summary: `${leadIds.length} leads would be enrolled in sequence "${seq.name}". Should I proceed?` };
        }

        if (leadIds.length > 0) {
          await serviceClient.from("active_follow_ups").insert(leadIds.map((leadId: string) => ({
            lead_id: leadId, sequence_id: seq.id, workspace_id: workspaceId, started_by: userId, status: "active", current_step: 0,
          })));
        }

        await logExecution(serviceClient, userId, workspaceId, "smart_enroll_sequence", params, leadIds.length);
        return { success: true, data: { enrolled: leadIds.length }, summary: `Enrolled ${leadIds.length} leads in "${seq.name}".` };
      }

      case "query_calls_today": {
        const todayStart = getTodayStart();
        let query = serviceClient.from("call_logs")
          .select("id, lead_id, call_status, duration_seconds, caller_id, phone_number, created_at, disposition")
          .eq("workspace_id", workspaceId)
          .gte("created_at", todayStart);

        const { data: calls } = await query;
        let filtered = calls || [];

        if (params.filter_no_answer) {
          filtered = filtered.filter((c: any) => ["no-answer", "busy", "failed", "canceled"].includes(c.call_status));
        }
        if (params.filter_short_calls) {
          filtered = filtered.filter((c: any) => (c.duration_seconds || 0) < 30);
        }
        if (params.filter_connected) {
          filtered = filtered.filter((c: any) => c.call_status === 'completed');
        }
        if (params.caller_name) {
          const sdr = await resolveSdrByName(serviceClient, workspaceId, params.caller_name);
          if (sdr) filtered = filtered.filter((c: any) => c.caller_id === sdr.id);
        }

        if (params.count_only) {
          const uniqueLeads = new Set(filtered.map((c: any) => c.lead_id).filter(Boolean));
          return { success: true, data: { call_count: filtered.length, unique_leads: uniqueLeads.size }, summary: `Today: ${filtered.length} calls matching your filter, ${uniqueLeads.size} unique leads.` };
        }

        const uniqueLeads = [...new Set(filtered.map((c: any) => c.lead_id).filter(Boolean))];
        return {
          success: true,
          data: { calls: filtered, call_count: filtered.length, unique_lead_ids: uniqueLeads },
          summary: `Today: ${filtered.length} calls matching your filter across ${uniqueLeads.length} unique leads.`,
        };
      }

      case "send_training_to_sdr": {
        const { data: trainings } = await serviceClient.from("training_materials").select("id, title").eq("workspace_id", workspaceId);
        const training = trainings?.find((t: any) => t.title.toLowerCase().includes(params.training_title.toLowerCase()));
        if (!training) return { success: false, data: {}, summary: `Could not find training "${params.training_title}". Available: ${trainings?.map((t: any) => t.title).join(', ') || 'none'}.` };

        const sdr = await resolveSdrByName(serviceClient, workspaceId, params.sdr_name);
        if (!sdr) return { success: false, data: {}, summary: `Could not find SDR named "${params.sdr_name}".` };

        if (!params.confirmed) {
          return { success: true, data: { training_title: training.title, sdr_name: sdr.full_name }, summary: `Training "${training.title}" would be sent to ${sdr.full_name}. Should I proceed?` };
        }

        await serviceClient.from("notifications").insert({
          user_id: sdr.id, workspace_id: workspaceId, type: "training_assigned",
          title: "New Training Assigned", message: `You've been assigned: "${training.title}". Check the Training page.`,
          data: { training_id: training.id, training_title: training.title },
        });

        await logExecution(serviceClient, userId, workspaceId, "send_training_to_sdr", { training_id: training.id, sdr_id: sdr.id }, 1);
        return { success: true, data: {}, summary: `Training "${training.title}" assigned to ${sdr.full_name}. They'll see a notification.` };
      }

      case "create_lead": {
        const { data: newLead, error } = await serviceClient.from("leads").insert({
          workspace_id: workspaceId, created_by: userId,
          first_name: params.first_name || "", last_name: params.last_name || "",
          email: params.email || null, company: params.company || null, phone: params.phone || null, title: params.title || null,
        }).select("id, first_name, last_name").single();
        if (error) return { success: false, data: {}, summary: `Error creating lead: ${error.message}` };
        await logExecution(serviceClient, userId, workspaceId, "create_lead", params, 1);
        return { success: true, data: { lead: newLead }, summary: `Created lead: ${params.first_name} ${params.last_name || ''}${params.company ? ` at ${params.company}` : ''}.` };
      }

      case "create_deal": {
        // Validate stage
        const stage = params.stage || "new";
        if (!VALID_STAGES.includes(stage)) {
          return { success: false, data: {}, summary: `Invalid stage "${stage}". Valid stages: ${VALID_STAGES.join(', ')}` };
        }

        let assignedTo = userId;
        if (params.assigned_to_name) {
          const sdr = await resolveSdrByName(serviceClient, workspaceId, params.assigned_to_name);
          if (sdr) assignedTo = sdr.id;
        }
        const { data: newDeal, error } = await serviceClient.from("deals").insert({
          workspace_id: workspaceId, title: params.title, value: params.value || 0,
          stage, assigned_to: assignedTo, lead_id: params.lead_id || null,
        }).select("id, title, value, stage").single();
        if (error) return { success: false, data: {}, summary: `Error creating deal: ${error.message}` };
        await logExecution(serviceClient, userId, workspaceId, "create_deal", params, 1);
        return { success: true, data: { deal: newDeal }, summary: `Created deal: "${params.title}" worth $${(params.value || 0).toLocaleString()} in ${stage} stage.` };
      }

      case "delete_leads": {
        let query = serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) query = query.in("id", params.lead_ids);
        else if (params.filter_readiness_segment) query = query.eq("readiness_segment", params.filter_readiness_segment);
        else if (params.filter_unassigned) query = query.is("assigned_to", null);
        else if (!params.all) return { success: false, data: {}, summary: "Please specify lead_ids, a filter, or all=true." };

        const { count } = await query;
        if (!params.confirmed) {
          return { success: true, data: { affected_count: count || 0 }, summary: `${count || 0} leads would be permanently deleted. Should I proceed?` };
        }

        let deleteQuery = serviceClient.from("leads").delete().eq("workspace_id", workspaceId);
        if (params.lead_ids?.length) deleteQuery = deleteQuery.in("id", params.lead_ids);
        else if (params.filter_readiness_segment) deleteQuery = deleteQuery.eq("readiness_segment", params.filter_readiness_segment);
        else if (params.filter_unassigned) deleteQuery = deleteQuery.is("assigned_to", null);

        const { error } = await deleteQuery;
        if (error) return { success: false, data: {}, summary: `Error deleting leads: ${error.message}` };

        await logExecution(serviceClient, userId, workspaceId, "delete_leads", params, count || 0);
        return { success: true, data: { deleted_count: count || 0 }, summary: `Successfully deleted ${count || 0} leads.` };
      }

      case "send_email_to_leads": {
        // Get email template or use provided subject/body
        let subject = params.subject;
        let body = params.body;

        if (params.template_name) {
          const { data: templates } = await serviceClient.from("email_templates").select("id, subject, body").eq("workspace_id", workspaceId);
          const template = templates?.find((t: any) => t.subject?.toLowerCase().includes(params.template_name.toLowerCase()) || params.template_name.toLowerCase());
          if (template) {
            subject = template.subject;
            body = template.body;
          } else {
            return { success: false, data: {}, summary: `Could not find email template "${params.template_name}". Available: ${templates?.map((t: any) => t.subject).join(', ') || 'none'}.` };
          }
        }

        if (!subject || !body) return { success: false, data: {}, summary: "Please provide either a template_name or both subject and body." };

        // Get target leads
        let leadQuery = serviceClient.from("leads").select("id, email, first_name").eq("workspace_id", workspaceId).not("email", "is", null);
        if (params.lead_ids?.length) leadQuery = leadQuery.in("id", params.lead_ids);
        if (params.filter_readiness_segment) leadQuery = leadQuery.eq("readiness_segment", params.filter_readiness_segment);
        if (params.limit) leadQuery = leadQuery.limit(params.limit);
        const { data: leads } = await leadQuery;
        const validLeads = leads?.filter((l: any) => l.email) || [];

        if (!params.confirmed) {
          return { success: true, data: { affected_count: validLeads.length }, summary: `${validLeads.length} leads would receive an email with subject "${subject}". Should I proceed?` };
        }

        // Log email sends (actual sending would be done by the email system)
        for (const lead of validLeads) {
          await serviceClient.from("email_logs").insert({
            workspace_id: workspaceId, sent_by: userId, lead_id: lead.id,
            subject, body, provider: "klaus", status: "sent",
          }).catch(() => {});
        }

        await logExecution(serviceClient, userId, workspaceId, "send_email_to_leads", params, validLeads.length);
        return { success: true, data: { sent_count: validLeads.length }, summary: `Queued ${validLeads.length} emails with subject "${subject}".` };
      }

      case "create_task": {
        let assignedTo = userId;
        if (params.assigned_to_name) {
          const sdr = await resolveSdrByName(serviceClient, workspaceId, params.assigned_to_name);
          if (sdr) assignedTo = sdr.id;
        }

        const { data: task, error } = await serviceClient.from("tasks").insert({
          workspace_id: workspaceId, title: params.title, description: params.description || null,
          due_date: params.due_date || null, assigned_to: assignedTo,
          lead_id: params.lead_id || null, deal_id: params.deal_id || null,
          created_by: userId, status: "pending",
        }).select("id, title").single();

        if (error) return { success: false, data: {}, summary: `Error creating task: ${error.message}` };
        await logExecution(serviceClient, userId, workspaceId, "create_task", params, 1);
        return { success: true, data: { task }, summary: `Created task: "${params.title}"${params.assigned_to_name ? ` assigned to ${params.assigned_to_name}` : ''}.` };
      }

      case "schedule_callback": {
        let assignedTo = userId;
        if (params.assigned_to_name) {
          const sdr = await resolveSdrByName(serviceClient, workspaceId, params.assigned_to_name);
          if (sdr) assignedTo = sdr.id;
        }

        // Get lead info
        const { data: lead } = await serviceClient.from("leads").select("first_name, last_name, phone").eq("id", params.lead_id).single();
        const leadName = lead ? `${lead.first_name} ${lead.last_name}`.trim() : "Unknown";

        // Create notification for the callback
        await serviceClient.from("notifications").insert({
          user_id: assignedTo, workspace_id: workspaceId, type: "callback_reminder",
          title: "Callback Reminder",
          message: `Call back ${leadName}${lead?.phone ? ` at ${lead.phone}` : ''}${params.notes ? `. Notes: ${params.notes}` : ''}`,
          data: { lead_id: params.lead_id, callback_time: params.callback_time, notes: params.notes },
        });

        // Update lead's last_contacted_at note
        await serviceClient.from("leads").update({
          notes: `Callback scheduled${params.callback_time ? ` for ${params.callback_time}` : ''}${params.notes ? `: ${params.notes}` : ''}`,
          updated_at: new Date().toISOString(),
        }).eq("id", params.lead_id);

        await logExecution(serviceClient, userId, workspaceId, "schedule_callback", params, 1);
        return { success: true, data: {}, summary: `Callback scheduled for ${leadName}${params.callback_time ? ` at ${params.callback_time}` : ''}. A reminder notification has been created.` };
      }

      default:
        return { success: false, data: {}, summary: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Tool ${toolName} error:`, err);
    return { success: false, data: {}, summary: `Error in ${toolName}: ${err.message || 'Unknown error'}. Please check your data and try again.` };
  }
}

// ──────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;

    if (authError || !userId) {
      console.error("Auth error:", authError?.message || "Missing JWT sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: userId };

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { message, workspace_id } = await req.json();

    if (!message || !workspace_id) {
      return new Response(JSON.stringify({ error: "message and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history
    const { data: history } = await serviceClient
      .from("klaus_conversations")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("organization_id", workspace_id)
      .order("created_at", { ascending: true })
      .limit(30);

    // Get user role
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);
    const userRole = roles?.[0]?.role || "sdr";

    // Get user profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Get Klaus memory
    const { data: memories } = await serviceClient
      .from("klaus_memory")
      .select("memory_type, memory_key, memory_value")
      .eq("organization_id", workspace_id)
      .limit(10);

    const memoryContext = memories?.length
      ? `\nWorkspace behavioral patterns:\n${memories.map((m: any) => `- ${m.memory_key}: ${JSON.stringify(m.memory_value)}`).join('\n')}`
      : '';

    // Build messages for AI with tool-calling
    const aiMessages = [
      {
        role: "system",
        content: SYSTEM_PROMPT + `\n\nCurrent user: ${profile?.full_name || 'User'} (role: ${userRole})\nWorkspace ID: ${workspace_id}${memoryContext}`,
      },
      ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    // ── STEP 1: Call AI with tools ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ response: "AI capabilities are not configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools: TOOLS,
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ response: "I'm being rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ response: "AI credits exhausted. Please add credits to continue using Klaus." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fallbackResult = await executeTool("get_platform_state", {}, serviceClient, workspace_id, user.id);
      const fallbackResponse = `I'm having trouble with my AI capabilities, but here's your current platform state:\n\n${fallbackResult.summary}`;

      await saveConversation(serviceClient, user.id, workspace_id, message, fallbackResponse);
      return new Response(JSON.stringify({ response: fallbackResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const firstChoice = aiData.choices?.[0];

    // ── STEP 2: Check if AI wants to call tools ──
    if (firstChoice?.message?.tool_calls?.length > 0) {
      const toolResults: ToolResult[] = [];
      for (const toolCall of firstChoice.message.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch { /* empty args */ }
        
        const result = await executeTool(fnName, fnArgs, serviceClient, workspace_id, user.id);
        toolResults.push(result);
      }

      // ── STEP 3: Send tool results back to AI for formatting ──
      const toolResultMessages = firstChoice.message.tool_calls.map((tc: any, i: number) => ({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolResults[i]),
      }));

      const formatResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            ...aiMessages,
            firstChoice.message,
            ...toolResultMessages,
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      let finalResponse: string;
      if (formatResponse.ok) {
        const formatData = await formatResponse.json();
        finalResponse = formatData.choices?.[0]?.message?.content || toolResults.map(r => r.summary).join('\n\n');
      } else {
        finalResponse = toolResults.map(r => r.summary).join('\n\n');
      }

      await saveConversation(serviceClient, user.id, workspace_id, message, finalResponse);
      await logEvent(serviceClient, user.id, workspace_id, userRole, message);

      return new Response(JSON.stringify({ response: finalResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── No tool calls: direct text response ──
    const responseText = firstChoice?.message?.content || "I couldn't process that request. Could you rephrase?";

    await saveConversation(serviceClient, user.id, workspace_id, message, responseText);
    await logEvent(serviceClient, user.id, workspace_id, userRole, message);

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Klaus error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
async function saveConversation(client: any, userId: string, workspaceId: string, userMsg: string, assistantMsg: string) {
  await client.from("klaus_conversations").insert([
    { user_id: userId, organization_id: workspaceId, role: "user", content: userMsg },
    { user_id: userId, organization_id: workspaceId, role: "assistant", content: assistantMsg },
  ]);
}

async function logEvent(client: any, userId: string, workspaceId: string, userRole: string, query: string) {
  try {
    await client.from("system_events").insert({
      event_type: "klaus_query",
      actor_type: userRole === "agency_owner" ? "owner" : userRole === "platform_admin" ? "admin" : "sales_rep",
      actor_id: userId,
      organization_id: workspaceId,
      object_type: "klaus",
      metadata: { query },
    });
  } catch {
    // Non-blocking
  }
}

async function logExecution(client: any, userId: string, workspaceId: string, action: string, params: any, affectedCount: number) {
  try {
    await client.from("system_events").insert({
      event_type: "klaus_execution",
      actor_type: "system",
      actor_id: userId,
      organization_id: workspaceId,
      object_type: "klaus",
      metadata: { action, params, affected_count: affectedCount },
    });
  } catch {
    // Non-blocking
  }
}
