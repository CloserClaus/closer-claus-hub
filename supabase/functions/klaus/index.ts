import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// TOOL DEFINITIONS
// ──────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_leads",
      description: "Query CRM leads. Use count_only for counts, or get a list with optional filters.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean", description: "If true, return only the count" },
          status: { type: "string", description: "Filter by lead status" },
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
      description: "Query CRM deals with optional filters.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean" },
          stage: { type: "string", description: "Pipeline stage filter" },
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
      description: "Run a comprehensive KPI analysis across calls, emails, deals to find the #1 performance bottleneck and provide actionable advice. Use this when users ask 'how do I get better results', 'why aren't we closing', 'what's wrong', etc.",
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
];

// ──────────────────────────────────────────────
// SYSTEM PROMPT
// ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Klaus, the intelligent execution agent inside the CloserClaus platform.

## WHAT IS CLOSERCLAUS
CloserClaus is a sales agency management platform. Agency owners use it to:
1. Define their offer and ideal customer profile (Offer Diagnostic)
2. Post jobs to attract and hire SDRs (Sales Development Representatives)
3. Import leads and assign them to SDRs
4. Equip SDRs with call scripts (generated from Offer Diagnostic via Script Builder) and email sequences
5. SDRs make cold calls via the built-in Dialer and send follow-up emails
6. When prospects convert, SDRs create deals in the CRM pipeline
7. Deals progress through stages: prospect → qualified → proposal → negotiation → closed_won
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
This is the exact priority order. Always recommend the FIRST incomplete step:
1. **Complete Offer Diagnostic** — Defines the offer, ICP, pricing, and dream outcome. This is the foundation. Without it, scripts and outreach will be generic and ineffective. Navigate to /offer-diagnostic.
2. **Use Script Builder** — After diagnostic, generate a cold call script and tactical playbook tailored to the offer. Navigate to /script-builder.
3. **Post a Job** — Create a job listing to attract SDRs who will do the outbound work. Navigate to /jobs and click "Post a Job".
4. **Review & Hire SDR Applicants** — Check applications, interview, and accept SDRs. Navigate to /jobs and review applications.
5. **Import Leads** — Add prospects to the CRM via CSV upload or Apollo search. Navigate to /leads for Apollo search or /crm for CSV import.
6. **Assign Leads to SDRs** — Distribute leads among hired SDRs so they can start working. In /crm, select leads and use bulk assign.
7. **Create Email Follow-up Sequences** — Set up automated email sequences for leads that don't pick up calls. Navigate to /email.
8. **SDRs Start Dialing** — Once scripts, leads, and sequences are ready, SDRs begin cold calling. They use /dialer.
9. **Monitor Performance** — Track calls, connect rates, meetings, and deals. Use the Dashboard or ask Klaus to analyze bottlenecks.

## PERFORMANCE BOTTLENECK ANALYSIS
When users ask "how do I improve results" or "what's wrong", use the analyze_bottleneck tool and interpret results:

**Benchmarks (industry standard for cold outbound):**
- Connect rate (calls answered / total calls): 15-25% is normal
- 2+ minute calls (meaningful conversations / connects): 30-50% is good
- Meeting set rate: 5-10% of meaningful conversations
- Email open rate: 20-40% is healthy
- Email reply rate: 2-5% is normal

**Diagnosis framework:**
- Connect rate < 15% → Bad phone data, wrong calling times, or caller ID issues
- 2+ min calls < 30% of connects → Weak opener. Fix the first 10 seconds of the script. The pattern interrupt and permission check need work.
- Lots of 2+ min calls but few meetings → Weak pitch or qualification. SDR is engaging but not converting. Fix the relevance hypothesis and micro-commitment in the script.
- Email opens < 20% → Subject lines are too generic or spammy
- Email replies < 2% → Email body lacks personalization or clear CTA
- Deals stalling in pipeline → Follow-up cadence is too slow or contracts aren't being sent

## PLATFORM FEATURES MAP
- **/dashboard** — Overview stats, recent activity
- **/crm** — Leads & deals management, pipeline board, CSV import, bulk actions
- **/leads** — Apollo lead search, saved leads, lead lists
- **/dialer** — Power dialer, call scripts, call recordings, dial pad
- **/email** — Email accounts, campaigns, sequences, templates, conversations
- **/jobs** — Post jobs, review applications
- **/contracts** — Send and track contracts for closed deals
- **/commissions** — Track SDR commissions and payouts
- **/offer-diagnostic** — Evaluate offer readiness for cold outbound
- **/script-builder** — Generate call scripts from Offer Diagnostic
- **/training** — Training materials for SDRs
- **/settings** — Workspace settings, billing, integrations
- **/conversations** — Internal team messaging

## YOUR ROLE & BEHAVIOR
1. **Data-Driven**: Always use tools to query real data before answering. Never guess.
2. **Action-Oriented**: Give specific, prioritized next steps based on current state.
3. **Platform Expert**: You know every feature and the correct order to use them.
4. **Proactive**: Detect gaps and recommend fixes before being asked.
5. **Natural Language Only**: Never expose JSON, tool names, IDs, or technical details.
6. **Concise but Complete**: Be direct. No filler. Format with markdown for readability.
7. **Context-Aware**: Consider the user's role (agency_owner vs sdr) when giving advice.

## IMPORTANT RULES
- When a user asks "what should I do next" → ALWAYS call get_platform_state first
- When a user asks about performance → Use analyze_bottleneck
- When mentioning navigation, use the page name (e.g., "Go to the CRM page" not "/crm")
- Never say "I don't have access" if you have tools — use them
- If data is empty, explain what it means and what to do about it
- For agency owners: always think about the full pipeline (offer → jobs → SDRs → leads → scripts → sequences → calls → deals → contracts → commissions)
- For SDRs: focus on their assigned leads, call activity, and deal progress`;

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
  workspaceId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "query_leads": {
        if (params.count_only) {
          let q = serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
          if (params.unassigned_only) q = q.is("assigned_to", null);
          if (params.status) q = q.eq("status", params.status);
          const { count } = await q;
          return { success: true, data: { count: count || 0 }, summary: `There are ${count || 0}${params.unassigned_only ? ' unassigned' : ''} leads${params.status ? ` with status "${params.status}"` : ''}.` };
        }
        let query = serviceClient.from("leads")
          .select("id, first_name, last_name, email, company, status, assigned_to, created_at, last_contacted_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(params.limit || 10);
        if (params.status) query = query.eq("status", params.status);
        if (params.unassigned_only) query = query.is("assigned_to", null);
        const { data: leads } = await query;
        return {
          success: true,
          data: { leads, count: leads?.length || 0 },
          summary: leads?.length
            ? `Found ${leads.length} leads:\n${leads.map((l: any) => `• ${l.first_name || ''} ${l.last_name || ''} — ${l.company || 'No company'} (${l.status || 'new'})`).join('\n')}`
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
        // Get jobs first to join
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

        // Get applicant names
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
        // Check offer_diagnostic_state table
        const { data: diagState } = await serviceClient
          .from("offer_diagnostic_state")
          .select("*")
          .eq("workspace_id", workspaceId)
          .limit(1);

        if (!diagState?.length) {
          return {
            success: true,
            data: { completed: false },
            summary: "The Offer Diagnostic has NOT been completed yet. This is the first step — it defines the offer, ICP, and pricing strategy needed for effective outbound.",
          };
        }

        const state = diagState[0];
        const hasScore = state.alignment_score != null && state.alignment_score > 0;
        return {
          success: true,
          data: {
            completed: hasScore,
            score: state.alignment_score,
            verdict: state.verdict,
            bottleneck: state.primary_bottleneck,
          },
          summary: hasScore
            ? `**Offer Diagnostic Results**\n• Score: ${state.alignment_score}/100\n• Verdict: ${state.verdict || 'N/A'}\n• Primary bottleneck: ${state.primary_bottleneck || 'None identified'}`
            : "The Offer Diagnostic has been started but not completed yet.",
        };
      }

      case "query_training": {
        const { data: training } = await serviceClient
          .from("training_materials")
          .select("id, title, type, created_at")
          .eq("workspace_id", workspaceId);

        if (params.count_only) {
          return { success: true, data: { count: training?.length || 0 }, summary: `You have ${training?.length || 0} training materials.` };
        }
        return {
          success: true,
          data: { training, count: training?.length || 0 },
          summary: training?.length
            ? `**Training Materials**\n${training.map((t: any) => `• ${t.title} (${t.type || 'general'})`).join('\n')}`
            : "No training materials created yet.",
        };
      }

      case "analyze_bottleneck": {
        const { start, label } = parseTimeRange(params.time_range || "last 30 days");

        // Parallel queries for all KPIs
        const [callsRes, emailsRes, dealsRes, leadsRes] = await Promise.all([
          serviceClient.from("call_logs").select("id, call_status, duration_seconds, disposition").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("email_logs").select("id, status").eq("workspace_id", workspaceId).gte("sent_at", start.toISOString()),
          serviceClient.from("deals").select("id, stage, value").eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        ]);

        const calls = callsRes.data || [];
        const emails = emailsRes.data || [];
        const deals = dealsRes.data || [];
        const totalLeads = leadsRes.count || 0;

        const totalCalls = calls.length;
        const connected = calls.filter((c: any) => c.call_status === 'completed').length;
        const twoMinPlus = calls.filter((c: any) => (c.duration_seconds || 0) >= 120).length;
        const connectRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;
        const qualityRate = connected > 0 ? Math.round((twoMinPlus / connected) * 100) : 0;

        const totalEmails = emails.length;
        const opened = emails.filter((e: any) => e.status === 'opened').length;
        const openRate = totalEmails > 0 ? Math.round((opened / totalEmails) * 100) : 0;

        const closedWon = deals.filter((d: any) => d.stage === 'closed_won').length;
        const closedRevenue = deals.filter((d: any) => d.stage === 'closed_won').reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

        // Determine bottleneck
        const bottlenecks: { issue: string; severity: number; advice: string }[] = [];

        if (totalCalls === 0 && totalEmails === 0) {
          bottlenecks.push({ issue: "No outbound activity", severity: 100, advice: "Your SDRs haven't made any calls or sent any emails. Make sure leads are assigned and SDRs are actively working them." });
        } else {
          if (totalCalls > 0 && connectRate < 15) {
            bottlenecks.push({ issue: `Low connect rate (${connectRate}%)`, severity: 90, advice: "Your connect rate is below 15%. Check: Are you calling during business hours (9-11am, 2-4pm local time)? Is the phone data accurate? Consider using a local caller ID." });
          }
          if (connected > 5 && qualityRate < 30) {
            bottlenecks.push({ issue: `Low quality calls (${qualityRate}% are 2+ min)`, severity: 85, advice: "Most calls are ending quickly. Your opener needs work — the first 10 seconds determine if the prospect stays. Review the script's pattern interrupt and permission check. Consider using the Script Builder to generate a better opener." });
          }
          if (twoMinPlus > 10 && closedWon === 0) {
            bottlenecks.push({ issue: "Good conversations but no closed deals", severity: 80, advice: "SDRs are having quality conversations but not closing. Check the pitch and qualification criteria. Are they asking for the meeting/next step clearly? Review the micro-commitment and earned next step in the script." });
          }
          if (totalEmails > 20 && openRate < 20) {
            bottlenecks.push({ issue: `Low email open rate (${openRate}%)`, severity: 70, advice: "Email subject lines aren't compelling enough. Use curiosity-driven, short subject lines (3-5 words). Avoid spam triggers. Personalize with the prospect's company name." });
          }
        }

        bottlenecks.sort((a, b) => b.severity - a.severity);
        const topBottleneck = bottlenecks[0];

        const summary = [
          `**Performance Analysis (${label})**`,
          ``,
          `📞 **Calls**: ${totalCalls} total, ${connected} connected (${connectRate}% connect rate), ${twoMinPlus} quality (2+ min, ${qualityRate}%)`,
          `📧 **Emails**: ${totalEmails} sent, ${opened} opened (${openRate}% open rate)`,
          `💰 **Deals**: ${deals.length} total, ${closedWon} closed won ($${closedRevenue.toLocaleString()})`,
          `👥 **Leads**: ${totalLeads} in CRM`,
          ``,
          topBottleneck
            ? `🎯 **#1 Bottleneck: ${topBottleneck.issue}**\n${topBottleneck.advice}`
            : `✅ No major bottlenecks detected. Keep up the momentum!`,
          bottlenecks.length > 1 ? `\n📋 **Other areas to watch:**\n${bottlenecks.slice(1).map(b => `• ${b.issue}`).join('\n')}` : '',
        ].join('\n');

        return { success: true, data: { connectRate, qualityRate, openRate, closedWon, closedRevenue, bottlenecks }, summary };
      }

      case "get_platform_state": {
        // Comprehensive state check — all critical tables
        const [leads, unassignedLeads, deals, calls, sequences, scripts, members, emailLogs, jobs, diagState] = await Promise.all([
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("assigned_to", null),
          serviceClient.from("deals").select("id, value, stage", { count: "exact" }).eq("workspace_id", workspaceId),
          serviceClient.from("call_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("follow_up_sequences").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("call_scripts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("removed_at", null),
          serviceClient.from("email_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("jobs").select("id, is_active", { count: "exact" }).eq("workspace_id", workspaceId),
          serviceClient.from("offer_diagnostic_state").select("alignment_score, verdict, primary_bottleneck").eq("workspace_id", workspaceId).limit(1),
        ]);

        // Job applications count
        const jobIds = (jobs.data || []).map((j: any) => j.id);
        let applicationsCount = 0;
        let pendingAppsCount = 0;
        let acceptedAppsCount = 0;
        if (jobIds.length > 0) {
          const { data: apps } = await serviceClient.from("job_applications").select("id, status").in("job_id", jobIds);
          applicationsCount = apps?.length || 0;
          pendingAppsCount = apps?.filter((a: any) => a.status === 'pending').length || 0;
          acceptedAppsCount = apps?.filter((a: any) => a.status === 'accepted').length || 0;
        }

        const diagnosticCompleted = diagState.data?.[0]?.alignment_score > 0;
        const diagnosticScore = diagState.data?.[0]?.alignment_score || 0;
        const activeJobs = (jobs.data || []).filter((j: any) => j.is_active).length;
        const totalJobs = jobs.count || 0;

        const state = {
          leads: leads.count || 0,
          unassignedLeads: unassignedLeads.count || 0,
          deals: deals.count || 0,
          calls: calls.count || 0,
          sequences: sequences.count || 0,
          scripts: scripts.count || 0,
          teamMembers: members.count || 0,
          emailsSent: emailLogs.count || 0,
          jobs: totalJobs,
          activeJobs,
          applications: applicationsCount,
          pendingApplications: pendingAppsCount,
          acceptedApplications: acceptedAppsCount,
          diagnosticCompleted,
          diagnosticScore,
        };

        const summaryParts = [
          `**Platform Overview**`,
          `• Offer Diagnostic: ${diagnosticCompleted ? `✅ Completed (Score: ${diagnosticScore}/100)` : '❌ Not completed'}`,
          `• Jobs: ${totalJobs} posted (${activeJobs} active)`,
          `• Applications: ${applicationsCount} total (${pendingAppsCount} pending, ${acceptedAppsCount} accepted)`,
          `• Team members (SDRs): ${state.teamMembers}`,
          `• Leads: ${state.leads} total (${state.unassignedLeads} unassigned)`,
          `• Call scripts: ${state.scripts}`,
          `• Email sequences: ${state.sequences}`,
          `• Calls made: ${state.calls}`,
          `• Emails sent: ${state.emailsSent}`,
          `• Deals: ${state.deals}`,
        ];

        // Build priority-ordered next steps
        const nextSteps: string[] = [];
        if (!diagnosticCompleted) {
          nextSteps.push("Complete the Offer Diagnostic — this defines your offer, ICP, and pricing strategy. Everything else builds on this. Go to the Offer Diagnostic page.");
        }
        if (diagnosticCompleted && state.scripts === 0) {
          nextSteps.push("Use the Script Builder to generate a cold call script from your Offer Diagnostic results. Go to the Script Builder page.");
        }
        if (totalJobs === 0) {
          nextSteps.push("Post a job to start recruiting SDRs who will make calls and close deals for you. Go to the Jobs page.");
        }
        if (totalJobs > 0 && acceptedAppsCount === 0 && pendingAppsCount > 0) {
          nextSteps.push(`Review ${pendingAppsCount} pending SDR applications. Go to the Jobs page to accept or reject applicants.`);
        }
        if (totalJobs > 0 && applicationsCount === 0) {
          nextSteps.push("No SDRs have applied yet. Share your job listing to attract talent, or invite SDRs directly.");
        }
        if (state.leads === 0) {
          nextSteps.push("Import leads into your CRM. Use Apollo Search on the Leads page or upload a CSV in the CRM.");
        }
        if (state.leads > 0 && state.unassignedLeads > 0 && acceptedAppsCount > 0) {
          nextSteps.push(`Assign ${state.unassignedLeads} unassigned leads to your SDRs. Go to the CRM, select leads, and use bulk assign.`);
        }
        if (state.sequences === 0 && state.leads > 0) {
          nextSteps.push("Create email follow-up sequences for leads that don't pick up calls. Go to the Email page.");
        }
        if (state.leads > 0 && state.calls === 0 && acceptedAppsCount > 0) {
          nextSteps.push("Your SDRs should start making calls! Make sure they have scripts and assigned leads, then use the Dialer.");
        }

        if (nextSteps.length > 0) {
          summaryParts.push("", "**Recommended next steps (in priority order):**");
          nextSteps.forEach((step, i) => summaryParts.push(`${i + 1}. ${step}`));
        } else {
          summaryParts.push("", "✅ Your platform is fully set up! Focus on monitoring performance and optimizing outreach.");
        }

        return {
          success: true,
          data: { ...state, nextSteps },
          summary: summaryParts.join('\n'),
        };
      }

      default:
        return { success: false, data: {}, summary: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Tool ${toolName} error:`, err);
    return { success: false, data: {}, summary: `I encountered an error while fetching that data. Please try again.` };
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
        max_tokens: 2000,
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

      // Fallback
      const fallbackResult = await executeTool("get_platform_state", {}, serviceClient, workspace_id);
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
        
        const result = await executeTool(fnName, fnArgs, serviceClient, workspace_id);
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
          max_tokens: 2000,
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
