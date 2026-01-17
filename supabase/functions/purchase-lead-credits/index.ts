import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lead credit packages: $1 = 5 credits, 5 credits = 1 lead
const CREDIT_PACKAGES = [
  { credits: 100, price: 20, leads: 20 },   // $20 for 100 credits (20 leads)
  { credits: 250, price: 50, leads: 50 },   // $50 for 250 credits (50 leads)
  { credits: 500, price: 100, leads: 100 }, // $100 for 500 credits (100 leads)
  { credits: 1000, price: 200, leads: 200 }, // $200 for 1000 credits (200 leads)
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const stripeApiKey = (
      Deno.env.get('STRIPE_API_KEY') ??
      Deno.env.get('STRIPE_SECRET_KEY')
    )?.trim();

    console.log('Stripe key present:', !!stripeApiKey);

    if (!stripeApiKey) {
      console.error('Stripe API key not configured');
      return new Response(
        JSON.stringify({ error: 'stripe_not_configured', message: 'Stripe API key is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const body = await req.json();
    const { workspace_id, credits_amount } = body;

    console.log('Lead credits purchase request:', { workspace_id, credits_amount });

    if (!workspace_id || !credits_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: workspace_id and credits_amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate credits amount against packages
    const selectedPackage = CREDIT_PACKAGES.find(pkg => pkg.credits === credits_amount);
    if (!selectedPackage) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid credits amount. Available packages: 100, 250, 500, 1000 credits',
          available_packages: CREDIT_PACKAGES 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify user has access to this workspace (must be owner)
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id, stripe_customer_id')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace error:', workspaceError);
      return new Response(
        JSON.stringify({ error: 'Workspace not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Only workspace owner can purchase lead credits
    if (workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only workspace owner can purchase lead credits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Dynamic import of Stripe
    const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
    const stripe = new Stripe(stripeApiKey, { apiVersion: '2023-10-16' });

    // Get or create Stripe customer
    let customerId = workspace.stripe_customer_id;
    
    if (!customerId) {
      // Get user profile for email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: {
          workspace_id: workspace_id,
          workspace_name: workspace.name,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to workspace
      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabaseAdmin
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);
    }

    const origin = req.headers.get('origin') || 'https://xlgzxmzejlshsgeiidsz.lovableproject.com';

    const metadata = {
      purchase_type: 'lead_credits',
      workspace_id,
      user_id: user.id,
      credits_amount: String(selectedPackage.credits),
      leads_amount: String(selectedPackage.leads),
      price_paid: String(selectedPackage.price),
    };

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${selectedPackage.leads} Lead Credits`,
            description: `Purchase ${selectedPackage.credits} credits to enrich ${selectedPackage.leads} leads with full contact data (email & phone)`,
          },
          unit_amount: Math.round(selectedPackage.price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      metadata,
      success_url: `${origin}/leads?purchase=success&credits=${selectedPackage.credits}`,
      cancel_url: `${origin}/leads?purchase=cancelled`,
      payment_intent_data: {
        metadata,
      },
    });

    console.log('Stripe checkout session created for lead credits:', session.id);

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id,
        package: selectedPackage,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in purchase-lead-credits:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
