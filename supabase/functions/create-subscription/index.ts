import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subscription tier pricing (in cents)
const TIER_PRICING = {
  omega: { monthly: 24700, yearly: 249700 },
  beta: { monthly: 34700, yearly: 349700 },
  alpha: { monthly: 49700, yearly: 499700 },
};

const TIER_LIMITS = {
  omega: { max_sdrs: 1, rake_percentage: 2.0 },
  beta: { max_sdrs: 2, rake_percentage: 1.5 },
  alpha: { max_sdrs: 5, rake_percentage: 1.0 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Diagnostic logging for secrets
    const envVars = Object.keys(Deno.env.toObject());
    console.log('Available env vars:', envVars.join(', '));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    
    console.log('SUPABASE_URL exists:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
    console.log('STRIPE_API_KEY exists:', !!stripeSecretKey);
    if (stripeSecretKey) {
      console.log('STRIPE_API_KEY length:', stripeSecretKey.length);
      console.log('STRIPE_API_KEY starts with sk_:', stripeSecretKey.startsWith('sk_'));
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, tier, billing_period, success_url, cancel_url } = await req.json();

    if (!workspace_id || !tier || !billing_period) {
      return new Response(
        JSON.stringify({ error: 'workspace_id, tier, and billing_period are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tier
    if (!['omega', 'beta', 'alpha'].includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier. Must be omega, beta, or alpha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('Error fetching workspace:', workspaceError);
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner profile separately if the join didn't work
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', workspace.owner_id)
      .single();

    const pricing = TIER_PRICING[tier as keyof typeof TIER_PRICING];
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
    const amount = billing_period === 'yearly' ? pricing.yearly : pricing.monthly;

    // Check if Stripe is configured
    if (!stripeSecretKey) {
      console.error('STRIPE_API_KEY not configured for create-subscription');
      return new Response(
        JSON.stringify({
          error: 'Payments are not configured. Please try again later.',
          code: 'stripe_not_configured',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Stripe enabled for create-subscription: ${String(!!stripeSecretKey)} (len=${stripeSecretKey.length})`);

    const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Get or create Stripe customer
    let customerId = workspace.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerProfile?.email || '',
        name: ownerProfile?.full_name || workspace.name,
        metadata: {
          workspace_id: workspace.id,
          workspace_name: workspace.name,
        },
      });

      customerId = customer.id;

      await supabase
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);

      console.log(`Created Stripe customer ${customerId}`);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
              description: `Up to ${limits.max_sdrs} SDR${limits.max_sdrs > 1 ? 's' : ''}, ${limits.rake_percentage}% platform fee`,
            },
            unit_amount: amount,
            recurring: {
              interval: billing_period === 'yearly' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: success_url || `${req.headers.get('origin')}/dashboard?subscription=success`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/subscription?cancelled=true`,
      metadata: {
        workspace_id,
        tier,
        billing_period,
      },
    });

    console.log(`Created checkout session ${session.id} for workspace ${workspace_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-subscription:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
