import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { call_log_id } = await req.json();
    if (!call_log_id) throw new Error("call_log_id is required");

    // Fetch the call log
    const { data: callLog, error: fetchError } = await supabase
      .from("call_logs")
      .select("id, phone_number, call_status, duration_seconds, notes, disposition, created_at, leads(first_name, last_name, company, title)")
      .eq("id", call_log_id)
      .single();

    if (fetchError || !callLog) throw new Error("Call log not found");

    const leadName = (callLog.leads as any)?.first_name
      ? `${(callLog.leads as any).first_name} ${(callLog.leads as any).last_name}`
      : "Unknown contact";
    const leadCompany = (callLog.leads as any)?.company || "Unknown company";
    const leadTitle = (callLog.leads as any)?.title || "";

    const prompt = `Summarize this sales call in 2-3 concise sentences. Focus on the outcome, any next steps, and key talking points.

Call details:
- Contact: ${leadName}${leadTitle ? `, ${leadTitle}` : ""} at ${leadCompany}
- Phone: ${callLog.phone_number}
- Duration: ${callLog.duration_seconds ? Math.round(callLog.duration_seconds / 60) + " minutes" : "Unknown"}
- Status: ${callLog.call_status}
- Disposition: ${callLog.disposition || "Not set"}
- Agent notes: ${callLog.notes || "No notes recorded"}
- Date: ${new Date(callLog.created_at).toLocaleDateString()}

Provide a professional, actionable summary.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a sales operations AI assistant. Summarize sales calls concisely and professionally. Focus on outcomes, next steps, and key insights. Keep summaries to 2-3 sentences max." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim();

    if (!summary) throw new Error("No summary generated");

    // Save summary to call_logs using service role
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await adminSupabase
      .from("call_logs")
      .update({ ai_summary: summary })
      .eq("id", call_log_id);

    if (updateError) {
      console.error("Error saving summary:", updateError);
      // Still return the summary even if saving fails
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-call error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
