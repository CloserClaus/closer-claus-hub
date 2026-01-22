import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twilio client setup
async function endTwilioCall(callSid: string, accountSid: string, authToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'Status=completed',
      }
    );
    return response.ok;
  } catch (error) {
    console.error(`Failed to end Twilio call ${callSid}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find sessions with no heartbeat in the last 2 minutes
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    console.log(`Looking for stale sessions (no heartbeat since ${staleThreshold})`);

    const { data: staleSessions, error: fetchError } = await supabase
      .from('dialer_sessions')
      .select('*')
      .eq('status', 'active')
      .lt('last_heartbeat_at', staleThreshold);

    if (fetchError) {
      console.error('Error fetching stale sessions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stale sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staleSessions || staleSessions.length === 0) {
      console.log('No stale sessions found');
      return new Response(
        JSON.stringify({ success: true, message: 'No stale sessions', cleaned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${staleSessions.length} stale sessions to clean up`);

    const results = {
      cleaned: 0,
      callsEnded: 0,
      errors: 0,
    };

    for (const session of staleSessions) {
      try {
        // If there's an active Twilio call, try to end it
        if (session.current_call_sid && twilioAccountSid && twilioAuthToken) {
          console.log(`Ending abandoned call ${session.current_call_sid}`);
          const ended = await endTwilioCall(
            session.current_call_sid,
            twilioAccountSid,
            twilioAuthToken
          );
          if (ended) {
            results.callsEnded++;
          }
        }

        // Mark session as abandoned
        const { error: updateError } = await supabase
          .from('dialer_sessions')
          .update({
            status: 'abandoned',
            ended_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update session ${session.id}:`, updateError);
          results.errors++;
        } else {
          results.cleaned++;
        }

        // Notify the user about the abandoned session
        await supabase.from('notifications').insert({
          user_id: session.user_id,
          workspace_id: session.workspace_id,
          type: 'dialer_session_cleanup',
          title: 'Power Dialer Session Ended',
          message: `Your power dialer session was automatically ended due to inactivity. ${session.total_calls || 0} calls were made.`,
          data: {
            session_id: session.id,
            total_calls: session.total_calls,
          },
        });

      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
        results.errors++;
      }
    }

    console.log(`Cleanup complete. Cleaned: ${results.cleaned}, Calls ended: ${results.callsEnded}, Errors: ${results.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Cleanup dialer sessions error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
