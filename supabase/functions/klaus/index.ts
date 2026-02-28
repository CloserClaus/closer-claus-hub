import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// TOOL DEFINITIONS (for AI tool-calling)
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
          time_range: { type: "string", description: "Natural language time range like 'today', 'this week', 'last 3 days'" },
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
      description: "Get a comprehensive overview of the workspace state for onboarding or 'what should I do' questions.",
      parameters: {
        type: "object",
        properties: {},
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

## Your Role
You are a platform-aware operator — not a generic chatbot. You help users get the most out of CloserClaus by analyzing their data, executing tasks, and guiding them through the platform.

## Core Behaviors
1. **Data-Driven**: Always base your responses on actual platform data. Use tools to query real data before answering.
2. **Action-Oriented**: When a user asks what to do, give specific, prioritized next steps based on their current state.
3. **Proactive Guidance**: If you detect the user is new (few leads, no calls, no sequences), shift into onboarding mode and walk them through setup.
4. **Natural Language Only**: Never expose JSON, tool names, internal IDs, or technical details to the user. Always respond in clear, human-friendly language.
5. **Contextual Memory**: Reference previous conversation context to provide continuity.

## When Users Ask "What should I do?" or need guidance:
- Use get_platform_state to assess their workspace
- Identify gaps (no leads? no scripts? no sequences? no calls?)
- Provide numbered, actionable next steps
- Offer to help execute the first step

## For Data Questions:
- Use the appropriate query tool
- Present results with clear formatting (numbers, percentages, rankings)
- Add brief insights when relevant (e.g., "Your connect rate is above average")

## For Action Requests:
- Describe what you'll do and how many records are affected
- Ask for confirmation before destructive or mass operations
- Report the result after execution

## Important Rules:
- Never say "I don't have access" if you have tools available — use them
- Never output raw JSON or tool call syntax
- Never mention tool names or internal system details
- If data is empty, explain what that means and suggest how to populate it
- Keep responses concise but complete`;

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
          const { count } = await serviceClient
            .from("leads").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId);
          return { success: true, data: { count: count || 0 }, summary: `There are ${count || 0} leads in the CRM.` };
        }
        let query = serviceClient.from("leads")
          .select("id, first_name, last_name, email, company, status, assigned_to, created_at, last_contacted_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(params.limit || 10);
        if (params.status) query = query.eq("status", params.status);
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
        let query = serviceClient.from("call_logs")
          .select("id, call_status, duration_seconds, caller_id, phone_number, created_at, disposition")
          .eq("workspace_id", workspaceId)
          .gte("created_at", start.toISOString());
        const { data: calls } = await query;
        const total = calls?.length || 0;
        const connected = calls?.filter((c: any) => c.call_status === 'completed').length || 0;
        const totalDuration = calls?.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) || 0;
        return {
          success: true,
          data: { total, connected, totalDuration, connectRate: total ? Math.round((connected / total) * 100) : 0 },
          summary: `**Call Activity (${label})**\n• Total calls: ${total}\n• Connected: ${connected}\n• Connect rate: ${total ? Math.round((connected / total) * 100) : 0}%\n• Total talk time: ${Math.round(totalDuration / 60)} minutes`,
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

        const stats: Record<string, { calls: number; connected: number; deals: number; revenue: number }> = {};
        sdrIds.forEach(id => { stats[id] = { calls: 0, connected: 0, deals: 0, revenue: 0 }; });
        calls?.forEach((c: any) => { stats[c.caller_id].calls++; if (c.call_status === 'completed') stats[c.caller_id].connected++; });
        deals?.forEach((d: any) => { if (stats[d.assigned_to]) { stats[d.assigned_to].deals++; stats[d.assigned_to].revenue += Number(d.value) || 0; } });

        const ranked = Object.entries(stats)
          .map(([id, s]) => ({ name: nameMap[id] || "Unknown", ...s }))
          .sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || b.deals - a.deals);

        return {
          success: true,
          data: { sdrs: ranked },
          summary: `**SDR Performance (${label})**\n${ranked.map((s, i) => `${i + 1}. **${s.name}**: ${s.calls} calls, ${s.connected} connected, ${s.deals} deals, $${s.revenue.toLocaleString()}`).join('\n') || "No activity found."}`,
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

      case "get_platform_state": {
        const [leads, deals, calls, sequences, scripts, sdrs, emailLogs] = await Promise.all([
          serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("deals").select("id, value, stage", { count: "exact" }).eq("workspace_id", workspaceId),
          serviceClient.from("call_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("follow_up_sequences").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("call_scripts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          serviceClient.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("removed_at", null),
          serviceClient.from("email_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        ]);

        const state = {
          leads: leads.count || 0,
          deals: deals.count || 0,
          calls: calls.count || 0,
          sequences: sequences.count || 0,
          scripts: scripts.count || 0,
          teamMembers: sdrs.count || 0,
          emailsSent: emailLogs.count || 0,
        };

        // Determine user state
        const isNew = state.leads === 0 && state.calls === 0 && state.sequences === 0;
        const isStalled = state.leads > 0 && state.calls === 0 && state.deals === 0;
        const isActive = state.calls > 0 || state.deals > 0;

        let userState = "active";
        if (isNew) userState = "new";
        else if (isStalled) userState = "stalled";

        const summaryParts = [
          `**Platform Overview**`,
          `• Leads: ${state.leads}`,
          `• Deals: ${state.deals}`,
          `• Calls made: ${state.calls}`,
          `• Email sequences: ${state.sequences}`,
          `• Call scripts: ${state.scripts}`,
          `• Team members: ${state.teamMembers}`,
          `• Emails sent: ${state.emailsSent}`,
          ``,
          `User state: ${userState}`,
        ];

        // Build next steps based on gaps
        const nextSteps: string[] = [];
        if (state.leads === 0) nextSteps.push("Import or add leads to your CRM");
        if (state.scripts === 0) nextSteps.push("Create a call script for your outreach");
        if (state.sequences === 0) nextSteps.push("Set up an email follow-up sequence");
        if (state.leads > 0 && state.calls === 0) nextSteps.push("Start making calls to your leads using the Dialer");
        if (state.leads > 0 && state.emailsSent === 0) nextSteps.push("Send your first email campaign");
        if (state.teamMembers <= 1) nextSteps.push("Post a job listing to recruit SDRs");
        if (state.deals > 0 && state.sequences === 0) nextSteps.push("Create follow-up sequences for your active deals");

        if (nextSteps.length > 0) {
          summaryParts.push("", "**Suggested next steps:**");
          nextSteps.forEach((step, i) => summaryParts.push(`${i + 1}. ${step}`));
        }

        return {
          success: true,
          data: { ...state, userState, nextSteps },
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
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      // Fallback: provide basic data-driven response
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
      // Execute all tool calls
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
        // If formatting fails, use the tool summaries directly
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
    // Non-blocking, ignore errors
  }
}
