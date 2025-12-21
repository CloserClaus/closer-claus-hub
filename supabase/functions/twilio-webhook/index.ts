import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the form data from Twilio webhook
    const formData = await req.formData();
    const webhookData: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value as string;
    }

    console.log('Twilio webhook received:', webhookData);

    const callSid = webhookData.CallSid;
    const callStatus = webhookData.CallStatus;
    const callDuration = webhookData.CallDuration;
    const recordingSid = webhookData.RecordingSid;
    const recordingUrl = webhookData.RecordingUrl;
    const recordingStatus = webhookData.RecordingStatus;

    // Handle call status updates
    if (callSid && callStatus) {
      console.log(`Call ${callSid} status: ${callStatus}`);

      // Map Twilio status to our status
      const statusMap: Record<string, string> = {
        'queued': 'initiated',
        'ringing': 'ringing',
        'in-progress': 'in_progress',
        'completed': 'completed',
        'busy': 'busy',
        'failed': 'failed',
        'no-answer': 'no_answer',
        'canceled': 'canceled',
      };

      const mappedStatus = statusMap[callStatus] || callStatus;

      const updateData: Record<string, any> = {
        call_status: mappedStatus,
      };

      // Add duration if call completed
      if (callStatus === 'completed' && callDuration) {
        updateData.duration_seconds = parseInt(callDuration);
        updateData.ended_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('call_logs')
        .update(updateData)
        .eq('twilio_call_sid', callSid);

      if (error) {
        console.error('Error updating call log:', error);
      }
    }

    // Handle recording completed
    if (recordingSid && recordingStatus === 'completed' && recordingUrl) {
      console.log(`Recording ${recordingSid} completed for call ${callSid}`);

      // The recording URL from Twilio
      const fullRecordingUrl = `${recordingUrl}.mp3`;

      const { error } = await supabase
        .from('call_logs')
        .update({ recording_url: fullRecordingUrl })
        .eq('twilio_call_sid', callSid);

      if (error) {
        console.error('Error updating recording URL:', error);
      }
    }

    // Return TwiML response if needed (for incoming calls)
    if (webhookData.Direction === 'inbound') {
      // Simple response for inbound calls - can be customized
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Please hold while we connect you.</Say>
  <Dial timeout="30">
    <!-- Add routing logic here -->
  </Dial>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
      });
    }

    // Return empty TwiML for status callbacks
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
    );
  } catch (error: unknown) {
    console.error('Twilio webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
