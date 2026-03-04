import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Shared actor registry — must stay in sync with signal-planner/index.ts
const ACTOR_REGISTRY: Record<string, { actorId: string; label: string }> = {
  google_maps:         { actorId: "nwua9Gu5YrADL7ZDj", label: "Google Maps" },
  linkedin_jobs:       { actorId: "sovereigntaylor/linkedin-jobs-scraper", label: "LinkedIn Jobs" },
  linkedin_companies:  { actorId: "2SyF0bVxmgGr8IVCZ", label: "LinkedIn Companies" },
  google_search:       { actorId: "nFJndFXA5zjCTuudP", label: "Google Search" },
  yelp:                { actorId: "yin5oHQaJGRfmJhlN", label: "Yelp" },
  indeed_jobs:         { actorId: "consummate_mandala/indeed-job-listings-scraper", label: "Indeed Jobs" },
  yellow_pages:        { actorId: "trudax/yellow-pages-us-scraper", label: "Yellow Pages" },
  contact_enrichment:  { actorId: "9Sk4JJhEma9vBKqrg", label: "Contact Enrichment" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...params } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action !== "process_daily") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all daily signals due to run
    const { data: dueSignals, error: fetchError } = await serviceClient
      .from("signal_runs")
      .select("*")
      .in("schedule_type", ["daily", "weekly"])
      .in("status", ["completed", "running_daily"])
      .lte("next_run_at", new Date().toISOString());

    if (fetchError) throw fetchError;
    if (!dueSignals || dueSignals.length === 0) {
      return new Response(JSON.stringify({ message: "No daily signals due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${dueSignals.length} daily signals`);
    let processed = 0;
    let failed = 0;

    for (const run of dueSignals) {
      try {
        await processSignalRun(run, serviceClient);
        processed++;
      } catch (err) {
        console.error(`Failed to process signal ${run.id}:`, err);
        failed++;
        // Mark as failed but keep schedule
        await serviceClient
          .from("signal_runs")
          .update({
            status: "completed",
            next_run_at: new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString(),
          })
          .eq("id", run.id);
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${processed} signals, ${failed} failed`, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-daily-signals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processSignalRun(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const workspace_id = run.workspace_id;

  // Backward compat: signal_plan can be a single object (old) or array (new)
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  // Check credits
  const { data: credits } = await serviceClient
    .from("lead_credits")
    .select("credits_balance")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  const balance = credits?.credits_balance || 0;
  if (balance < run.estimated_cost) {
    console.log(`Signal ${run.id}: Insufficient credits (${balance} < ${run.estimated_cost}), skipping`);
    await serviceClient.from("notifications").insert({
      user_id: run.user_id,
      workspace_id,
      type: "signal_failed",
      title: "Daily Signal Paused",
      message: `Your daily signal "${run.signal_name}" was paused due to insufficient credits. You need ${run.estimated_cost} credits.`,
    });
    return;
  }

  let allRawResults: any[] = [];
  let totalAiFilteredCount = 0;

  // Execute each source plan
  for (const plan of plans) {
    const actorInfo = ACTOR_REGISTRY[plan.source];
    if (!actorInfo) {
      console.error(`Unknown source: ${plan.source}, skipping`);
      continue;
    }

    // Check cache
    const queryHash = btoa(JSON.stringify({ source: plan.source, query: plan.search_query, params: plan.search_params })).slice(0, 64);
    const { data: cached } = await serviceClient
      .from("signal_dataset_cache")
      .select("*")
      .eq("query_hash", queryHash)
      .eq("source", plan.source)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .maybeSingle();

    let sourceResults: any[] = [];

    if (cached?.dataset) {
      sourceResults = cached.dataset;
    } else {
      const actorInput: Record<string, any> = {
        searchStringsArray: [plan.search_query],
        maxCrawledPlacesPerSearch: plan.estimated_rows || 200,
        language: "en",
        ...plan.search_params,
      };

      // Add proxy for LinkedIn actors
      if (plan.source === "linkedin_jobs" || plan.source === "linkedin_companies") {
        actorInput.proxyConfiguration = { useApifyProxy: true };
      }

      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorInfo.actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actorInput),
        }
      );

      if (!runResponse.ok) {
        console.error(`Apify error for ${plan.source} [${runResponse.status}]`);
        continue; // Skip this source, try others
      }

      sourceResults = await runResponse.json();

      await serviceClient.from("signal_dataset_cache").upsert({
        query_hash: queryHash,
        source: plan.source,
        dataset: sourceResults,
        row_count: sourceResults.length,
      }, { onConflict: "query_hash,source" });
    }

    allRawResults.push(...sourceResults);
  }

  // Apply filters (use first plan's filters)
  let filtered = allRawResults;
  const filters = plans[0]?.filters;
  if (filters?.length > 0) {
    filtered = allRawResults.filter((item: any) => {
      return filters.every((f: any) => {
        const val = item[f.field];
        if (val === undefined || val === null) return false;
        switch (f.operator) {
          case "<": return Number(val) < Number(f.value);
          case ">": return Number(val) > Number(f.value);
          case "=": return String(val).toLowerCase() === String(f.value).toLowerCase();
          case "contains": return String(val).toLowerCase().includes(String(f.value).toLowerCase());
          case "not_contains": return !String(val).toLowerCase().includes(String(f.value).toLowerCase());
          default: return true;
        }
      });
    });
  }

  // AI classification (use first plan's ai_classification)
  const aiClassification = plans[0]?.ai_classification;
  if (aiClassification && filtered.length > 0) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const batchSize = 20;
      const classified: any[] = [];
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        try {
          const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a lead classifier. For each business in the list, determine if it matches this criteria: "${aiClassification}". Return a JSON array of booleans, one per business. Only return the JSON array, nothing else.`,
                },
                {
                  role: "user",
                  content: JSON.stringify(batch.map((b: any) => ({
                    name: b.title || b.name || b.company_name,
                    description: b.description || b.categoryName || "",
                    website: b.website || b.url || "",
                  }))),
                },
              ],
            }),
          });

          if (classifyResponse.ok) {
            const classResult = await classifyResponse.json();
            let bools: boolean[] = [];
            try {
              const content = classResult.choices?.[0]?.message?.content || "[]";
              bools = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
            } catch {
              bools = batch.map(() => true);
            }
            batch.forEach((item: any, idx: number) => {
              if (bools[idx]) classified.push(item);
            });
            totalAiFilteredCount += batch.length;
          } else {
            classified.push(...batch);
          }
        } catch {
          classified.push(...batch);
        }
      }
      filtered = classified;
    }
  }

  // Deduplicate
  const { data: existingKeys } = await serviceClient
    .from("signal_dedup_keys")
    .select("dedup_key, dedup_type")
    .eq("workspace_id", workspace_id);

  const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

  const { data: crmLeads } = await serviceClient
    .from("leads")
    .select("email, phone, linkedin_url")
    .eq("workspace_id", workspace_id);

  const crmSet = new Set<string>();
  (crmLeads || []).forEach((l: any) => {
    if (l.email) crmSet.add(`domain:${l.email.split("@")[1]}`);
    if (l.phone) crmSet.add(`phone:${l.phone.replace(/\D/g, "")}`);
    if (l.linkedin_url) crmSet.add(`linkedin:${l.linkedin_url}`);
  });

  const uniqueLeads: any[] = [];
  const newDedupKeys: any[] = [];

  for (const item of filtered) {
    const domain = extractDomain(item.website || item.url || "");
    const phone = (item.phone || item.telephone || "").replace(/\D/g, "");
    const linkedin = item.linkedin || item.linkedinUrl || "";

    let isDuplicate = false;
    if (domain && (existingSet.has(`domain:${domain}`) || crmSet.has(`domain:${domain}`))) isDuplicate = true;
    if (!isDuplicate && phone && (existingSet.has(`phone:${phone}`) || crmSet.has(`phone:${phone}`))) isDuplicate = true;
    if (!isDuplicate && linkedin && (existingSet.has(`linkedin:${linkedin}`) || crmSet.has(`linkedin:${linkedin}`))) isDuplicate = true;

    if (!isDuplicate) {
      uniqueLeads.push(item);
      if (domain) {
        existingSet.add(`domain:${domain}`);
        newDedupKeys.push({ workspace_id, dedup_key: domain, dedup_type: "domain" });
      }
      if (phone) {
        existingSet.add(`phone:${phone}`);
        newDedupKeys.push({ workspace_id, dedup_key: phone, dedup_type: "phone" });
      }
      if (linkedin) {
        existingSet.add(`linkedin:${linkedin}`);
        newDedupKeys.push({ workspace_id, dedup_key: linkedin, dedup_type: "linkedin" });
      }
    }
  }

  // Store leads
  const leadsToInsert = uniqueLeads.map((item) => ({
    run_id: run.id,
    workspace_id,
    company_name: item.title || item.name || item.company_name || null,
    website: item.website || item.url || null,
    domain: extractDomain(item.website || item.url || ""),
    phone: item.phone || item.telephone || null,
    linkedin: item.linkedin || item.linkedinUrl || null,
    location: item.address || item.city || item.location || null,
    source: ACTOR_REGISTRY[item._source || plans[0]?.source]?.label || "Unknown",
    extra_data: item,
  }));

  if (leadsToInsert.length > 0) {
    const { data: insertedLeads } = await serviceClient
      .from("signal_leads")
      .insert(leadsToInsert)
      .select("id");

    if (insertedLeads && newDedupKeys.length > 0) {
      const dedupWithIds = newDedupKeys.map((dk, idx) => ({
        ...dk,
        signal_lead_id: insertedLeads[Math.min(idx, insertedLeads.length - 1)]?.id || null,
      }));
      await serviceClient.from("signal_dedup_keys").insert(dedupWithIds).select();
    }
  }

  // Calculate actual cost
  const scrapedRows = allRawResults.length;
  const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
  const aiFilterCostUsd = totalAiFilteredCount * 0.001;
  const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
  const chargedPriceUsd = actualCostUsd * 3;
  const actualCredits = Math.ceil(chargedPriceUsd * 5);

  // Deduct credits
  await serviceClient
    .from("lead_credits")
    .update({ credits_balance: balance - actualCredits })
    .eq("workspace_id", workspace_id);

  // Update run
  await serviceClient
    .from("signal_runs")
    .update({
      status: "completed",
      actual_cost: actualCredits,
      leads_discovered: (run.leads_discovered || 0) + uniqueLeads.length,
      last_run_at: new Date().toISOString(),
      next_run_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .eq("id", run.id);

  // Notify user
  if (uniqueLeads.length > 0) {
    await serviceClient.from("notifications").insert({
      user_id: run.user_id,
      workspace_id,
      type: "signal_complete",
      title: "Daily Signal Results",
      message: `Your daily signal "${run.signal_name}" found ${uniqueLeads.length} new leads. ${actualCredits} credits charged.`,
    });
  }

  console.log(`Signal ${run.id}: ${uniqueLeads.length} new leads, ${actualCredits} credits charged`);
}

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0] || "";
  }
}
