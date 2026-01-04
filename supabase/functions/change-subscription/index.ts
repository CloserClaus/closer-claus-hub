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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    
    console.log('STRIPE_API_KEY exists:', !!stripeSecretKey);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, new_tier, proration_behavior = 'create_prorations' } = await req.json();

    if (!workspace_id || !new_tier) {
      return new Response(
        JSON.stringify({ error: 'workspace_id and new_tier are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tier
    if (!['omega', 'beta', 'alpha'].includes(new_tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier. Must be omega, beta, or alpha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch workspace with current subscription
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

    // Check if workspace has active subscription
    if (!workspace.stripe_subscription_id || workspace.subscription_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'No active subscription to modify. Please subscribe first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already on this tier
    if (workspace.subscription_tier === new_tier) {
      return new Response(
        JSON.stringify({ error: 'Already subscribed to this plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check SDR limit for downgrades
    const newLimits = TIER_LIMITS[new_tier as keyof typeof TIER_LIMITS];
    const { count: sdrCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .is('removed_at', null);

    if ((sdrCount || 0) > newLimits.max_sdrs) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot downgrade: you have ${sdrCount} SDRs but ${new_tier} plan only allows ${newLimits.max_sdrs}. Remove SDRs first.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if Stripe is configured
    if (!stripeSecretKey) {
      console.error('STRIPE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payments are not configured', code: 'stripe_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Retrieve the current subscription
    const subscription = await stripe.subscriptions.retrieve(workspace.stripe_subscription_id);
    
    if (!subscription || subscription.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Subscription is not active in Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the current subscription item
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      return new Response(
        JSON.stringify({ error: 'Could not find subscription item' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the billing interval from current subscription
    const currentInterval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
    const pricing = TIER_PRICING[new_tier as keyof typeof TIER_PRICING];
    const amount = currentInterval === 'year' ? pricing.yearly : pricing.monthly;

    console.log(`Changing subscription for workspace ${workspace_id} from ${workspace.subscription_tier} to ${new_tier}`);
    console.log(`Current interval: ${currentInterval}, new price: $${amount / 100}`);

    // Update the subscription with proration
    // Stripe will automatically calculate prorated charges/credits
    const updatedSubscription = await stripe.subscriptions.update(workspace.stripe_subscription_id, {
      items: [{
        id: subscriptionItemId,
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${new_tier.charAt(0).toUpperCase() + new_tier.slice(1)} Plan`,
            description: `Up to ${newLimits.max_sdrs} SDR${newLimits.max_sdrs > 1 ? 's' : ''}, ${newLimits.rake_percentage}% platform fee`,
          },
          unit_amount: amount,
          recurring: {
            interval: currentInterval as 'month' | 'year',
          },
        },
      }],
      proration_behavior: proration_behavior, // 'create_prorations' | 'none' | 'always_invoice'
      metadata: {
        workspace_id,
        tier: new_tier,
        previous_tier: workspace.subscription_tier,
        changed_at: new Date().toISOString(),
      },
    });

    // Calculate proration preview for user feedback
    const prorationDate = Math.floor(Date.now() / 1000);
    let prorationPreview = null;
    
    try {
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: workspace.stripe_customer_id,
        subscription: workspace.stripe_subscription_id,
      });
      
      prorationPreview = {
        amount_due: invoice.amount_due / 100,
        next_payment_date: new Date(invoice.next_payment_attempt! * 1000).toISOString(),
        lines: invoice.lines.data.map((line: { description: string | null; amount: number }) => ({
          description: line.description,
          amount: line.amount / 100,
        })),
      };
    } catch (previewError) {
      console.log('Could not generate proration preview:', previewError);
    }

    // Update workspace in database
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        subscription_tier: new_tier,
        max_sdrs: newLimits.max_sdrs,
        rake_percentage: newLimits.rake_percentage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspace_id);

    if (updateError) {
      console.error('Error updating workspace:', updateError);
      // Note: Stripe subscription was already updated, so we log this but don't fail
    }

    // Send notification to workspace owner
    await supabase.from('notifications').insert({
      user_id: workspace.owner_id,
      workspace_id,
      type: 'subscription_changed',
      title: 'Plan Changed',
      message: `Your subscription has been ${amount > (TIER_PRICING[workspace.subscription_tier as keyof typeof TIER_PRICING]?.[currentInterval === 'year' ? 'yearly' : 'monthly'] || 0) ? 'upgraded' : 'downgraded'} to ${new_tier.charAt(0).toUpperCase() + new_tier.slice(1)}. Prorated charges will be applied to your next invoice.`,
      data: {
        previous_tier: workspace.subscription_tier,
        new_tier,
        proration: prorationPreview,
      },
    });

    console.log(`Successfully changed subscription to ${new_tier} for workspace ${workspace_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        new_tier,
        proration: prorationPreview,
        message: `Successfully changed to ${new_tier.charAt(0).toUpperCase() + new_tier.slice(1)} plan`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in change-subscription:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
