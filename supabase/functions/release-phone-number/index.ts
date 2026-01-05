import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { phone_number_id } = await req.json();

    if (!phone_number_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: phone_number_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Releasing phone number with ID ${phone_number_id}`);

    // Get the phone number record
    const { data: phoneRecord, error: phoneError } = await supabaseAdmin
      .from('workspace_phone_numbers')
      .select('*, workspaces!workspace_phone_numbers_workspace_id_fkey(owner_id)')
      .eq('id', phone_number_id)
      .single();

    if (phoneError || !phoneRecord) {
      console.error('Phone number not found:', phoneError);
      return new Response(
        JSON.stringify({ error: 'Phone number not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is workspace owner
    if (phoneRecord.workspaces?.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only workspace owners can release phone numbers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Release the phone number from Twilio if we have a SID
    if (phoneRecord.twilio_phone_sid) {
      console.log(`Releasing Twilio phone number ${phoneRecord.twilio_phone_sid}...`);
      
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${phoneRecord.twilio_phone_sid}.json`;

      const twilioResponse = await fetch(twilioUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
        },
      });

      if (!twilioResponse.ok && twilioResponse.status !== 404) {
        const twilioError = await twilioResponse.text();
        console.error('Twilio release error:', twilioError);
        // Continue with database deletion even if Twilio fails
        // The number might already be released
      } else {
        console.log('Twilio phone number released successfully');
      }
    }

    // Delete the phone number from our database
    const { error: deleteError } = await supabaseAdmin
      .from('workspace_phone_numbers')
      .delete()
      .eq('id', phone_number_id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete phone number from database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Phone number released successfully:', phone_number_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Phone number released successfully',
        phone_number: phoneRecord.phone_number,
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
