import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshRequest {
  master_lead_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');

    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ error: 'Apollo API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { master_lead_id } = await req.json() as RefreshRequest;

    if (!master_lead_id) {
      return new Response(
        JSON.stringify({ error: 'master_lead_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the master lead
    const { data: masterLead, error: fetchError } = await supabase
      .from('master_leads')
      .select('*')
      .eq('id', master_lead_id)
      .single();

    if (fetchError || !masterLead) {
      return new Response(
        JSON.stringify({ error: 'Master lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refreshing master lead: ${masterLead.first_name} ${masterLead.last_name}`);

    // Call Apollo People Match API to get fresh data
    const apolloResponse = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloApiKey,
      },
      body: JSON.stringify({
        linkedin_url: masterLead.linkedin_url.startsWith('http') 
          ? masterLead.linkedin_url 
          : `https://${masterLead.linkedin_url}`,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      }),
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('Apollo API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to refresh from Apollo API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apolloData = await apolloResponse.json();
    const person = apolloData.person;

    if (!person) {
      return new Response(
        JSON.stringify({ error: 'No data returned from Apollo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update master lead with fresh data
    const updatedData = {
      apollo_id: person.id || masterLead.apollo_id,
      first_name: person.first_name || masterLead.first_name,
      last_name: person.last_name || masterLead.last_name,
      email: person.email || masterLead.email,
      email_status: person.email_status || masterLead.email_status,
      phone: person.sanitized_phone || person.phone_numbers?.[0]?.sanitized_number || masterLead.phone,
      phone_status: person.phone_numbers?.[0]?.status || masterLead.phone_status,
      company_name: person.organization?.name || masterLead.company_name,
      company_domain: person.organization?.primary_domain || masterLead.company_domain,
      company_linkedin_url: person.organization?.linkedin_url || masterLead.company_linkedin_url,
      title: person.title || masterLead.title,
      seniority: person.seniority || masterLead.seniority,
      department: person.departments?.[0] || masterLead.department,
      city: person.city || masterLead.city,
      state: person.state || masterLead.state,
      country: person.country || masterLead.country,
      industry: person.organization?.industry || masterLead.industry,
      employee_count: person.organization?.estimated_num_employees?.toString() || masterLead.employee_count,
      last_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('master_leads')
      .update(updatedData)
      .eq('id', master_lead_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update master lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully refreshed master lead ${master_lead_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lead data refreshed successfully',
        updated_fields: Object.keys(updatedData).filter(k => 
          updatedData[k as keyof typeof updatedData] !== masterLead[k as keyof typeof masterLead]
        )
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Refresh master lead error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
