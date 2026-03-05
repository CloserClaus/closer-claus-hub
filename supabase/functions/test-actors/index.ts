import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Smoke test: start actors, wait briefly, check results
const ACTORS_TO_TEST = [
  {
    key: "linkedin_jobs",
    actorId: "curious_coder/linkedin-jobs-scraper",
    input: {
      urls: ["https://www.linkedin.com/jobs/search/?keywords=sales%20representative&location=New%20York&f_TPR=r604800"],
      count: 10,
      scrapeCompany: true,
      splitByLocation: false,
    },
    expectedFields: ["companyName", "title", "location"],
  },
  {
    key: "indeed_jobs",
    actorId: "valig/indeed-jobs-scraper",
    input: {
      title: "sales representative",
      location: "New York",
      country: "us",
      limit: 3,
      datePosted: "14",
    },
    expectedFields: ["positionName", "company", "location"],
  },
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    input: {
      searchStringsArray: ["marketing agency"],
      maxCrawledPlacesPerSearch: 3,
      language: "en",
      locationQuery: "New York, NY",
    },
    expectedFields: ["title", "phone", "website"],
  },
  {
    key: "yelp",
    actorId: "sovereigntaylor/yelp-scraper",
    input: {
      searchTerms: ["marketing agency"],
      locations: ["New York, NY"],
      maxItems: 5,
    },
    expectedFields: ["name", "phone"],
  },
  {
    key: "yellow_pages",
    actorId: "trudax/yellow-pages-us-scraper",
    input: {
      search: "marketing agency",
      location: "New York, NY",
      maxItems: 3,
    },
    expectedFields: ["name", "phone"],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) {
    return new Response(JSON.stringify({ error: "APIFY_API_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action || "start"; // "start" or "check"
  const runIds = body.run_ids || {}; // { key: { runId, datasetId } }

  if (action === "start") {
    // Start all actors, return run IDs
    const started: any = {};
    for (const actor of ACTORS_TO_TEST) {
      try {
        const actorIdEncoded = actor.actorId.replace("/", "~");
        const resp = await fetch(
          `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${APIFY_API_TOKEN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(actor.input),
          }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          started[actor.key] = { error: `Start failed (${resp.status}): ${errText.slice(0, 200)}` };
          continue;
        }
        const data = await resp.json();
        started[actor.key] = {
          runId: data.data.id,
          datasetId: data.data.defaultDatasetId,
          status: data.data.status,
        };
      } catch (err) {
        started[actor.key] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    return new Response(JSON.stringify({ action: "started", run_ids: started }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "check") {
    // Check status and collect results for all run IDs
    const results: any = {};
    for (const actor of ACTORS_TO_TEST) {
      const ref = runIds[actor.key];
      if (!ref || ref.error) {
        results[actor.key] = { status: "SKIPPED", error: ref?.error || "No run ID" };
        continue;
      }

      try {
        // Poll status
        const pollResp = await fetch(
          `https://api.apify.com/v2/actor-runs/${ref.runId}?token=${APIFY_API_TOKEN}`
        );
        if (!pollResp.ok) {
          results[actor.key] = { status: "POLL_ERROR", error: `${pollResp.status}` };
          continue;
        }
        const pollData = await pollResp.json();
        const status = pollData.data.status;

        if (status !== "SUCCEEDED") {
          results[actor.key] = { status, message: status === "RUNNING" ? "Still running, try again" : "Not succeeded" };
          continue;
        }

        // Fetch results
        const dataResp = await fetch(
          `https://api.apify.com/v2/datasets/${ref.datasetId}/items?token=${APIFY_API_TOKEN}&clean=true&limit=3`
        );
        if (!dataResp.ok) {
          results[actor.key] = { status: "SUCCEEDED", resultError: `Dataset fetch: ${dataResp.status}` };
          continue;
        }
        const items = await dataResp.json();

        const result: any = {
          status: "SUCCEEDED",
          resultCount: items.length,
          sampleFields: items.length > 0 ? Object.keys(items[0]).slice(0, 25) : [],
        };

        if (items.length > 0) {
          const firstItem = items[0];
          const foundFields = actor.expectedFields.filter(f => {
            if (firstItem[f] !== undefined) return true;
            const parts = f.split(".");
            let obj = firstItem;
            for (const p of parts) {
              if (obj && typeof obj === "object") obj = obj[p];
              else return false;
            }
            return obj !== undefined;
          });
          result.matchesExpected = foundFields.length === actor.expectedFields.length;
          result.foundExpectedFields = foundFields;
          result.missingExpectedFields = actor.expectedFields.filter(f => !foundFields.includes(f));
          result.sampleItem = JSON.stringify(items[0]).slice(0, 800);
        }

        results[actor.key] = result;
      } catch (err) {
        results[actor.key] = { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
      }
    }
    return new Response(JSON.stringify({ action: "checked", results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action. Use 'start' or 'check' with run_ids." }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
