import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REFERRAL_CREDITS = 500;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { referral_code, referred_user_id, workspace_id } = await req.json();

    console.log('Processing referral:', { referral_code, referred_user_id, workspace_id });

    if (!referral_code || !referred_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing referral_code or referred_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the referrer by their referral code
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('referral_code', referral_code)
      .single();

    if (referrerError || !referrer) {
      console.log('Invalid referral code:', referral_code);
      return new Response(
        JSON.stringify({ error: 'Invalid referral code', success: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't allow self-referrals
    if (referrer.id === referred_user_id) {
      console.log('Self-referral attempted');
      return new Response(
        JSON.stringify({ error: 'Self-referral not allowed', success: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this user was already referred
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', referred_user_id)
      .single();

    if (existingReferral) {
      console.log('User already referred');
      return new Response(
        JSON.stringify({ error: 'User already referred', success: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the referral record
    const { data: referral, error: createError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_user_id: referred_user_id,
        referral_code: referral_code,
        status: 'completed',
        credits_awarded: REFERRAL_CREDITS,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating referral:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create referral', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Award lead credits to the referrer
    // First, find their workspace (they must have one to receive credits)
    const { data: referrerWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', referrer.id)
      .single();

    if (referrerWorkspace) {
      // Check if they have a lead_credits record
      const { data: existingCredits } = await supabase
        .from('lead_credits')
        .select('id, credits_balance')
        .eq('workspace_id', referrerWorkspace.id)
        .single();

      if (existingCredits) {
        // Update existing credits
        await supabase
          .from('lead_credits')
          .update({
            credits_balance: existingCredits.credits_balance + REFERRAL_CREDITS,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCredits.id);
      } else {
        // Create new credits record
        await supabase
          .from('lead_credits')
          .insert({
            workspace_id: referrerWorkspace.id,
            credits_balance: REFERRAL_CREDITS,
          });
      }

      console.log(`Awarded ${REFERRAL_CREDITS} lead credits to referrer ${referrer.id}`);

      // Create notification for the referrer
      await supabase
        .from('notifications')
        .insert({
          user_id: referrer.id,
          workspace_id: referrerWorkspace.id,
          type: 'referral_completed',
          title: 'Referral Completed! 🎉',
          message: `You earned ${REFERRAL_CREDITS} lead credits from a referral!`,
          data: {
            credits_awarded: REFERRAL_CREDITS,
            referral_id: referral.id,
          },
        });
    } else {
      console.log('Referrer has no workspace, credits will be applied when they create one');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        referral_id: referral.id,
        credits_awarded: REFERRAL_CREDITS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing referral:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
