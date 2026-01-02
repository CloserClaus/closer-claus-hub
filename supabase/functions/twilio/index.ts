import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twilio API base URL
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioApiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const twilioApiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twilioTwimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log(`Twilio action: ${action}`, params);

    // Helper function for Twilio API calls
    const twilioFetch = async (endpoint: string, method: string = 'GET', body?: URLSearchParams) => {
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      if (body) {
        options.body = body.toString();
      }
      const response = await fetch(`${TWILIO_API_BASE}/Accounts/${twilioAccountSid}${endpoint}`, options);
      return response.json();
    };

    switch (action) {
      case 'get_access_token': {
        // Generate access token for Twilio Client SDK (browser calling)
        if (!twilioApiKeySid || !twilioApiKeySecret) {
          return new Response(
            JSON.stringify({ error: 'Twilio API keys not configured for browser calling' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate JWT for Twilio Voice SDK
        const identity = user.id;
        const twimlAppSid = params.twiml_app_sid || twilioTwimlAppSid || '';

        // Create a simple JWT token for Twilio Voice
        // In production, you'd use a proper JWT library
        const now = Math.floor(Date.now() / 1000);
        const exp = now + 3600; // 1 hour expiry

        const header = { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' };
        const payload = {
          jti: `${twilioApiKeySid}-${now}`,
          iss: twilioApiKeySid,
          sub: twilioAccountSid,
          exp: exp,
          grants: {
            identity: identity,
            voice: {
              incoming: { allow: true },
              outgoing: { application_sid: twimlAppSid }
            }
          }
        };

        // Base64URL encode
        const base64url = (obj: any) => {
          const str = JSON.stringify(obj);
          const base64 = btoa(str);
          return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        };

        const headerB64 = base64url(header);
        const payloadB64 = base64url(payload);
        const signatureInput = `${headerB64}.${payloadB64}`;
        
        // HMAC-SHA256 signature using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(twilioApiKeySecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const accessToken = `${headerB64}.${payloadB64}.${signatureB64}`;

        return new Response(
          JSON.stringify({ token: accessToken, identity }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'initiate_call': {
        const { to_number, from_number, workspace_id, lead_id, webhook_url } = params;

        if (!to_number || !from_number || !workspace_id) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create the call via Twilio REST API
        const callParams = new URLSearchParams();
        callParams.append('To', to_number);
        callParams.append('From', from_number);
        // TwiML for connecting the call
        callParams.append('Twiml', `<Response><Dial>${to_number}</Dial></Response>`);
        
        if (webhook_url) {
          callParams.append('StatusCallback', webhook_url);
          callParams.append('StatusCallbackEvent', 'initiated ringing answered completed');
          callParams.append('StatusCallbackMethod', 'POST');
        }
        
        // Enable recording if requested
        if (params.record) {
          callParams.append('Record', 'true');
          callParams.append('RecordingStatusCallback', webhook_url);
          callParams.append('RecordingStatusCallbackMethod', 'POST');
        }

        const callResult = await twilioFetch('/Calls.json', 'POST', callParams);
        console.log('Twilio call initiated:', callResult);

        if (callResult.sid) {
          // Log the call in the database
          const { data: callLog, error: logError } = await supabase
            .from('call_logs')
            .insert({
              workspace_id,
              caller_id: user.id,
              phone_number: to_number,
              lead_id: lead_id || null,
              call_status: 'initiated',
              twilio_call_sid: callResult.sid,
            })
            .select()
            .single();

          if (logError) {
            console.error('Error logging call:', logError);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              call_sid: callResult.sid,
              call_log_id: callLog?.id,
              status: callResult.status
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('Twilio call failed:', callResult);
          return new Response(
            JSON.stringify({ error: callResult.message || 'Failed to initiate call' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'end_call': {
        const { call_sid, call_log_id, notes } = params;

        if (!call_sid) {
          return new Response(
            JSON.stringify({ error: 'Missing call_sid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update call status to completed
        const endParams = new URLSearchParams();
        endParams.append('Status', 'completed');
        
        const endResult = await twilioFetch(`/Calls/${call_sid}.json`, 'POST', endParams);
        console.log('Call ended:', endResult);

        // Update the call log
        if (call_log_id) {
          const updateData: any = {
            call_status: 'completed',
            ended_at: new Date().toISOString(),
          };
          if (notes) {
            updateData.notes = notes;
          }

          await supabase
            .from('call_logs')
            .update(updateData)
            .eq('id', call_log_id);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_status': {
        const { call_sid } = params;

        if (!call_sid) {
          return new Response(
            JSON.stringify({ error: 'Missing call_sid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const callInfo = await twilioFetch(`/Calls/${call_sid}.json`);
        
        return new Response(
          JSON.stringify({ 
            status: callInfo.status,
            duration: callInfo.duration,
            direction: callInfo.direction,
            answered_by: callInfo.answered_by
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_available_numbers': {
        const { country = 'US', area_code, contains } = params;

        let endpoint = `/AvailablePhoneNumbers/${country}/Local.json?`;
        const searchParams = new URLSearchParams();
        
        if (area_code) {
          searchParams.append('AreaCode', area_code);
        }
        if (contains) {
          searchParams.append('Contains', contains);
        }
        searchParams.append('VoiceEnabled', 'true');

        const numbersResult = await twilioFetch(`/AvailablePhoneNumbers/${country}/Local.json?${searchParams.toString()}`);
        
        const numbers = (numbersResult.available_phone_numbers || []).map((num: any) => ({
          phone_number: num.phone_number,
          friendly_name: num.friendly_name,
          locality: num.locality,
          region: num.region,
          country: num.iso_country,
          capabilities: num.capabilities,
          monthly_cost: 1.15, // Twilio local number base price
        }));

        return new Response(
          JSON.stringify({ numbers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'purchase_number': {
        const { phone_number, workspace_id } = params;

        if (!phone_number || !workspace_id) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Purchase the number via Twilio
        const purchaseParams = new URLSearchParams();
        purchaseParams.append('PhoneNumber', phone_number);
        purchaseParams.append('VoiceMethod', 'POST');
        
        const purchaseResult = await twilioFetch('/IncomingPhoneNumbers.json', 'POST', purchaseParams);
        console.log('Number purchased:', purchaseResult);

        if (purchaseResult.sid) {
          // Save to database
          const { data: phoneNumber, error: saveError } = await supabase
            .from('workspace_phone_numbers')
            .insert({
              workspace_id,
              phone_number: purchaseResult.phone_number,
              twilio_phone_sid: purchaseResult.sid,
              country_code: purchaseResult.phone_number.substring(0, 2),
              city: purchaseResult.locality || null,
              monthly_cost: 1.15,
              is_active: true,
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving phone number:', saveError);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              phone_number: purchaseResult.phone_number,
              phone_sid: purchaseResult.sid,
              id: phoneNumber?.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ error: purchaseResult.message || 'Failed to purchase number' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'release_number': {
        const { phone_sid, phone_number_id } = params;

        if (!phone_sid) {
          return new Response(
            JSON.stringify({ error: 'Missing phone_sid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Release the number via Twilio
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        const response = await fetch(
          `${TWILIO_API_BASE}/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${phone_sid}.json`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${auth}` },
          }
        );

        if (response.ok) {
          // Update database
          if (phone_number_id) {
            await supabase
              .from('workspace_phone_numbers')
              .update({ is_active: false })
              .eq('id', phone_number_id);
          }

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const error = await response.json();
          return new Response(
            JSON.stringify({ error: error.message || 'Failed to release number' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get_workspace_numbers': {
        const { workspace_id } = params;

        const { data: numbers, error } = await supabase
          .from('workspace_phone_numbers')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('is_active', true);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ numbers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'purchase_credits': {
        const { workspace_id, credits_amount, price_paid } = params;

        if (!workspace_id || !credits_amount || !price_paid) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log the purchase
        const { error: purchaseError } = await supabase
          .from('credit_purchases')
          .insert({
            workspace_id,
            credits_amount,
            price_paid,
            purchased_by: user.id,
          });

        if (purchaseError) {
          console.error('Error logging credit purchase:', purchaseError);
        }

        // Update workspace credits balance
        const { data: existingCredits } = await supabase
          .from('workspace_credits')
          .select('*')
          .eq('workspace_id', workspace_id)
          .single();

        if (existingCredits) {
          await supabase
            .from('workspace_credits')
            .update({
              credits_balance: existingCredits.credits_balance + credits_amount,
              last_purchased_at: new Date().toISOString(),
            })
            .eq('workspace_id', workspace_id);
        } else {
          await supabase
            .from('workspace_credits')
            .insert({
              workspace_id,
              credits_balance: credits_amount,
              last_purchased_at: new Date().toISOString(),
            });
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_credits': {
        const { workspace_id } = params;

        const { data: credits } = await supabase
          .from('workspace_credits')
          .select('credits_balance')
          .eq('workspace_id', workspace_id)
          .single();

        return new Response(
          JSON.stringify({ credits_balance: credits?.credits_balance || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_recordings': {
        const { call_sid } = params;

        if (!call_sid) {
          return new Response(
            JSON.stringify({ error: 'Missing call_sid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const recordings = await twilioFetch(`/Calls/${call_sid}/Recordings.json`);
        
        return new Response(
          JSON.stringify({ 
            recordings: (recordings.recordings || []).map((r: any) => ({
              sid: r.sid,
              duration: r.duration,
              url: `https://api.twilio.com${r.uri.replace('.json', '.mp3')}`,
              created_at: r.date_created,
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Twilio function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
