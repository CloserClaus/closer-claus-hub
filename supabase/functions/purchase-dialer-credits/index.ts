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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Stripe secret can be stored under different names depending on configuration
    const stripeApiKey = (
      Deno.env.get('STRIPE_API_KEY') ??
      Deno.env.get('STRIPE_SECRET_KEY') ??
      Deno.env.get('STRIPE_SECRET')
    )?.trim();

    console.log('Stripe key present:', !!stripeApiKey);

    if (!stripeApiKey) {
      console.error('Stripe API key not configured (expected STRIPE_API_KEY)');
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
    const { purchase_type, workspace_id, minutes, price, phone_number, country_code, number_type } = body;

    console.log('Purchase request:', { purchase_type, workspace_id, minutes, price, phone_number });

    if (!purchase_type || !workspace_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: purchase_type and workspace_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify user has access to this workspace
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

    // Check if user is owner or member
    const isOwner = workspace.owner_id === user.id;
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .single();

    if (!isOwner && !membership) {
      return new Response(
        JSON.stringify({ error: 'You do not have access to this workspace' }),
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

      // Save customer ID to workspace (using service role for this update)
      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabaseAdmin
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);
    }

    // Build the checkout session based on purchase type
    let lineItems: any[] = [];
    let metadata: Record<string, string> = {
      purchase_type,
      workspace_id,
      user_id: user.id,
    };

    const origin = req.headers.get('origin') || 'https://xlgzxmzejlshsgeiidsz.lovableproject.com';

    if (purchase_type === 'call_minutes') {
      if (!minutes || !price) {
        return new Response(
          JSON.stringify({ error: 'Missing minutes or price for call_minutes purchase' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${minutes} Calling Minutes`,
            description: `One-time purchase of ${minutes} calling minutes for your dialer`,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      }];

      metadata.minutes_amount = String(minutes);
      metadata.price_paid = String(price);

    } else if (purchase_type === 'phone_number') {
      if (!phone_number || !country_code) {
        return new Response(
          JSON.stringify({ error: 'Missing phone_number or country_code for phone_number purchase' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Pricing with 20% margin: Local $1.40/mo, Toll-free $2.60/mo
      const monthlyPrice = number_type === 'toll_free' ? 2.60 : 1.40;

      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Phone Number: ${phone_number}`,
            description: `${number_type === 'toll_free' ? 'Toll-Free' : 'Local'} number - First month`,
          },
          unit_amount: Math.round(monthlyPrice * 100),
        },
        quantity: 1,
      }];

      metadata.phone_number = phone_number;
      metadata.country_code = country_code;
      metadata.number_type = number_type || 'local';
      metadata.monthly_cost = String(monthlyPrice);

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid purchase_type. Must be "call_minutes" or "phone_number"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: lineItems,
      metadata,
      success_url: `${origin}/dialer?purchase=success&type=${purchase_type}`,
      cancel_url: `${origin}/dialer?purchase=cancelled`,
      payment_intent_data: {
        metadata, // Also add metadata to payment intent for webhook handling
      },
    });

    console.log('Stripe checkout session created:', session.id);

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in purchase-dialer-credits:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
