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
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { commission_id } = await req.json();

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

    // Total amount = SDR commission + agency rake
    const totalAmount = Number(commission.amount) + Number(commission.agency_rake_amount || commission.rake_amount);
    console.log(`Processing payment of $${totalAmount} for commission ${commission_id}`);

    // Check if Stripe is configured
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'stripe_not_configured',
          message: 'Stripe is not configured. Please add STRIPE_API_KEY to enable payments.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get the origin for redirect URLs
    const origin = req.headers.get('origin') || 'https://closer-claus.lovable.app';
    const isAgencyClosed = commission.amount === 0;

    // Create a Stripe Checkout session
    try {
      const lineItems: any[] = [];

      // Add SDR commission line item if applicable
      if (!isAgencyClosed && commission.amount > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `SDR Commission - ${commission.deal?.title || 'Deal'}`,
              description: `Commission payment for SDR`,
            },
            unit_amount: Math.round(Number(commission.amount) * 100),
          },
          quantity: 1,
        });
      }

      // Add agency rake (platform fee)
      const agencyRake = Number(commission.agency_rake_amount || commission.rake_amount);
      if (agencyRake > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Platform Fee',
              description: `Closer Claus platform fee`,
            },
            unit_amount: Math.round(agencyRake * 100),
          },
          quantity: 1,
        });
      }

      // If no line items, nothing to pay
      if (lineItems.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No amount to pay' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: lineItems,
        success_url: `${origin}/commissions?payment=success&commission_id=${commission_id}`,
        cancel_url: `${origin}/commissions?payment=cancelled`,
        metadata: {
          commission_id: commission.id,
          workspace_id: commission.workspace_id,
          deal_id: commission.deal_id,
          type: 'commission_payment',
        },
      });

      console.log(`Created Stripe Checkout session ${session.id} for $${totalAmount}`);

      return new Response(
        JSON.stringify({
          success: true,
          checkout_url: session.url,
          session_id: session.id,
          amount: totalAmount,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in pay-commission:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
