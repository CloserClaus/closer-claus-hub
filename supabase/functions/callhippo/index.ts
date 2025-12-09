import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CALLHIPPO_API_KEY = Deno.env.get('CALLHIPPO_API_KEY');
    
    if (!CALLHIPPO_API_KEY) {
      console.error('CALLHIPPO_API_KEY is not configured');
      return new Response(
        JSON.stringify({ 
          error: 'CallHippo API key not configured', 
          message: 'Please add the CALLHIPPO_API_KEY secret to enable dialer functionality'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log(`CallHippo action: ${action}`, params);

    const CALLHIPPO_BASE_URL = 'https://api.callhippo.com/v1';

    switch (action) {
      case 'initiate_call': {
        const { phoneNumber, workspaceId, leadId } = params;

        if (!phoneNumber || !workspaceId) {
          return new Response(
            JSON.stringify({ error: 'Phone number and workspace ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Initiate call via CallHippo API
        const callResponse = await fetch(`${CALLHIPPO_BASE_URL}/call/initiate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: phoneNumber,
            // Additional CallHippo params can be added here
          }),
        });

        const callData = await callResponse.json();
        console.log('CallHippo response:', callData);

        if (!callResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to initiate call', details: callData }),
            { status: callResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log the call in our database
        const { data: callLog, error: logError } = await supabase
          .from('call_logs')
          .insert({
            workspace_id: workspaceId,
            lead_id: leadId || null,
            caller_id: user.id,
            phone_number: phoneNumber,
            call_status: 'initiated',
            callhippo_call_id: callData.call_id || callData.id,
          })
          .select()
          .single();

        if (logError) {
          console.error('Error logging call:', logError);
        }

        return new Response(
          JSON.stringify({ success: true, call: callData, log: callLog }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'end_call': {
        const { callId, callLogId, notes } = params;

        // End call via CallHippo API
        if (callId) {
          const endResponse = await fetch(`${CALLHIPPO_BASE_URL}/call/${callId}/end`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          console.log('CallHippo end call response:', await endResponse.text());
        }

        // Update call log
        if (callLogId) {
          const { error: updateError } = await supabase
            .from('call_logs')
            .update({
              call_status: 'completed',
              ended_at: new Date().toISOString(),
              notes: notes || null,
            })
            .eq('id', callLogId);

          if (updateError) {
            console.error('Error updating call log:', updateError);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_status': {
        const { callId } = params;

        const statusResponse = await fetch(`${CALLHIPPO_BASE_URL}/call/${callId}/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
          },
        });

        const statusData = await statusResponse.json();

        return new Response(
          JSON.stringify(statusData),
          { status: statusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('CallHippo function error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});