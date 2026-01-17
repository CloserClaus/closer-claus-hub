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
        
        // Check if this is a one-time payment purchase (dialer or leads)
        if (session.mode === 'payment' && metadata.purchase_type) {
          const { purchase_type, workspace_id: purchaseWorkspaceId, minutes_amount, phone_number, country_code, number_type, monthly_cost, user_id, credits_amount, leads_amount, price_paid } = metadata;
          
          console.log('Processing purchase:', { purchase_type, workspace_id: purchaseWorkspaceId });
          
          // Handle lead credits purchase
          if (purchase_type === 'lead_credits' && credits_amount) {
            const creditsToAdd = parseInt(credits_amount);
            const leadsAmount = parseInt(leads_amount || '0');
            const pricePaid = parseFloat(price_paid || '0');
            
            // Get current lead credits balance
            const { data: currentCredits } = await supabase
              .from('lead_credits')
              .select('credits_balance')
              .eq('workspace_id', purchaseWorkspaceId)
              .single();
            
            const newBalance = (currentCredits?.credits_balance || 0) + creditsToAdd;
            
            // Upsert lead credits
            await supabase
              .from('lead_credits')
              .upsert({
                workspace_id: purchaseWorkspaceId,
                credits_balance: newBalance,
                last_purchased_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id' });
            
            // Log the purchase
            await supabase.from('lead_credit_purchases').insert({
              workspace_id: purchaseWorkspaceId,
              credits_amount: creditsToAdd,
              price_paid: pricePaid || (session.amount_total / 100),
              purchased_by: user_id,
              stripe_session_id: session.id,
            });
            
            console.log(`Added ${creditsToAdd} lead credits to workspace ${purchaseWorkspaceId}`);
            
            // Send notification
            if (user_id) {
              await supabase.from('notifications').insert({
                user_id,
                workspace_id: purchaseWorkspaceId,
                type: 'lead_credits_purchased',
                title: 'Lead Credits Purchased! 🎉',
                message: `Successfully added ${creditsToAdd} credits. You can now enrich ${leadsAmount} leads.`,
                data: { credits: creditsToAdd, leads: leadsAmount, amount: session.amount_total / 100 },
              });
            }
            
            break;
          }
          
          if (purchase_type === 'call_minutes' && minutes_amount) {
            // Add minutes to workspace credits
            const { data: currentCredits } = await supabase
              .from('workspace_credits')
              .select('credits_balance')
              .eq('workspace_id', purchaseWorkspaceId)
              .single();
            
            const newBalance = (currentCredits?.credits_balance || 0) + parseInt(minutes_amount);
            
            await supabase
              .from('workspace_credits')
              .upsert({
                workspace_id: purchaseWorkspaceId,
                credits_balance: newBalance,
                last_purchased_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id' });
            
            await supabase.from('credit_purchases').insert({
              workspace_id: purchaseWorkspaceId,
              credits_amount: parseInt(minutes_amount),
              price_paid: session.amount_total / 100,
              purchased_by: user_id,
              stripe_session_id: session.id,
            });
            
            console.log(`Added ${minutes_amount} minutes to workspace ${purchaseWorkspaceId}`);
            
            // Send notification
            if (user_id) {
              await supabase.from('notifications').insert({
                user_id,
                workspace_id: purchaseWorkspaceId,
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
                    workspace_id: purchaseWorkspaceId,
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
                      workspace_id: purchaseWorkspaceId,
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
            
            // Save the payment method for future auto-charges if available
            if (session.payment_intent) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                if (paymentIntent.payment_method) {
                  await supabase
                    .from('workspaces')
                    .update({ stripe_default_payment_method: paymentIntent.payment_method })
                    .eq('id', commWorkspaceId);
                  console.log(`Saved payment method from commission payment for workspace ${commWorkspaceId}`);
                }
              } catch (pmError) {
                console.error('Error saving payment method:', pmError);
              }
            }
            
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

          // Get subscription details to determine anchor day and save payment method
          let anchorDay = 1;
          let defaultPaymentMethod = null;
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              const anchorDate = new Date(subscription.current_period_end * 1000);
              anchorDay = Math.min(anchorDate.getDate(), 28); // Cap at 28 for all months
              console.log('Subscription anchor day:', anchorDay);
              
              // Retrieve the default payment method for future auto-charges
              if (subscription.default_payment_method) {
                defaultPaymentMethod = subscription.default_payment_method;
                console.log('Saved default payment method:', defaultPaymentMethod);
              }
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

          // Save the default payment method for automatic commission charging
          if (defaultPaymentMethod) {
            workspaceUpdate.stripe_default_payment_method = defaultPaymentMethod;
          }

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

          // Get commission details for SDR payout
          const { data: commission } = await supabase
            .from('commissions')
            .select('sdr_id, amount, sdr_payout_amount, workspace_id, deals(title)')
            .eq('id', commission_id)
            .single();
          
          const dealTitle = (commission?.deals as any)?.title || 'deal';

          // Trigger SDR payout if applicable
          if (commission?.sdr_id && (commission.sdr_payout_amount || commission.amount) > 0) {
            // Get SDR's Connect account status
            const { data: sdrProfile } = await supabase
              .from('profiles')
              .select('stripe_connect_account_id, stripe_connect_status')
              .eq('id', commission.sdr_id)
              .single();

            const sdrPayoutAmount = Number(commission.sdr_payout_amount || commission.amount);

            if (sdrProfile?.stripe_connect_status === 'active' && sdrProfile?.stripe_connect_account_id) {
              // Create transfer to SDR's Connect account
              try {
                const transfer = await stripe.transfers.create({
                  amount: Math.round(sdrPayoutAmount * 100), // Convert to cents
                  currency: 'usd',
                  destination: sdrProfile.stripe_connect_account_id,
                  description: `Commission for ${dealTitle}`,
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

                await supabase.from('notifications').insert({
                  user_id: commission.sdr_id,
                  workspace_id: commission.workspace_id,
                  type: 'payout_processing',
                  title: 'Payout Processing 💸',
                  message: `Your commission of $${sdrPayoutAmount.toFixed(2)} for "${dealTitle}" is being transferred to your bank.`,
                  data: { commission_id, amount: sdrPayoutAmount, transfer_id: transfer.id },
                });

                // Send payout processing email
                const { data: sdrEmailProfile } = await supabase
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', commission.sdr_id)
                  .single();

                if (sdrEmailProfile?.email) {
                  try {
                    await supabase.functions.invoke('send-payout-email', {
                      body: {
                        type: 'processing',
                        to_email: sdrEmailProfile.email,
                        to_name: sdrEmailProfile.full_name || 'SDR',
                        amount: sdrPayoutAmount,
                        deal_title: dealTitle,
                        agency_name: (commission as any)?.workspace?.name,
                      },
                    });
                  } catch (emailError) {
                    console.error('Failed to send payout processing email:', emailError);
                  }
                }

              } catch (transferError: any) {
                console.error('Transfer error:', transferError);
                
                // Mark payout as failed
                await supabase
                  .from('commissions')
                  .update({
                    sdr_payout_status: 'failed',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', commission_id);

                // Notify SDR of failure
                await supabase.from('notifications').insert({
                  user_id: commission.sdr_id,
                  workspace_id: commission.workspace_id,
                  type: 'payout_failed',
                  title: 'Payout Failed',
                  message: `There was an issue transferring your commission. Please check your bank account settings.`,
                  data: { commission_id, error: transferError.message },
                });

                // Send payout failed email
                const { data: failedEmailProfile } = await supabase
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', commission.sdr_id)
                  .single();

                if (failedEmailProfile?.email) {
                  try {
                    await supabase.functions.invoke('send-payout-email', {
                      body: {
                        type: 'failed',
                        to_email: failedEmailProfile.email,
                        to_name: failedEmailProfile.full_name || 'SDR',
                        amount: sdrPayoutAmount,
                        deal_title: dealTitle,
                        error_reason: transferError.message,
                      },
                    });
                  } catch (emailError) {
                    console.error('Failed to send payout failed email:', emailError);
                  }
                }
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

              // Notify SDR to connect bank
              await supabase.from('notifications').insert({
                user_id: commission.sdr_id,
                workspace_id: commission.workspace_id,
                type: 'connect_bank_prompt',
                title: 'Connect Bank to Receive $' + sdrPayoutAmount.toFixed(2),
                message: `Your commission of $${sdrPayoutAmount.toFixed(2)} is waiting! Connect your bank account in Settings to receive payouts.`,
                data: { commission_id, amount: sdrPayoutAmount },
              });

              // Send payout held email
              const { data: heldEmailProfile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', commission.sdr_id)
                .single();

              if (heldEmailProfile?.email) {
                try {
                  await supabase.functions.invoke('send-payout-email', {
                    body: {
                      type: 'held',
                      to_email: heldEmailProfile.email,
                      to_name: heldEmailProfile.full_name || 'SDR',
                      amount: sdrPayoutAmount,
                      deal_title: dealTitle,
                      agency_name: (commission as any)?.workspace?.name,
                    },
                  });
                } catch (emailError) {
                  console.error('Failed to send payout held email:', emailError);
                }
              }

              console.log(`Payout held for SDR ${commission.sdr_id} - no active Connect account`);
            }
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

      // Handle Stripe Connect account updates (SDR onboarding completion)
      case 'account.updated': {
        const account = event.data.object;
        const userId = account.metadata?.user_id;

        if (userId) {
          console.log(`Connect account ${account.id} updated for user ${userId}`);

          // Check if account is fully onboarded
          const isActive = account.charges_enabled && account.payouts_enabled;
          const newStatus = isActive ? 'active' : (account.details_submitted ? 'pending' : 'not_connected');

          // Update user's Connect status
          const updateData: any = {
            stripe_connect_status: newStatus,
          };

          if (isActive) {
            updateData.stripe_connect_onboarded_at = new Date().toISOString();
          }

          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating profile:', updateError);
          } else {
            console.log(`Updated Connect status to ${newStatus} for user ${userId}`);

            // If account just became active, check for held payouts
            if (isActive) {
              // Get any held commissions for this SDR
              const { data: heldCommissions } = await supabase
                .from('commissions')
                .select('id, sdr_payout_amount, amount, workspace_id, deals(title)')
                .eq('sdr_id', userId)
                .eq('status', 'paid')
                .eq('sdr_payout_status', 'held');

              if (heldCommissions && heldCommissions.length > 0) {
                console.log(`Processing ${heldCommissions.length} held payouts for user ${userId}`);

                for (const commission of heldCommissions) {
                  const payoutAmount = Number(commission.sdr_payout_amount || commission.amount);
                  const heldDealTitle = (commission.deals as any)?.title || 'deal';
                  
                  try {
                    const transfer = await stripe.transfers.create({
                      amount: Math.round(payoutAmount * 100),
                      currency: 'usd',
                      destination: account.id,
                      description: `Commission for ${heldDealTitle}`,
                      metadata: {
                        commission_id: commission.id,
                        sdr_id: userId,
                        workspace_id: commission.workspace_id,
                      },
                    });

                    await supabase
                      .from('commissions')
                      .update({
                        sdr_payout_status: 'processing',
                        sdr_payout_stripe_transfer_id: transfer.id,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', commission.id);

                    console.log(`Processed held payout for commission ${commission.id}: $${payoutAmount}`);
                  } catch (transferError: any) {
                    console.error(`Failed to process held payout for commission ${commission.id}:`, transferError);
                  }
                }

                // Notify SDR about processed payouts
                const totalAmount = heldCommissions.reduce((sum, c) => sum + Number(c.sdr_payout_amount || c.amount), 0);
                await supabase.from('notifications').insert({
                  user_id: userId,
                  type: 'payout_processing',
                  title: 'Payouts Processing! 💸',
                  message: `Your bank is connected! ${heldCommissions.length} held payout(s) totaling $${totalAmount.toFixed(2)} are now being transferred.`,
                  data: { count: heldCommissions.length, total: totalAmount },
                });
              } else {
                // Just notify about successful connection
                await supabase.from('notifications').insert({
                  user_id: userId,
                  type: 'bank_connected',
                  title: 'Bank Account Connected! ✓',
                  message: 'Your bank account is now connected. You\'ll receive commission payouts automatically.',
                });
              }
            }
          }
        }
        break;
      }

      // Handle transfer events for SDR payouts
      case 'transfer.paid': {
        const transfer = event.data.object;
        const { commission_id, sdr_id, workspace_id } = transfer.metadata || {};

        if (commission_id && sdr_id) {
          console.log(`Transfer ${transfer.id} paid for commission ${commission_id}`);

          // Get commission details for email
          const { data: paidCommission } = await supabase
            .from('commissions')
            .select('sdr_payout_amount, amount, deals(title)')
            .eq('id', commission_id)
            .single();

          // Update commission status to paid
          await supabase
            .from('commissions')
            .update({
              sdr_payout_status: 'paid',
              sdr_paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', commission_id);

          // Send notification
          const payoutAmount = paidCommission ? Number(paidCommission.sdr_payout_amount || paidCommission.amount) : transfer.amount / 100;
          const dealTitle = (paidCommission?.deals as any)?.title || 'deal';

          await supabase.from('notifications').insert({
            user_id: sdr_id,
            workspace_id: workspace_id || null,
            type: 'payout_paid',
            title: 'Payout Complete! 🎉',
            message: `$${payoutAmount.toFixed(2)} has been deposited to your bank account for "${dealTitle}".`,
            data: { commission_id, transfer_id: transfer.id, amount: payoutAmount },
          });

          // Send payout paid email
          const { data: paidProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', sdr_id)
            .single();

          if (paidProfile?.email) {
            try {
              await supabase.functions.invoke('send-payout-email', {
                body: {
                  type: 'paid',
                  to_email: paidProfile.email,
                  to_name: paidProfile.full_name || 'SDR',
                  amount: payoutAmount,
                  deal_title: dealTitle,
                  transfer_id: transfer.id,
                },
              });
              console.log(`Sent payout paid email to ${paidProfile.email}`);
            } catch (emailError) {
              console.error('Failed to send payout paid email:', emailError);
            }
          }
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object;
        const { commission_id, sdr_id } = transfer.metadata || {};

        if (commission_id) {
          console.log(`Transfer ${transfer.id} created for commission ${commission_id}`);
        }
        break;
      }

      case 'transfer.failed': {
        const transfer = event.data.object;
        const { commission_id, sdr_id, workspace_id } = transfer.metadata || {};

        if (commission_id && sdr_id) {
          console.log(`Transfer ${transfer.id} failed for commission ${commission_id}`);

          // Get commission details for email
          const { data: failedCommission } = await supabase
            .from('commissions')
            .select('sdr_payout_amount, amount, deals(title)')
            .eq('id', commission_id)
            .single();

          await supabase
            .from('commissions')
            .update({
              sdr_payout_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', commission_id);

          await supabase.from('notifications').insert({
            user_id: sdr_id,
            workspace_id: workspace_id || null,
            type: 'payout_failed',
            title: 'Payout Failed',
            message: 'There was an issue with your payout. Please check your bank account settings in the Payouts section.',
            data: { commission_id, transfer_id: transfer.id },
          });

          // Send payout failed email
          const { data: failedTransferProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', sdr_id)
            .single();

          if (failedTransferProfile?.email && failedCommission) {
            const payoutAmount = Number(failedCommission.sdr_payout_amount || failedCommission.amount);
            const dealTitle = (failedCommission.deals as any)?.title || 'deal';
            
            try {
              await supabase.functions.invoke('send-payout-email', {
                body: {
                  type: 'failed',
                  to_email: failedTransferProfile.email,
                  to_name: failedTransferProfile.full_name || 'SDR',
                  amount: payoutAmount,
                  deal_title: dealTitle,
                  error_reason: 'Transfer to your bank account failed',
                },
              });
            } catch (emailError) {
              console.error('Failed to send transfer failed email:', emailError);
            }
          }
        }
        break;
      }

      case 'payout.paid': {
        const payout = event.data.object;
        // This is when money actually hits the SDR's bank account
        // The payout object doesn't have our metadata, but we can log it
        console.log(`Payout ${payout.id} of $${payout.amount / 100} completed to bank`);
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
