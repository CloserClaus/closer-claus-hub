import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TODO: Add Stripe integration
    // const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    // const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

    const { commission_id, payment_method } = await req.json();

    if (!commission_id) {
      return new Response(
        JSON.stringify({ error: 'commission_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the commission with workspace details
    const { data: commission, error: fetchError } = await supabase
      .from('commissions')
      .select(`
        *,
        workspace:workspaces(id, name, stripe_customer_id, owner_id, is_locked)
      `)
      .eq('id', commission_id)
      .single();

    if (fetchError || !commission) {
      return new Response(
        JSON.stringify({ error: 'Commission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (commission.status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Commission is already paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalAmount = commission.amount + commission.rake_amount;

    // TODO: Implement Stripe payment when API key is added
    // if (stripe && payment_method === 'stripe') {
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: Math.round(totalAmount * 100),
    //     currency: 'usd',
    //     customer: commission.workspace?.stripe_customer_id,
    //     confirm: true,
    //     automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    //     metadata: {
    //       commission_id: commission.id,
    //       workspace_id: commission.workspace_id,
    //       deal_id: commission.deal_id,
    //     },
    //   });
    //
    //   if (paymentIntent.status === 'succeeded') {
    //     // Update commission as paid
    //     await supabase
    //       .from('commissions')
    //       .update({
    //         status: 'paid',
    //         paid_at: new Date().toISOString(),
    //         stripe_payment_intent_id: paymentIntent.id,
    //       })
    //       .eq('id', commission_id);
    //
    //     // Check if workspace should be unlocked
    //     const { data: pendingCommissions } = await supabase
    //       .from('commissions')
    //       .select('id')
    //       .eq('workspace_id', commission.workspace_id)
    //       .eq('status', 'pending');
    //
    //     if (!pendingCommissions?.length && commission.workspace?.is_locked) {
    //       await supabase
    //         .from('workspaces')
    //         .update({ is_locked: false })
    //         .eq('id', commission.workspace_id);
    //     }
    //
    //     return new Response(
    //       JSON.stringify({
    //         success: true,
    //         payment_intent_id: paymentIntent.id,
    //         amount_charged: totalAmount,
    //       }),
    //       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    //     );
    //   }
    // }

    // For now, return that Stripe is not configured
    console.log(`Would charge $${totalAmount} for commission ${commission_id}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Stripe integration pending. Use manual payment for now.',
        commission_id,
        amount: totalAmount,
        stripe_enabled: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in pay-commission:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
