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

    // Calculate required credits
    const creditsRequired = apollo_lead_ids.length * CREDITS_PER_LEAD;

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
          credits_used: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actualCreditsRequired = leadsToEnrich.length * CREDITS_PER_LEAD;
    
    // Re-check credits for actual leads to enrich
    if (currentBalance < actualCreditsRequired) {
      throw new Error(`Insufficient credits. Need ${actualCreditsRequired} credits for ${leadsToEnrich.length} unenriched leads.`);
    }

    const enrichedLeads: any[] = [];
    const createdCRMLeads: any[] = [];
    let creditsUsed = 0;

    // Enrich each lead via Apollo API
    for (const lead of leadsToEnrich) {
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

        // Update apollo_leads with enriched data
        const enrichedData = {
          email: person.email || lead.email,
          email_status: person.email_status || lead.email_status,
          phone: person.phone_numbers?.[0]?.sanitized_number || person.organization?.phone || lead.phone,
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
          enrichment_status: "enriched",
          enriched_at: new Date().toISOString(),
          enriched_by: user.id,
          credits_used: CREDITS_PER_LEAD,
        };

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

        enrichedLeads.push(updatedLead);
        creditsUsed += CREDITS_PER_LEAD;

        // Optionally add to CRM leads table
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
      } catch (enrichError) {
        console.error(`Error enriching lead ${lead.id}:`, enrichError);
        continue;
      }
    }

    // Deduct credits
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
        // Note: Credits weren't deducted but leads were enriched
        // This is a known edge case that should be handled
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched_count: enrichedLeads.length,
        credits_used: creditsUsed,
        enriched_leads: enrichedLeads,
        crm_leads_created: createdCRMLeads.length,
        remaining_credits: currentBalance - creditsUsed,
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
