import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating Stripe Connect account for user: ${user.id}`);

    // Check if user already has a Connect account
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_status, email, full_name")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_connect_account_id && profile?.stripe_connect_status !== 'not_connected') {
      console.log(`User already has Connect account: ${profile.stripe_connect_account_id}`);
      
      // Create a new onboarding link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_connect_account_id,
        refresh_url: `${req.headers.get("origin")}/settings?connect_refresh=true`,
        return_url: `${req.headers.get("origin")}/settings?connect_success=true`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({ 
        account_id: profile.stripe_connect_account_id,
        onboarding_url: accountLink.url,
        status: profile.stripe_connect_status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      email: profile?.email || user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        user_id: user.id,
      },
    });

    console.log(`Created Stripe Connect account: ${account.id}`);

    // Update user profile with the Connect account ID
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stripe_connect_account_id: account.id,
        stripe_connect_status: "pending",
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw updateError;
    }

    // Create account onboarding link
    const { return_url } = await req.json().catch(() => ({}));
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: return_url || `${req.headers.get("origin")}/settings?connect_refresh=true`,
      return_url: return_url || `${req.headers.get("origin")}/settings?connect_success=true`,
      type: "account_onboarding",
    });

    console.log(`Created onboarding link for account: ${account.id}`);

    return new Response(JSON.stringify({ 
      account_id: account.id,
      onboarding_url: accountLink.url,
      status: "pending",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error creating Connect account:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
