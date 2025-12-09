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

        // Initiate call via CallHippo API
        const callResponse = await fetch(`${CALLHIPPO_BASE_URL}/call/initiate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: phoneNumber,
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
        if (callId && CALLHIPPO_API_KEY) {
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

        if (!CALLHIPPO_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'API key not configured', configured: false }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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

      case 'get_available_numbers': {
        const { countryCode = 'US' } = params;

        if (!CALLHIPPO_API_KEY) {
          // Return mock data when API key not configured
          console.log('Returning mock phone numbers - API key not configured');
          return new Response(
            JSON.stringify({ 
              configured: false,
              numbers: [
                { id: 'mock-1', number: '+1 (555) 123-4567', country: 'US', monthly_cost: 5.99, type: 'local' },
                { id: 'mock-2', number: '+1 (555) 234-5678', country: 'US', monthly_cost: 5.99, type: 'local' },
                { id: 'mock-3', number: '+1 (800) 555-0123', country: 'US', monthly_cost: 12.99, type: 'toll-free' },
              ]
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const numbersResponse = await fetch(`${CALLHIPPO_BASE_URL}/numbers/available?country=${countryCode}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
          },
        });

        const numbersData = await numbersResponse.json();

        return new Response(
          JSON.stringify({ configured: true, numbers: numbersData }),
          { status: numbersResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'purchase_number': {
        const { numberId, workspaceId, phoneNumber, monthlyCost, countryCode } = params;

        if (!CALLHIPPO_API_KEY) {
          // Mock purchase when API key not configured
          console.log('Mock number purchase - API key not configured');
          
          const { data: insertedNumber, error: insertError } = await supabase
            .from('workspace_phone_numbers')
            .insert({
              workspace_id: workspaceId,
              phone_number: phoneNumber,
              country_code: countryCode || 'US',
              monthly_cost: monthlyCost || 0,
              callhippo_number_id: numberId,
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error saving phone number:', insertError);
            return new Response(
              JSON.stringify({ error: 'Failed to save phone number' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, configured: false, number: insertedNumber }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const purchaseResponse = await fetch(`${CALLHIPPO_BASE_URL}/numbers/purchase`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CALLHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ number_id: numberId }),
        });

        const purchaseData = await purchaseResponse.json();

        if (!purchaseResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to purchase number', details: purchaseData }),
            { status: purchaseResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Save to database
        const { data: insertedNumber, error: insertError } = await supabase
          .from('workspace_phone_numbers')
          .insert({
            workspace_id: workspaceId,
            phone_number: phoneNumber,
            country_code: countryCode || 'US',
            monthly_cost: monthlyCost || 0,
            callhippo_number_id: purchaseData.id || numberId,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving phone number:', insertError);
        }

        return new Response(
          JSON.stringify({ success: true, configured: true, number: insertedNumber }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'purchase_credits': {
        const { workspaceId, creditsAmount, pricePaid } = params;

        if (!workspaceId || !creditsAmount) {
          return new Response(
            JSON.stringify({ error: 'Workspace ID and credits amount required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log the purchase
        const { error: purchaseError } = await supabase
          .from('credit_purchases')
          .insert({
            workspace_id: workspaceId,
            credits_amount: creditsAmount,
            price_paid: pricePaid || 0,
            purchased_by: user.id,
          });

        if (purchaseError) {
          console.error('Error logging credit purchase:', purchaseError);
          return new Response(
            JSON.stringify({ error: 'Failed to log purchase' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update or create credits balance
        const { data: existingCredits } = await supabase
          .from('workspace_credits')
          .select('*')
          .eq('workspace_id', workspaceId)
          .single();

        if (existingCredits) {
          const { error: updateError } = await supabase
            .from('workspace_credits')
            .update({
              credits_balance: existingCredits.credits_balance + creditsAmount,
              last_purchased_at: new Date().toISOString(),
            })
            .eq('workspace_id', workspaceId);

          if (updateError) {
            console.error('Error updating credits:', updateError);
          }
        } else {
          const { error: insertError } = await supabase
            .from('workspace_credits')
            .insert({
              workspace_id: workspaceId,
              credits_balance: creditsAmount,
              last_purchased_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error inserting credits:', insertError);
          }
        }

        // Get updated balance
        const { data: updatedCredits } = await supabase
          .from('workspace_credits')
          .select('*')
          .eq('workspace_id', workspaceId)
          .single();

        return new Response(
          JSON.stringify({ success: true, credits: updatedCredits }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_credits': {
        const { workspaceId } = params;

        if (!workspaceId) {
          return new Response(
            JSON.stringify({ error: 'Workspace ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: credits, error } = await supabase
          .from('workspace_credits')
          .select('*')
          .eq('workspace_id', workspaceId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching credits:', error);
        }

        return new Response(
          JSON.stringify({ credits: credits || { credits_balance: 0 } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
