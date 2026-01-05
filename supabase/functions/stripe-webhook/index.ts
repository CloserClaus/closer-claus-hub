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
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!stripeSecretKey) {
      console.error('STRIPE_API_KEY not configured');
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
        const metadata = session.metadata || {};
        
        // Check if this is a dialer purchase (one-time payment)
        if (session.mode === 'payment' && metadata.purchase_type) {
          const { purchase_type, workspace_id: dialerWorkspaceId, minutes_amount, phone_number, country_code, number_type, monthly_cost, user_id } = metadata;
          
          console.log('Processing dialer purchase:', { purchase_type, workspace_id: dialerWorkspaceId });
          
          if (purchase_type === 'call_minutes' && minutes_amount) {
            // Add minutes to workspace credits
            const { data: currentCredits } = await supabase
              .from('workspace_credits')
              .select('credits_balance')
              .eq('workspace_id', dialerWorkspaceId)
              .single();
            
            const newBalance = (currentCredits?.credits_balance || 0) + parseInt(minutes_amount);
            
            await supabase
              .from('workspace_credits')
              .upsert({
                workspace_id: dialerWorkspaceId,
                credits_balance: newBalance,
                last_purchased_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id' });
            
            await supabase.from('credit_purchases').insert({
              workspace_id: dialerWorkspaceId,
              credits_amount: parseInt(minutes_amount),
              price_paid: session.amount_total / 100,
              purchased_by: user_id,
              stripe_session_id: session.id,
            });
            
            console.log(`Added ${minutes_amount} minutes to workspace ${dialerWorkspaceId}`);
            
            // Send notification
            if (user_id) {
              await supabase.from('notifications').insert({
                user_id,
                workspace_id: dialerWorkspaceId,
                type: 'credits_purchased',
                title: 'Credits Purchased',
                message: `Successfully added ${minutes_amount} calling minutes to your account.`,
                data: { minutes: parseInt(minutes_amount), amount: session.amount_total / 100 },
              });
            }
          }
          
          if (purchase_type === 'phone_number' && phone_number) {
            // Purchase and provision the phone number via Twilio
            const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
            const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
            
            if (twilioAccountSid && twilioAuthToken) {
              try {
                const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
                
                // Purchase the number from Twilio
                const purchaseResponse = await fetch(
                  `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Basic ${twilioAuth}`,
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                      PhoneNumber: phone_number,
                    }),
                  }
                );
                
                if (purchaseResponse.ok) {
                  const purchasedNumber = await purchaseResponse.json();
                  
                  await supabase.from('workspace_phone_numbers').insert({
                    workspace_id: dialerWorkspaceId,
                    phone_number: purchasedNumber.phone_number,
                    country_code: country_code || 'US',
                    twilio_phone_sid: purchasedNumber.sid,
                    monthly_cost: parseFloat(monthly_cost || '1.40'),
                    is_active: true,
                  });
                  
                  console.log(`Phone number ${phone_number} purchased and provisioned`);
                  
                  if (user_id) {
                    await supabase.from('notifications').insert({
                      user_id,
                      workspace_id: dialerWorkspaceId,
                      type: 'phone_number_purchased',
                      title: 'Phone Number Purchased',
                      message: `Your new phone number ${phone_number} is now active.`,
                      data: { phone_number },
                    });
                  }
                } else {
                  console.error('Failed to purchase Twilio number:', await purchaseResponse.text());
                }
              } catch (twilioError) {
                console.error('Twilio error:', twilioError);
              }
            }
          }
          
          break;
        }

        // Handle commission payment checkout
        if (session.mode === 'payment' && metadata.type === 'commission_payment') {
          const { commission_id, workspace_id: commWorkspaceId, deal_id } = metadata;
          
          console.log('Processing commission payment:', { commission_id, workspace_id: commWorkspaceId });
          
          // Update commission as paid
          const { data: commission, error: updateError } = await supabase
            .from('commissions')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent,
            })
            .eq('id', commission_id)
            .select('*, deal:deals(title)')
            .single();
          
          if (updateError) {
            console.error('Error updating commission:', updateError);
          } else {
            console.log(`Commission ${commission_id} marked as paid`);
            
            // Check if workspace should be unlocked
            const { data: pendingCommissions } = await supabase
              .from('commissions')
              .select('id')
              .eq('workspace_id', commWorkspaceId)
              .eq('status', 'pending');
            
            if (!pendingCommissions?.length) {
              await supabase
                .from('workspaces')
                .update({ is_locked: false })
                .eq('id', commWorkspaceId)
                .eq('is_locked', true);
              console.log(`Unlocked workspace ${commWorkspaceId}`);
            }
            
            // Notify SDR if commission amount > 0 (meaning SDR was involved)
            if (commission && commission.amount > 0 && commission.sdr_id) {
              await supabase.from('notifications').insert({
                user_id: commission.sdr_id,
                workspace_id: commWorkspaceId,
                type: 'commission_paid',
                title: 'Commission Paid! 💰',
                message: `Your commission of $${Number(commission.sdr_payout_amount || commission.amount).toFixed(2)} for "${commission.deal?.title}" has been paid.`,
                data: { 
                  commission_id, 
                  amount: commission.sdr_payout_amount || commission.amount,
                  deal_title: commission.deal?.title 
                },
              });
            }
          }
          
          break;
        }

        // Handle subscription checkout
        const { workspace_id, tier, billing_period, coupon_code, coupon_id, discount_percentage, is_first_subscription } = metadata;

        if (workspace_id && tier) {
          const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];

          // Get subscription details to determine anchor day
          let anchorDay = 1;
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              const anchorDate = new Date(subscription.current_period_end * 1000);
              anchorDay = Math.min(anchorDate.getDate(), 28); // Cap at 28 for all months
              console.log('Subscription anchor day:', anchorDay);
            } catch (subError) {
              console.error('Error fetching subscription:', subError);
            }
          }

          // Calculate next free minutes reset date
          const nextResetDate = new Date();
          nextResetDate.setMonth(nextResetDate.getMonth() + 1);
          nextResetDate.setDate(anchorDay);

          // Build workspace update - include first_subscription_at if this is a first-time subscription
          const workspaceUpdate: any = {
            subscription_tier: tier,
            subscription_status: 'active',
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            max_sdrs: limits?.max_sdrs || 1,
            rake_percentage: limits?.rake_percentage || 2.0,
            subscription_anchor_day: anchorDay,
            is_locked: false,
            updated_at: new Date().toISOString(),
          };

          // Set first_subscription_at if this is the first subscription
          if (is_first_subscription === 'true') {
            workspaceUpdate.first_subscription_at = new Date().toISOString();
            console.log(`Recording first subscription for workspace ${workspace_id}`);
          }

          await supabase
            .from('workspaces')
            .update(workspaceUpdate)
            .eq('id', workspace_id);

          console.log(`Activated ${tier} subscription for workspace ${workspace_id}`);

          // Initialize or update free minutes for the subscriber
          await supabase
            .from('workspace_credits')
            .upsert({
              workspace_id,
              free_minutes_remaining: 1000,
              free_minutes_reset_at: nextResetDate.toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'workspace_id' });

          console.log(`Initialized 1000 free minutes for workspace ${workspace_id}`);

          // Get workspace owner for notification
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('owner_id, name')
            .eq('id', workspace_id)
            .single();

          if (workspace?.owner_id) {
            await supabase.from('notifications').insert({
              user_id: workspace.owner_id,
              workspace_id,
              type: 'subscription_activated',
              title: 'Subscription Activated',
              message: `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan is now active! You have 1000 free calling minutes this month.`,
              data: { tier, maxSdrs: limits?.max_sdrs },
            });
          }

          // Record coupon redemption after successful payment
          if (coupon_id && discount_percentage) {
            const discountValue = parseFloat(discount_percentage);
            if (discountValue > 0) {
              // Record redemption
              await supabase
                .from('coupon_redemptions')
                .insert({
                  coupon_id,
                  workspace_id,
                  discount_applied: discountValue,
                });

              // Increment coupon usage
              const { data: currentCoupon } = await supabase
                .from('coupons')
                .select('current_uses')
                .eq('id', coupon_id)
                .single();

              if (currentCoupon) {
                await supabase
                  .from('coupons')
                  .update({ current_uses: (currentCoupon.current_uses || 0) + 1 })
                  .eq('id', coupon_id);
              }

              console.log(`Recorded coupon redemption for ${coupon_code} after successful payment`);
            }
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
            .update({ 
              subscription_status: status,
              updated_at: new Date().toISOString(),
            })
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
              updated_at: new Date().toISOString(),
            })
            .eq('id', workspace.id);

          console.log(`Cancelled subscription for workspace ${workspace.id}`);

          if (workspace.owner_id) {
            await supabase.from('notifications').insert({
              user_id: workspace.owner_id,
              workspace_id: workspace.id,
              type: 'subscription_cancelled',
              title: 'Subscription Cancelled',
              message: 'Your subscription has been cancelled. Please resubscribe to continue using premium features.',
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log(`Invoice ${invoice.id} paid successfully`);
        
        // Only reset free minutes for subscription renewals
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, subscription_anchor_day, owner_id')
            .eq('stripe_subscription_id', invoice.subscription)
            .single();
          
          if (workspace) {
            // Calculate next reset date based on anchor day
            const nextReset = new Date();
            nextReset.setMonth(nextReset.getMonth() + 1);
            nextReset.setDate(Math.min(workspace.subscription_anchor_day || 1, 28));
            
            await supabase
              .from('workspace_credits')
              .update({
                free_minutes_remaining: 1000,
                free_minutes_reset_at: nextReset.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('workspace_id', workspace.id);
            
            console.log(`Reset 1000 free minutes for workspace ${workspace.id} (subscription renewal)`);
            
            // Send notification
            if (workspace.owner_id) {
              await supabase.from('notifications').insert({
                user_id: workspace.owner_id,
                workspace_id: workspace.id,
                type: 'free_minutes_reset',
                title: 'Free Minutes Renewed',
                message: 'Your 1000 free calling minutes have been renewed for this billing cycle!',
              });
            }
          }
        }
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
            .update({ 
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', workspace.id);

          if (workspace.owner_id) {
            await supabase.from('notifications').insert({
              user_id: workspace.owner_id,
              workspace_id: workspace.id,
              type: 'payment_failed',
              title: 'Payment Failed',
              message: 'Your subscription payment failed. Please update your payment method to avoid service interruption.',
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
              updated_at: new Date().toISOString(),
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
            await supabase.from('notifications').insert({
              user_id: commission.sdr_id,
              workspace_id: commission.workspace_id,
              type: 'commission_paid',
              title: 'Commission Paid',
              message: `Your commission of $${Number(commission.amount).toFixed(2)} has been paid!`,
              data: { commission_id, amount: commission.amount },
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
              .update({ 
                is_locked: false,
                updated_at: new Date().toISOString(),
              })
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
