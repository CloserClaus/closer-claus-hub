import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free phone number limits per subscription tier
const TIER_FREE_NUMBERS: Record<string, number> = {
  omega: 1,
  beta: 2,
  alpha: 5,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { workspace_id, phone_number, country_code = 'US', city } = await req.json();

    if (!workspace_id || !phone_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: workspace_id and phone_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Provisioning phone number ${phone_number} for workspace ${workspace_id}`);

    // Verify user has access to this workspace (owner or member)
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, subscription_tier, subscription_status, owner_id')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace error:', workspaceError);
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is workspace owner
    if (workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only workspace owners can purchase phone numbers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription status
    if (workspace.subscription_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Active subscription required to purchase phone numbers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = workspace.subscription_tier || 'omega';
    const freeLimit = TIER_FREE_NUMBERS[tier] || 1;

    // Count current phone numbers for this workspace
    const { count: currentNumberCount, error: countError } = await supabaseAdmin
      .from('workspace_phone_numbers')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .eq('is_active', true);

    if (countError) {
      console.error('Count error:', countError);
      return new Response(
        JSON.stringify({ error: 'Failed to check current phone numbers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = currentNumberCount || 0;
    const isWithinFreeLimit = currentCount < freeLimit;

    console.log(`Workspace ${workspace_id} has ${currentCount} numbers, free limit is ${freeLimit}, within free limit: ${isWithinFreeLimit}`);

    // If not within free limit, require payment (redirect to Stripe checkout)
    if (!isWithinFreeLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Free phone number limit exceeded',
          requires_payment: true,
          current_count: currentCount,
          free_limit: freeLimit,
          tier: tier
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Purchase the phone number from Twilio
    console.log(`Purchasing phone number ${phone_number} from Twilio...`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        PhoneNumber: phone_number,
        FriendlyName: `CloserClaus-${workspace_id.slice(0, 8)}`,
      }),
    });

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.text();
      console.error('Twilio error:', twilioError);
      return new Response(
        JSON.stringify({ error: 'Failed to purchase phone number from Twilio', details: twilioError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioData = await twilioResponse.json();
    console.log('Twilio purchase successful:', twilioData.sid);

    // Store the phone number in our database
    const { data: phoneNumber, error: insertError } = await supabaseAdmin
      .from('workspace_phone_numbers')
      .insert({
        workspace_id: workspace_id,
        phone_number: twilioData.phoneNumber || phone_number,
        twilio_phone_sid: twilioData.sid,
        country_code: country_code,
        city: city || twilioData.locality || null,
        is_active: true,
        monthly_cost: 0, // Free within tier limit
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Try to release the Twilio number since we couldn't store it
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioData.sid}.json`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${twilioAuth}` },
        });
      } catch (releaseError) {
        console.error('Failed to release Twilio number:', releaseError);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to save phone number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Phone number provisioned successfully:', phoneNumber.id);

    return new Response(
      JSON.stringify({
        success: true,
        phone_number: phoneNumber,
        was_free: true,
        numbers_used: currentCount + 1,
        numbers_limit: freeLimit,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
