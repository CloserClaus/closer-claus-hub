import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Tier limits mapping
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event;

    // Verify webhook signature if secret is configured
    if (stripeWebhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Parse event without verification (development mode)
      event = JSON.parse(body);
      console.warn('Webhook signature verification skipped - STRIPE_WEBHOOK_SECRET not configured');
    }

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { workspace_id, tier, billing_period } = session.metadata || {};

        if (workspace_id && tier) {
          const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];

          await supabase
            .from('workspaces')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              stripe_subscription_id: session.subscription,
              max_sdrs: limits?.max_sdrs || 1,
              rake_percentage: limits?.rake_percentage || 2.0,
            })
            .eq('id', workspace_id);

          console.log(`Activated ${tier} subscription for workspace ${workspace_id}`);

          // Get workspace owner for notification
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('owner_id, name')
            .eq('id', workspace_id)
            .single();

          if (workspace?.owner_id) {
            await supabase.functions.invoke('create-notification', {
              body: {
                user_id: workspace.owner_id,
                title: 'Subscription Activated',
                message: `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan is now active!`,
                type: 'subscription_activated',
                workspace_id,
              },
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Find workspace by subscription ID
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id, owner_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (workspace) {
          const status = subscription.status === 'active' ? 'active' : subscription.status;
          
          await supabase
            .from('workspaces')
            .update({ subscription_status: status })
            .eq('id', workspace.id);

          console.log(`Updated subscription status to ${status} for workspace ${workspace.id}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id, owner_id, name')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (workspace) {
          await supabase
            .from('workspaces')
            .update({
              subscription_status: 'cancelled',
              stripe_subscription_id: null,
            })
            .eq('id', workspace.id);

          console.log(`Cancelled subscription for workspace ${workspace.id}`);

          if (workspace.owner_id) {
            await supabase.functions.invoke('create-notification', {
              body: {
                user_id: workspace.owner_id,
                title: 'Subscription Cancelled',
                message: 'Your subscription has been cancelled. Please resubscribe to continue using premium features.',
                type: 'subscription_cancelled',
                workspace_id: workspace.id,
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log(`Invoice ${invoice.id} paid successfully`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find workspace by customer ID
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id, owner_id, name')
          .eq('stripe_customer_id', customerId)
          .single();

        if (workspace) {
          await supabase
            .from('workspaces')
            .update({ subscription_status: 'past_due' })
            .eq('id', workspace.id);

          if (workspace.owner_id) {
            await supabase.functions.invoke('create-notification', {
              body: {
                user_id: workspace.owner_id,
                title: 'Payment Failed',
                message: 'Your subscription payment failed. Please update your payment method to avoid service interruption.',
                type: 'payment_failed',
                workspace_id: workspace.id,
              },
            });
          }

          console.log(`Payment failed for workspace ${workspace.id}`);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { commission_id } = paymentIntent.metadata || {};

        if (commission_id) {
          // Update commission as paid
          await supabase
            .from('commissions')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', commission_id);

          console.log(`Commission ${commission_id} marked as paid via webhook`);

          // Get commission details for notification
          const { data: commission } = await supabase
            .from('commissions')
            .select('sdr_id, amount, workspace_id, deal:deals(title)')
            .eq('id', commission_id)
            .single();

          if (commission?.sdr_id) {
            await supabase.functions.invoke('create-notification', {
              body: {
                user_id: commission.sdr_id,
                title: 'Commission Paid',
                message: `Your commission of $${Number(commission.amount).toFixed(2)} has been paid!`,
                type: 'commission_paid',
                workspace_id: commission.workspace_id,
              },
            });
          }

          // Check if workspace should be unlocked
          const { data: pendingCommissions } = await supabase
            .from('commissions')
            .select('id')
            .eq('workspace_id', commission?.workspace_id)
            .in('status', ['pending', 'overdue']);

          if (!pendingCommissions?.length) {
            await supabase
              .from('workspaces')
              .update({ is_locked: false })
              .eq('id', commission?.workspace_id)
              .eq('is_locked', true);

            console.log(`Unlocked workspace ${commission?.workspace_id}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in stripe-webhook:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
