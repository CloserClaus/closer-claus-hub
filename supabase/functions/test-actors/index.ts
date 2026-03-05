import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Smoke test: run each actor with maxItems=5 to verify schemas
const ACTORS_TO_TEST = [
  {
    key: "linkedin_jobs",
    actorId: "curious_coder/linkedin-jobs-scraper",
    input: {
      searchKeywords: ["sales representative"],
      searchLocation: "New York",
      maxItems: 5,
      scrapeCompany: true,
      scrapeJobDetails: false,
      splitSearchByLocation: false,
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
      limit: 5,
      datePosted: "14",
    },
    expectedFields: ["positionName", "company", "location"],
  },
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    input: {
      searchStringsArray: ["marketing agency"],
      maxCrawledPlacesPerSearch: 5,
      language: "en",
      locationQuery: "New York, NY",
    },
    expectedFields: ["title", "phone", "website"],
  },
  {
    key: "yelp",
    actorId: "yin5oHQaJGRfmJhlN",
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
      maxItems: 5,
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

  const results: any[] = [];

  for (const actor of ACTORS_TO_TEST) {
    const result: any = { key: actor.key, actorId: actor.actorId, started: false, succeeded: false, resultCount: 0, sampleFields: [], matchesExpected: false, error: null };

    try {
      // Start the run
      const actorIdEncoded = actor.actorId.replace("/", "~");
      const startResp = await fetch(
        `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${APIFY_API_TOKEN}&waitForFinish=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actor.input),
        }
      );

      if (!startResp.ok) {
        const errText = await startResp.text();
        result.error = `Start failed (${startResp.status}): ${errText.slice(0, 200)}`;
        results.push(result);
        continue;
      }

      const runData = await startResp.json();
      result.started = true;
      const runStatus = runData.data?.status;
      const datasetId = runData.data?.defaultDatasetId;

      if (runStatus !== "SUCCEEDED") {
        result.error = `Run status: ${runStatus}`;
        results.push(result);
        continue;
      }

      result.succeeded = true;

      // Fetch results
      const dataResp = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&clean=true&limit=5`
      );
      if (!dataResp.ok) {
        result.error = `Dataset fetch failed (${dataResp.status})`;
        results.push(result);
        continue;
      }

      const items = await dataResp.json();
      result.resultCount = items.length;

      if (items.length > 0) {
        result.sampleFields = Object.keys(items[0]).slice(0, 20);
        // Check if expected fields exist (directly or nested)
        const firstItem = items[0];
        const foundFields = actor.expectedFields.filter(f => {
          if (firstItem[f] !== undefined) return true;
          // Check nested
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
        // Show first item as sample (truncated)
        result.sampleItem = JSON.stringify(items[0]).slice(0, 500);
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    results.push(result);
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
