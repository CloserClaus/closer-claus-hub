import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Klaus, an execution agent inside CloserClaus.

Your job is not to chat. Your job is to understand intent and execute tasks inside the platform.

Always:
1. Interpret user intent
2. Check data
3. Confirm action if destructive or mass action
4. Execute precisely
5. Report result

Never explain system internals.
Never hallucinate data.
If data unavailable, say what is missing and how to obtain it.
Default behavior: act, not talk.

You have access to the following tools:
- query_events: Query system events by type, date range, actor
- query_leads: Query CRM leads with filters
- query_deals: Query CRM deals with filters
- query_call_logs: Query call logs with filters
- query_email_logs: Query email activity
- query_sequences: Query follow-up sequences
- query_sdrs: Query SDR performance data
- assign_leads: Assign leads to an SDR (requires confirmation)
- move_leads_stage: Move leads/deals to a new stage (requires confirmation)
- send_sequence: Start a sequence for leads (requires confirmation)
- query_training: Query training materials

When the user asks a question about data, use the appropriate query tool.
When the user asks to perform an action, first describe what you'll do and how many records are affected, then ask for confirmation.
For time-based queries, parse natural language: "last 3 days", "yesterday", "this week", "past 12 hours", etc.

Respond with structured JSON when calling tools:
{"tool": "tool_name", "params": {...}}

For multiple tool calls, return an array.
For conversational responses, just return plain text.`;

interface ChatMessage {
  role: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for data access
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { message, conversation_id, workspace_id } = await req.json();

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
      .limit(20);

    // Get user role
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    const userRole = roles?.[0]?.role || "sdr";

    // Build context about the workspace
    const contextParts: string[] = [];

    // Recent events summary
    const { data: recentEvents } = await serviceClient
      .from("system_events")
      .select("event_type, created_at, metadata")
      .eq("organization_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (recentEvents?.length) {
      contextParts.push(`Recent platform activity (last ${recentEvents.length} events):\n${recentEvents.map(e => `- ${e.event_type} at ${e.created_at}`).join('\n')}`);
    }

    // Quick stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const [leadsCount, dealsCount, callsCount] = await Promise.all([
      serviceClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspace_id),
      serviceClient.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspace_id),
      serviceClient.from("call_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspace_id).gte("created_at", weekAgo.toISOString()),
    ]);

    contextParts.push(`Workspace stats: ${leadsCount.count || 0} leads, ${dealsCount.count || 0} deals, ${callsCount.count || 0} calls this week`);

    // Klaus memory
    const { data: memories } = await serviceClient
      .from("klaus_memory")
      .select("memory_type, memory_key, memory_value")
      .eq("organization_id", workspace_id)
      .limit(10);

    if (memories?.length) {
      contextParts.push(`Behavioral patterns:\n${memories.map(m => `- ${m.memory_key}: ${JSON.stringify(m.memory_value)}`).join('\n')}`);
    }

    const contextMessage = contextParts.length 
      ? `\n\nCurrent context:\nUser role: ${userRole}\nWorkspace: ${workspace_id}\n${contextParts.join('\n\n')}` 
      : '';

    // Now handle tool-like queries by analyzing intent
    const lowerMessage = message.toLowerCase();
    let dataResponse = "";

    // Parse time references
    function parseTimeRange(msg: string): { start: Date; label: string } {
      const now = new Date();
      if (msg.includes("yesterday")) {
        const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0);
        return { start: d, label: "yesterday" };
      }
      const daysMatch = msg.match(/(?:last|past)\s+(\d+)\s+days?/);
      if (daysMatch) {
        const d = new Date(now.getTime() - parseInt(daysMatch[1]) * 86400000);
        return { start: d, label: `last ${daysMatch[1]} days` };
      }
      const hoursMatch = msg.match(/(?:last|past)\s+(\d+)\s+hours?/);
      if (hoursMatch) {
        const d = new Date(now.getTime() - parseInt(hoursMatch[1]) * 3600000);
        return { start: d, label: `last ${hoursMatch[1]} hours` };
      }
      if (msg.includes("this week")) {
        const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0);
        return { start: d, label: "this week" };
      }
      if (msg.includes("this month")) {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: d, label: "this month" };
      }
      if (msg.includes("today")) {
        const d = new Date(now); d.setHours(0,0,0,0);
        return { start: d, label: "today" };
      }
      // Default last 7 days
      return { start: new Date(now.getTime() - 7 * 86400000), label: "last 7 days" };
    }

    // Handle data queries directly
    if (lowerMessage.includes("call") && (lowerMessage.includes("how many") || lowerMessage.includes("count") || lowerMessage.includes("calls made"))) {
      const { start, label } = parseTimeRange(lowerMessage);
      const { count } = await serviceClient
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .gte("created_at", start.toISOString());
      
      const { data: callDetails } = await serviceClient
        .from("call_logs")
        .select("call_status, duration_seconds")
        .eq("workspace_id", workspace_id)
        .gte("created_at", start.toISOString());
      
      const connected = callDetails?.filter(c => c.call_status === 'completed').length || 0;
      const totalDuration = callDetails?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;
      const avgDuration = callDetails?.length ? Math.round(totalDuration / callDetails.length) : 0;
      
      dataResponse = `**Call Activity (${label})**\n- Total calls: ${count || 0}\n- Connected: ${connected}\n- Connect rate: ${count ? Math.round((connected / count) * 100) : 0}%\n- Avg duration: ${avgDuration}s\n- Total talk time: ${Math.round(totalDuration / 60)}min`;
    }
    else if (lowerMessage.includes("sdr") && (lowerMessage.includes("best") || lowerMessage.includes("performance") || lowerMessage.includes("top"))) {
      const { start } = parseTimeRange(lowerMessage);
      const { data: calls } = await serviceClient
        .from("call_logs")
        .select("caller_id, call_status, duration_seconds")
        .eq("workspace_id", workspace_id)
        .gte("created_at", start.toISOString());

      const { data: deals } = await serviceClient
        .from("deals")
        .select("assigned_to, value, stage")
        .eq("workspace_id", workspace_id)
        .gte("created_at", start.toISOString());

      // Aggregate by SDR
      const sdrStats: Record<string, { calls: number; connected: number; deals: number; revenue: number }> = {};
      calls?.forEach(c => {
        if (!sdrStats[c.caller_id]) sdrStats[c.caller_id] = { calls: 0, connected: 0, deals: 0, revenue: 0 };
        sdrStats[c.caller_id].calls++;
        if (c.call_status === 'completed') sdrStats[c.caller_id].connected++;
      });
      deals?.forEach(d => {
        if (!sdrStats[d.assigned_to]) sdrStats[d.assigned_to] = { calls: 0, connected: 0, deals: 0, revenue: 0 };
        sdrStats[d.assigned_to].deals++;
        sdrStats[d.assigned_to].revenue += Number(d.value) || 0;
      });

      // Get names
      const sdrIds = Object.keys(sdrStats);
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, full_name")
        .in("id", sdrIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.id] = p.full_name || p.id.slice(0, 8); });

      const ranked = sdrIds
        .map(id => ({ name: nameMap[id] || id.slice(0, 8), ...sdrStats[id] }))
        .sort((a, b) => (b.deals * 1000 + b.connected) - (a.deals * 1000 + a.connected));

      if (ranked.length === 0) {
        dataResponse = "No SDR activity found for this period.";
      } else {
        dataResponse = `**SDR Performance Rankings**\n${ranked.map((s, i) => `${i + 1}. **${s.name}**: ${s.calls} calls, ${s.connected} connected, ${s.deals} deals, $${s.revenue.toLocaleString()}`).join('\n')}`;
      }
    }
    else if (lowerMessage.includes("lead") && (lowerMessage.includes("not followed") || lowerMessage.includes("no follow"))) {
      const { data: staleLeads } = await serviceClient
        .from("leads")
        .select("id, first_name, last_name, company, last_contacted_at")
        .eq("workspace_id", workspace_id)
        .not("last_contacted_at", "is", null)
        .order("last_contacted_at", { ascending: true })
        .limit(10);

      if (staleLeads?.length) {
        dataResponse = `**Leads needing follow-up** (contacted but not recently):\n${staleLeads.map(l => `- ${l.first_name} ${l.last_name} (${l.company || 'N/A'}) — last contact: ${new Date(l.last_contacted_at!).toLocaleDateString()}`).join('\n')}`;
      } else {
        dataResponse = "All leads appear to be followed up.";
      }
    }
    else if (lowerMessage.includes("sequence") && lowerMessage.includes("performance")) {
      const { data: sequences } = await serviceClient
        .from("active_follow_ups")
        .select("sequence_id, status")
        .eq("workspace_id", workspace_id);

      const seqStats: Record<string, { active: number; completed: number; total: number }> = {};
      sequences?.forEach(s => {
        if (!seqStats[s.sequence_id]) seqStats[s.sequence_id] = { active: 0, completed: 0, total: 0 };
        seqStats[s.sequence_id].total++;
        if (s.status === 'active') seqStats[s.sequence_id].active++;
        if (s.status === 'completed') seqStats[s.sequence_id].completed++;
      });

      const { data: seqNames } = await serviceClient
        .from("follow_up_sequences")
        .select("id, name")
        .eq("workspace_id", workspace_id);

      const nameMap: Record<string, string> = {};
      seqNames?.forEach(s => { nameMap[s.id] = s.name; });

      const entries = Object.entries(seqStats);
      if (entries.length === 0) {
        dataResponse = "No sequence data found.";
      } else {
        dataResponse = `**Sequence Performance**\n${entries.map(([id, s]) => `- **${nameMap[id] || id.slice(0, 8)}**: ${s.total} total, ${s.active} active, ${s.completed} completed`).join('\n')}`;
      }
    }

    // If we handled it directly, respond
    if (dataResponse) {
      // Save to conversation
      await serviceClient.from("klaus_conversations").insert([
        { user_id: user.id, organization_id: workspace_id, role: "user", content: message },
        { user_id: user.id, organization_id: workspace_id, role: "assistant", content: dataResponse },
      ]);

      // Log event
      await serviceClient.from("system_events").insert({
        event_type: "klaus_query",
        actor_type: userRole === "agency_owner" ? "owner" : userRole === "platform_admin" ? "admin" : "sales_rep",
        actor_id: user.id,
        organization_id: workspace_id,
        object_type: "klaus",
        metadata: { query: message },
      });

      return new Response(JSON.stringify({ response: dataResponse, requires_confirmation: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For complex queries, use AI
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    // Call AI via Lovable AI proxy
    const aiResponse = await fetch("https://xlgzxmzejlshsgeiidsz.supabase.co/functions/v1/klaus-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ messages, workspace_id, user_id: user.id }),
    });

    let responseText: string;
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      responseText = aiData.response || "I wasn't able to process that request.";
    } else {
      // Fallback: construct response from context
      responseText = `I have access to your workspace data. Here's what I know:\n\n${contextParts.join('\n\n')}\n\nCould you be more specific about what you'd like me to do?`;
    }

    // Save conversation
    await serviceClient.from("klaus_conversations").insert([
      { user_id: user.id, organization_id: workspace_id, role: "user", content: message },
      { user_id: user.id, organization_id: workspace_id, role: "assistant", content: responseText },
    ]);

    // Log event
    await serviceClient.from("system_events").insert({
      event_type: "klaus_query",
      actor_type: userRole === "agency_owner" ? "owner" : "sales_rep",
      actor_id: user.id,
      organization_id: workspace_id,
      object_type: "klaus",
      metadata: { query: message },
    });

    return new Response(JSON.stringify({ response: responseText, requires_confirmation: false }), {
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
