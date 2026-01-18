import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApolloSearchFilters {
  // Person filters
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  
  // Location filters
  person_locations?: string[];
  person_city?: string[];
  person_state?: string[];
  person_country?: string[];
  
  // Company filters
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  organization_locations?: string[];
  organization_ids?: string[];
  
  // Revenue filters (in thousands)
  revenue_range_min?: number;
  revenue_range_max?: number;
  
  // Founding year
  organization_founded_year_min?: number;
  organization_founded_year_max?: number;
  
  // Technology filters
  currently_using_any_of_technology_uids?: string[];
  
  // Email status
  contact_email_status?: string[];
  
  // Pagination
  page?: number;
  per_page?: number;
}

interface ApolloSearchRequest {
  workspace_id: string;
  filters: ApolloSearchFilters;
  save_to_list?: string; // Optional list_id to save results to
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

    const { workspace_id, filters, save_to_list }: ApolloSearchRequest = await req.json();

    // Verify user is a member of the workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .single();

    if (memberError && memberError.code !== "PGRST116") {
      // Also check if user is workspace owner
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspace_id)
        .single();

      if (workspaceError || workspace?.owner_id !== user.id) {
        throw new Error("Not authorized to access this workspace");
      }
    }

    // Build Apollo API request body
    const apolloRequestBody: Record<string, any> = {
      api_key: APOLLO_API_KEY,
      page: filters.page || 1,
      per_page: Math.min(filters.per_page || 25, 100), // Max 100 per Apollo API
    };

    // Person filters
    if (filters.person_titles?.length) {
      apolloRequestBody.person_titles = filters.person_titles;
    }
    if (filters.person_seniorities?.length) {
      apolloRequestBody.person_seniorities = filters.person_seniorities;
    }
    if (filters.person_departments?.length) {
      apolloRequestBody.person_departments = filters.person_departments;
    }

    // Location filters
    if (filters.person_locations?.length) {
      apolloRequestBody.person_locations = filters.person_locations;
    }
    if (filters.person_city?.length) {
      apolloRequestBody.person_city = filters.person_city;
    }
    if (filters.person_state?.length) {
      apolloRequestBody.person_state = filters.person_state;
    }
    if (filters.person_country?.length) {
      apolloRequestBody.person_country = filters.person_country;
    }

    // Company filters
    if (filters.organization_industry_tag_ids?.length) {
      apolloRequestBody.organization_industry_tag_ids = filters.organization_industry_tag_ids;
    }
    if (filters.organization_num_employees_ranges?.length) {
      apolloRequestBody.organization_num_employees_ranges = filters.organization_num_employees_ranges;
    }
    if (filters.organization_locations?.length) {
      apolloRequestBody.organization_locations = filters.organization_locations;
    }
    if (filters.organization_ids?.length) {
      apolloRequestBody.organization_ids = filters.organization_ids;
    }

    // Revenue filters
    if (filters.revenue_range_min !== undefined) {
      apolloRequestBody.revenue_range = apolloRequestBody.revenue_range || {};
      apolloRequestBody.revenue_range.min = filters.revenue_range_min;
    }
    if (filters.revenue_range_max !== undefined) {
      apolloRequestBody.revenue_range = apolloRequestBody.revenue_range || {};
      apolloRequestBody.revenue_range.max = filters.revenue_range_max;
    }

    // Founding year filters
    if (filters.organization_founded_year_min !== undefined) {
      apolloRequestBody.organization_founded_year_min = filters.organization_founded_year_min;
    }
    if (filters.organization_founded_year_max !== undefined) {
      apolloRequestBody.organization_founded_year_max = filters.organization_founded_year_max;
    }

    // Technology filters
    if (filters.currently_using_any_of_technology_uids?.length) {
      apolloRequestBody.currently_using_any_of_technology_uids = filters.currently_using_any_of_technology_uids;
    }

    // Email status filter
    if (filters.contact_email_status?.length) {
      apolloRequestBody.contact_email_status = filters.contact_email_status;
    }

    console.log("Calling Apollo API with filters:", JSON.stringify(apolloRequestBody, null, 2));

    // Call Apollo People Search API
    const apolloResponse = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(apolloRequestBody),
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error("Apollo API error:", errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status} - ${errorText}`);
    }

    const apolloData = await apolloResponse.json();
    
    console.log(`Apollo returned ${apolloData.people?.length || 0} results`);

    // Transform Apollo results to our format and store in apollo_leads
    const leads = apolloData.people || [];
    const storedLeads: any[] = [];

    for (const person of leads) {
      const apolloLead = {
        apollo_id: person.id,
        workspace_id: workspace_id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        email_status: person.email_status,
        phone: person.phone_numbers?.[0]?.sanitized_number || person.organization?.phone,
        phone_status: person.phone_numbers?.[0]?.status || null,
        title: person.title,
        seniority: person.seniority,
        department: person.departments?.[0],
        linkedin_url: person.linkedin_url,
        company_name: person.organization?.name,
        company_domain: person.organization?.primary_domain,
        company_linkedin_url: person.organization?.linkedin_url,
        industry: person.organization?.industry,
        employee_count: person.organization?.estimated_num_employees?.toString(),
        city: person.city,
        state: person.state,
        country: person.country,
        search_filters: filters,
        enrichment_status: "searched", // Not yet enriched (purchased)
      };

      // Upsert to apollo_leads (update if apollo_id + workspace_id exists)
      const { data: upsertedLead, error: upsertError } = await supabase
        .from("apollo_leads")
        .upsert(apolloLead, {
          onConflict: "apollo_id,workspace_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (upsertError) {
        console.error("Error upserting lead:", upsertError);
        continue;
      }

      storedLeads.push(upsertedLead);

      // If save_to_list is provided, add to lead list
      if (save_to_list && upsertedLead) {
        const { error: listItemError } = await supabase
          .from("lead_list_items")
          .upsert({
            lead_list_id: save_to_list,
            apollo_lead_id: upsertedLead.id,
          }, {
            onConflict: "lead_list_id,apollo_lead_id",
            ignoreDuplicates: true,
          });

        if (listItemError) {
          console.error("Error adding lead to list:", listItemError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        leads: storedLeads,
        pagination: {
          page: apolloData.pagination?.page || 1,
          per_page: apolloData.pagination?.per_page || 25,
          total_entries: apolloData.pagination?.total_entries || 0,
          total_pages: apolloData.pagination?.total_pages || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in apollo-search:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
