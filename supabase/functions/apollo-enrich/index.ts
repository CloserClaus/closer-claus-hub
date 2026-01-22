import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDITS_PER_LEAD = 5;

interface EnrichRequest {
  workspace_id: string;
  apollo_lead_ids: string[]; // IDs from our apollo_leads table
  add_to_crm?: boolean; // Whether to also add to main leads table
}

interface MasterLead {
  id: string;
  linkedin_url: string;
  apollo_id: string;
  first_name: string;
  last_name: string;
  email: string;
  email_status: string;
  phone: string;
  phone_status: string;
  company_name: string;
  company_domain: string;
  company_linkedin_url: string;
  title: string;
  seniority: string;
  department: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  employee_count: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) {
      throw new Error("APOLLO_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { workspace_id, apollo_lead_ids, add_to_crm = false }: EnrichRequest = await req.json();

    if (!apollo_lead_ids || apollo_lead_ids.length === 0) {
      throw new Error("No leads provided for enrichment");
    }

    // Verify user has access to workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", workspace_id)
      .single();

    if (workspaceError) {
      throw new Error("Workspace not found");
    }

    // Check if user is owner or member
    if (workspace.owner_id !== user.id) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .is("removed_at", null)
        .single();

      if (!membership) {
        throw new Error("Not authorized to access this workspace");
      }
    }

    // Get apollo_leads to enrich
    const { data: apolloLeads, error: leadsError } = await supabase
      .from("apollo_leads")
      .select("*")
      .in("id", apollo_lead_ids)
      .eq("workspace_id", workspace_id);

    if (leadsError || !apolloLeads || apolloLeads.length === 0) {
      throw new Error("No valid leads found to enrich");
    }

    // Filter out already enriched leads
    const leadsToEnrich = apolloLeads.filter(lead => lead.enrichment_status !== "enriched");
    
    if (leadsToEnrich.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All selected leads are already enriched",
          enriched_count: 0,
          from_cache: 0,
          from_api: 0,
          credits_used: 0,
          credits_saved: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Check master_leads for cached data using LinkedIn URLs
    const linkedinUrls = leadsToEnrich
      .map(lead => lead.linkedin_url)
      .filter((url): url is string => !!url);

    let cachedMasterLeads: MasterLead[] = [];
    if (linkedinUrls.length > 0) {
      const { data: masterLeads } = await supabase
        .from("master_leads")
        .select("*")
        .in("linkedin_url", linkedinUrls);
      
      cachedMasterLeads = masterLeads || [];
    }

    // Create a map for quick lookup by LinkedIn URL
    const masterLeadsMap = new Map<string, MasterLead>();
    for (const ml of cachedMasterLeads) {
      masterLeadsMap.set(ml.linkedin_url, ml);
    }

    // Separate leads into cache hits and API calls needed
    const cacheHits: typeof leadsToEnrich = [];
    const apiCalls: typeof leadsToEnrich = [];

    for (const lead of leadsToEnrich) {
      if (lead.linkedin_url && masterLeadsMap.has(lead.linkedin_url)) {
        cacheHits.push(lead);
      } else {
        apiCalls.push(lead);
      }
    }

    // Calculate credits needed (only for API calls)
    const creditsRequired = apiCalls.length * CREDITS_PER_LEAD;

    // Check credit balance
    const { data: creditData, error: creditError } = await supabase
      .from("lead_credits")
      .select("credits_balance")
      .eq("workspace_id", workspace_id)
      .single();

    if (creditError && creditError.code !== "PGRST116") {
      throw new Error("Error checking credit balance");
    }

    const currentBalance = creditData?.credits_balance || 0;
    if (currentBalance < creditsRequired) {
      throw new Error(`Insufficient credits. Need ${creditsRequired} credits but only have ${currentBalance}. Each lead costs ${CREDITS_PER_LEAD} credits.`);
    }

    const enrichedLeads: any[] = [];
    const partialLeads: any[] = [];
    const createdCRMLeads: any[] = [];
    let creditsUsed = 0;
    let enrichedFromCache = 0;
    let enrichedFromApi = 0;
    let partialCount = 0;

    // Step 2: Process cache hits (FREE - no API call, no credit deduction)
    for (const lead of cacheHits) {
      const cachedData = masterLeadsMap.get(lead.linkedin_url!);
      if (!cachedData) continue;

      // Check if cached data is "fully enriched" (has both email AND phone)
      const isFullyEnriched = !!(cachedData.email && cachedData.phone);

      const enrichedData = {
        email: cachedData.email || lead.email,
        email_status: cachedData.email_status || lead.email_status,
        phone: cachedData.phone || lead.phone,
        phone_status: cachedData.phone_status || lead.phone_status,
        title: cachedData.title || lead.title,
        seniority: cachedData.seniority || lead.seniority,
        department: cachedData.department || lead.department,
        linkedin_url: cachedData.linkedin_url || lead.linkedin_url,
        company_name: cachedData.company_name || lead.company_name,
        company_domain: cachedData.company_domain || lead.company_domain,
        company_linkedin_url: cachedData.company_linkedin_url || lead.company_linkedin_url,
        industry: cachedData.industry || lead.industry,
        employee_count: cachedData.employee_count || lead.employee_count,
        city: cachedData.city || lead.city,
        state: cachedData.state || lead.state,
        country: cachedData.country || lead.country,
        enrichment_status: isFullyEnriched ? "enriched" : "partial",
        enriched_at: new Date().toISOString(),
        enriched_by: user.id,
        credits_used: 0, // No credits for cache hits
      };

      const { data: updatedLead, error: updateError } = await supabase
        .from("apollo_leads")
        .update(enrichedData)
        .eq("id", lead.id)
        .select()
        .single();

      if (updateError) {
        console.error(`Error updating lead from cache ${lead.id}:`, updateError);
        continue;
      }

      // Increment enrichment_count in master_leads
      await supabase
        .from("master_leads")
        .update({
          enrichment_count: (cachedData as any).enrichment_count + 1,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", cachedData.id);

      if (isFullyEnriched) {
        enrichedLeads.push(updatedLead);
        enrichedFromCache++;

        // Optionally add to CRM (only for fully enriched)
        if (add_to_crm && updatedLead) {
          const { data: crmLead, error: crmError } = await supabase
            .from("leads")
            .insert({
              workspace_id: workspace_id,
              created_by: user.id,
              first_name: updatedLead.first_name || "Unknown",
              last_name: updatedLead.last_name || "Unknown",
              email: updatedLead.email,
              phone: updatedLead.phone,
              company: updatedLead.company_name,
              title: updatedLead.title,
              linkedin_url: updatedLead.linkedin_url,
              company_domain: updatedLead.company_domain,
              company_linkedin_url: updatedLead.company_linkedin_url,
              industry: updatedLead.industry,
              employee_count: updatedLead.employee_count,
              seniority: updatedLead.seniority,
              department: updatedLead.department,
              city: updatedLead.city,
              state: updatedLead.state,
              country: updatedLead.country,
              source: "apollo",
              apollo_lead_id: updatedLead.id,
            })
            .select()
            .single();

          if (!crmError) {
            createdCRMLeads.push(crmLead);
          }
        }
      } else {
        partialLeads.push(updatedLead);
        partialCount++;
      }
    }

    // Step 3: Process API calls (costs credits)
    for (const lead of apiCalls) {
      try {
        // Call Apollo People Enrichment API
        const enrichResponse = await fetch("https://api.apollo.io/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            api_key: APOLLO_API_KEY,
            id: lead.apollo_id,
            reveal_personal_emails: true,
            reveal_phone_number: true,
          }),
        });

        if (!enrichResponse.ok) {
          console.error(`Failed to enrich lead ${lead.id}:`, await enrichResponse.text());
          continue;
        }

        const enrichData = await enrichResponse.json();
        const person = enrichData.person;

        if (!person) {
          console.error(`No person data returned for lead ${lead.id}`);
          continue;
        }

        // Build enriched data
        const personEmail = person.email || lead.email;
        const personPhone = person.phone_numbers?.[0]?.sanitized_number || person.organization?.phone || lead.phone;
        
        // Check if fully enriched (has BOTH email AND phone)
        const isFullyEnriched = !!(personEmail && personPhone);

        const enrichedData = {
          email: personEmail,
          email_status: person.email_status || lead.email_status,
          phone: personPhone,
          phone_status: person.phone_numbers?.[0]?.status || lead.phone_status,
          title: person.title || lead.title,
          seniority: person.seniority || lead.seniority,
          department: person.departments?.[0] || lead.department,
          linkedin_url: person.linkedin_url || lead.linkedin_url,
          company_name: person.organization?.name || lead.company_name,
          company_domain: person.organization?.primary_domain || lead.company_domain,
          company_linkedin_url: person.organization?.linkedin_url || lead.company_linkedin_url,
          industry: person.organization?.industry || lead.industry,
          employee_count: person.organization?.estimated_num_employees?.toString() || lead.employee_count,
          city: person.city || lead.city,
          state: person.state || lead.state,
          country: person.country || lead.country,
          enrichment_status: isFullyEnriched ? "enriched" : "partial",
          enriched_at: new Date().toISOString(),
          enriched_by: user.id,
          credits_used: isFullyEnriched ? CREDITS_PER_LEAD : 0, // Only charge for fully enriched
        };

        // Update apollo_leads
        const { data: updatedLead, error: updateError } = await supabase
          .from("apollo_leads")
          .update(enrichedData)
          .eq("id", lead.id)
          .select()
          .single();

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
          continue;
        }

        // Save to master_leads for future cache (only if LinkedIn URL exists)
        if (updatedLead.linkedin_url) {
          const masterLeadData = {
            linkedin_url: updatedLead.linkedin_url,
            apollo_id: updatedLead.apollo_id,
            first_name: updatedLead.first_name,
            last_name: updatedLead.last_name,
            email: updatedLead.email,
            email_status: updatedLead.email_status,
            phone: updatedLead.phone,
            phone_status: updatedLead.phone_status,
            company_name: updatedLead.company_name,
            company_domain: updatedLead.company_domain,
            company_linkedin_url: updatedLead.company_linkedin_url,
            title: updatedLead.title,
            seniority: updatedLead.seniority,
            department: updatedLead.department,
            city: updatedLead.city,
            state: updatedLead.state,
            country: updatedLead.country,
            industry: updatedLead.industry,
            employee_count: updatedLead.employee_count,
          };

          // Upsert to master_leads (insert or update on conflict)
          const { error: masterError } = await supabase
            .from("master_leads")
            .upsert(masterLeadData, {
              onConflict: "linkedin_url",
              ignoreDuplicates: false,
            });

          if (masterError) {
            console.error("Error saving to master_leads:", masterError);
          }
        }

        if (isFullyEnriched) {
          enrichedLeads.push(updatedLead);
          creditsUsed += CREDITS_PER_LEAD;
          enrichedFromApi++;

          // Optionally add to CRM leads table (only for fully enriched)
          if (add_to_crm && updatedLead) {
            const { data: crmLead, error: crmError } = await supabase
              .from("leads")
              .insert({
                workspace_id: workspace_id,
                created_by: user.id,
                first_name: updatedLead.first_name || "Unknown",
                last_name: updatedLead.last_name || "Unknown",
                email: updatedLead.email,
                phone: updatedLead.phone,
                company: updatedLead.company_name,
                title: updatedLead.title,
                linkedin_url: updatedLead.linkedin_url,
                company_domain: updatedLead.company_domain,
                company_linkedin_url: updatedLead.company_linkedin_url,
                industry: updatedLead.industry,
                employee_count: updatedLead.employee_count,
                seniority: updatedLead.seniority,
                department: updatedLead.department,
                city: updatedLead.city,
                state: updatedLead.state,
                country: updatedLead.country,
                source: "apollo",
                apollo_lead_id: updatedLead.id,
              })
              .select()
              .single();

            if (crmError) {
              console.error(`Error creating CRM lead:`, crmError);
            } else {
              createdCRMLeads.push(crmLead);
            }
          }
        } else {
          // Partial enrichment - no credits charged, not added to CRM
          partialLeads.push(updatedLead);
          partialCount++;
        }
      } catch (enrichError) {
        console.error(`Error enriching lead ${lead.id}:`, enrichError);
        continue;
      }
    }

    // Deduct credits (only for API calls)
    if (creditsUsed > 0) {
      const { error: deductError } = await supabase
        .from("lead_credits")
        .update({
          credits_balance: currentBalance - creditsUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace_id);

      if (deductError) {
        console.error("Error deducting credits:", deductError);
      }
    }

    const creditsSaved = enrichedFromCache * CREDITS_PER_LEAD;

    return new Response(
      JSON.stringify({
        success: true,
        enriched_count: enrichedLeads.length,
        partial_count: partialCount,
        from_cache: enrichedFromCache,
        from_api: enrichedFromApi,
        credits_used: creditsUsed,
        credits_saved: creditsSaved,
        enriched_leads: enrichedLeads,
        crm_leads_created: createdCRMLeads.length,
        remaining_credits: currentBalance - creditsUsed,
        message: partialCount > 0 
          ? `${partialCount} leads had incomplete data (missing email or phone) and were not charged.`
          : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in apollo-enrich:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
