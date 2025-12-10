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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        workspace:workspaces(id, name, stripe_customer_id, owner_id, is_locked),
        deal:deals(title, value)
      `)
      .eq('id', commission_id)
      .single();

    if (fetchError || !commission) {
      console.error('Error fetching commission:', fetchError);
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

    const totalAmount = Number(commission.amount) + Number(commission.rake_amount);
    console.log(`Processing payment of $${totalAmount} for commission ${commission_id}`);

    // Check if Stripe is configured
    if (stripeSecretKey && payment_method === 'stripe') {
      // Dynamic import of Stripe
      const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });

      // Check if workspace has a Stripe customer
      let customerId = commission.workspace?.stripe_customer_id;

      if (!customerId) {
        // Get workspace owner email
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', commission.workspace?.owner_id)
          .single();

        if (!ownerProfile) {
          return new Response(
            JSON.stringify({ error: 'Workspace owner not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: ownerProfile.email,
          name: ownerProfile.full_name || commission.workspace?.name,
          metadata: {
            workspace_id: commission.workspace_id,
            workspace_name: commission.workspace?.name,
          },
        });

        customerId = customer.id;

        // Save customer ID to workspace
        await supabase
          .from('workspaces')
          .update({ stripe_customer_id: customerId })
          .eq('id', commission.workspace_id);

        console.log(`Created Stripe customer ${customerId} for workspace ${commission.workspace_id}`);
      }

      // Create payment intent
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalAmount * 100), // Convert to cents
          currency: 'usd',
          customer: customerId,
          metadata: {
            commission_id: commission.id,
            workspace_id: commission.workspace_id,
            deal_id: commission.deal_id,
            deal_title: commission.deal?.title || 'Unknown Deal',
          },
          description: `Commission payment for deal: ${commission.deal?.title || commission.deal_id}`,
        });

        console.log(`Created payment intent ${paymentIntent.id} for $${totalAmount}`);

        // If payment intent requires action (e.g., 3D Secure), return client secret
        if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
          return new Response(
            JSON.stringify({
              success: false,
              requires_action: true,
              client_secret: paymentIntent.client_secret,
              payment_intent_id: paymentIntent.id,
              amount: totalAmount,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If payment succeeded immediately
        if (paymentIntent.status === 'succeeded') {
          // Update commission as paid
          await supabase
            .from('commissions')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', commission_id);

          // Check if workspace should be unlocked
          const { data: pendingCommissions } = await supabase
            .from('commissions')
            .select('id')
            .eq('workspace_id', commission.workspace_id)
            .eq('status', 'pending');

          if (!pendingCommissions?.length && commission.workspace?.is_locked) {
            await supabase
              .from('workspaces')
              .update({ is_locked: false })
              .eq('id', commission.workspace_id);
            console.log(`Unlocked workspace ${commission.workspace_id}`);
          }

          // Create notification for SDR
          await supabase.functions.invoke('create-notification', {
            body: {
              user_id: commission.sdr_id,
              title: 'Commission Paid',
              message: `Your commission of $${commission.amount.toFixed(2)} for "${commission.deal?.title}" has been paid.`,
              type: 'commission_paid',
              workspace_id: commission.workspace_id,
            },
          });

          return new Response(
            JSON.stringify({
              success: true,
              payment_intent_id: paymentIntent.id,
              amount_charged: totalAmount,
              status: 'paid',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            payment_intent_id: paymentIntent.id,
            status: paymentIntent.status,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (stripeError: any) {
        console.error('Stripe payment error:', stripeError);
        return new Response(
          JSON.stringify({ 
            error: stripeError.message || 'Payment failed',
            code: stripeError.code,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Stripe not configured - return info for manual payment
    console.log(`Stripe not configured. Manual payment required for $${totalAmount}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Stripe integration not configured. Please add STRIPE_SECRET_KEY to enable automatic payments.',
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
