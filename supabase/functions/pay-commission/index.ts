import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to trigger SDR payout after commission is paid
async function triggerSDRPayout(supabase: any, stripe: any, commission: any, commission_id: string) {
  if (!commission.sdr_id || (commission.sdr_payout_amount || commission.amount) <= 0) {
    return;
  }

  const sdrPayoutAmount = Number(commission.sdr_payout_amount || commission.amount);

  // Get SDR's Connect account status
  const { data: sdrProfile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_status')
    .eq('id', commission.sdr_id)
    .single();

  if (sdrProfile?.stripe_connect_status === 'active' && sdrProfile?.stripe_connect_account_id) {
    // Create transfer to SDR's Connect account
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(sdrPayoutAmount * 100),
        currency: 'usd',
        destination: sdrProfile.stripe_connect_account_id,
        description: `Commission for ${commission.deal?.title || 'deal'}`,
        metadata: {
          commission_id,
          sdr_id: commission.sdr_id,
          workspace_id: commission.workspace_id,
        },
      });

      console.log(`Created transfer ${transfer.id} to SDR ${commission.sdr_id} for $${sdrPayoutAmount}`);

      // Update commission with transfer info
      await supabase
        .from('commissions')
        .update({
          sdr_payout_status: 'processing',
          sdr_payout_stripe_transfer_id: transfer.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commission_id);

      // Notify SDR
      await supabase.from('notifications').insert({
        user_id: commission.sdr_id,
        workspace_id: commission.workspace_id,
        type: 'payout_processing',
        title: 'Payout Processing 💸',
        message: `Your commission of $${sdrPayoutAmount.toFixed(2)} for "${commission.deal?.title}" is being transferred to your bank.`,
        data: { commission_id, amount: sdrPayoutAmount, transfer_id: transfer.id },
      });

    } catch (transferError: any) {
      console.error('Transfer error:', transferError);
      
      await supabase
        .from('commissions')
        .update({
          sdr_payout_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', commission_id);

      await supabase.from('notifications').insert({
        user_id: commission.sdr_id,
        workspace_id: commission.workspace_id,
        type: 'payout_failed',
        title: 'Payout Failed',
        message: `There was an issue transferring your commission. Please check your bank account settings.`,
        data: { commission_id, error: transferError.message },
      });
    }
  } else {
    // SDR doesn't have active Connect account - hold payout
    await supabase
      .from('commissions')
      .update({
        sdr_payout_status: 'held',
        updated_at: new Date().toISOString(),
      })
      .eq('id', commission_id);

    await supabase.from('notifications').insert({
      user_id: commission.sdr_id,
      workspace_id: commission.workspace_id,
      type: 'connect_bank_prompt',
      title: 'Connect Bank to Receive $' + sdrPayoutAmount.toFixed(2),
      message: `Your commission is waiting! Connect your bank account in Settings to receive payouts.`,
      data: { commission_id, amount: sdrPayoutAmount },
    });

    console.log(`Payout held for SDR ${commission.sdr_id} - no active Connect account`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { commission_id, auto_charge } = await req.json();

    if (!commission_id) {
      return new Response(
        JSON.stringify({ error: 'commission_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the commission with workspace details including saved payment method
    const { data: commission, error: fetchError } = await supabase
      .from('commissions')
      .select(`
        *,
        workspace:workspaces(id, name, stripe_customer_id, stripe_default_payment_method, owner_id, is_locked),
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

    // Check if we should attempt auto-charge with saved payment method
    const savedPaymentMethod = commission.workspace?.stripe_default_payment_method;
    
    if (auto_charge && savedPaymentMethod && customerId) {
      console.log(`Attempting auto-charge for commission ${commission_id} with saved payment method`);
      
      try {
        // Calculate total in cents
        const amountInCents = Math.round(totalAmount * 100);
        
        // Create a PaymentIntent with the saved payment method (charges immediately)
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          customer: customerId,
          payment_method: savedPaymentMethod,
          off_session: true,
          confirm: true,
          description: `Commission payment for ${commission.deal?.title || 'Deal'}`,
          metadata: {
            commission_id: commission.id,
            workspace_id: commission.workspace_id,
            deal_id: commission.deal_id,
            type: 'commission_auto_charge',
          },
        });

        console.log(`PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded') {
          // Update commission as paid
          await supabase
            .from('commissions')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', commission_id);

          console.log(`Commission ${commission_id} auto-charged successfully`);

          // Trigger SDR payout
          await triggerSDRPayout(supabase, stripe, commission, commission_id);

          // Check if workspace should be unlocked
          const { data: pendingCommissions } = await supabase
            .from('commissions')
            .select('id')
            .eq('workspace_id', commission.workspace_id)
            .in('status', ['pending', 'overdue']);

          if (!pendingCommissions?.length) {
            await supabase
              .from('workspaces')
              .update({ is_locked: false })
              .eq('id', commission.workspace_id)
              .eq('is_locked', true);
            console.log(`Unlocked workspace ${commission.workspace_id}`);
          }

          return new Response(
            JSON.stringify({
              success: true,
              auto_charged: true,
              payment_intent_id: paymentIntent.id,
              amount: totalAmount,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Payment requires additional action (3D Secure)
        if (paymentIntent.status === 'requires_action') {
          console.log(`Payment for commission ${commission_id} requires 3D Secure`);
          return new Response(
            JSON.stringify({
              success: false,
              requires_action: true,
              message: 'Payment requires additional authentication. Manual payment required.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      } catch (autoChargeError: any) {
        console.error('Auto-charge error:', autoChargeError);
        
        // Handle specific error codes
        if (autoChargeError.code === 'authentication_required') {
          console.log('Card requires 3D Secure authentication');
          return new Response(
            JSON.stringify({
              success: false,
              requires_action: true,
              message: 'Card requires additional authentication. Manual payment required.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (autoChargeError.code === 'card_declined') {
          console.log('Card was declined');
          // Get workspace owner details for email
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', commission.workspace?.owner_id)
            .single();

          // Get payment method details for email
          let cardLast4 = '';
          if (savedPaymentMethod) {
            try {
              const pm = await stripe.paymentMethods.retrieve(savedPaymentMethod);
              cardLast4 = pm.card?.last4 || '';
            } catch (e) {
              console.error('Failed to retrieve payment method details:', e);
            }
          }

          // Notify workspace owner about failed payment via in-app notification
          if (commission.workspace?.owner_id) {
            await supabase.from('notifications').insert({
              user_id: commission.workspace.owner_id,
              workspace_id: commission.workspace_id,
              type: 'payment_failed',
              title: 'Payment Failed',
              message: `Automatic commission payment of $${totalAmount.toFixed(2)} was declined. Please update your payment method or pay manually.`,
              data: { commission_id, amount: totalAmount },
            });
          }

          // Send email notification about failed auto-charge
          if (ownerProfile) {
            try {
              await supabase.functions.invoke('send-commission-email', {
                body: {
                  type: 'auto_charge_failed',
                  to_email: ownerProfile.email,
                  to_name: ownerProfile.full_name || 'Agency Owner',
                  workspace_name: commission.workspace?.name || 'Your workspace',
                  amount: totalAmount,
                  deal_title: commission.deal?.title,
                  error_reason: 'Card was declined',
                  last4: cardLast4,
                },
              });
            } catch (emailError) {
              console.error('Failed to send auto-charge failure email:', emailError);
            }
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: 'card_declined',
              message: 'Card was declined. Manual payment required.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // For other errors, fall back to checkout session
        console.log('Auto-charge failed, falling back to checkout session');
      }
    }

    // Manual payment via Checkout Session
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

      // Save payment method during checkout for future auto-charges
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        payment_intent_data: {
          setup_future_usage: 'off_session',
        },
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