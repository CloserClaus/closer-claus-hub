import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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

    const today = new Date().toISOString().split('T')[0];
    console.log(`Processing salary payouts for date: ${today}`);

    // Find all salary payments that are:
    // 1. Agency has paid (agency_charge_status = 'paid')
    // 2. Payout is scheduled (sdr_payout_status = 'scheduled')
    // 3. Payout date is today or earlier
    const { data: duePayouts, error: fetchError } = await supabase
      .from('salary_payments')
      .select(`
        *,
        job:jobs(title),
        workspace:workspaces(name)
      `)
      .eq('agency_charge_status', 'paid')
      .eq('sdr_payout_status', 'scheduled')
      .lte('sdr_payout_date', today);

    if (fetchError) {
      console.error('Error fetching due payouts:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch due payouts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!duePayouts || duePayouts.length === 0) {
      console.log('No salary payouts due today');
      return new Response(
        JSON.stringify({ success: true, message: 'No salary payouts due', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${duePayouts.length} salary payouts due`);

    if (!stripeSecretKey) {
      console.log('Stripe not configured - cannot process payouts');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'stripe_not_configured',
          message: 'Stripe not configured for payouts',
          pending_payouts: duePayouts.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      held: 0,
      details: [] as any[],
    };

    for (const payout of duePayouts) {
      results.processed++;
      const payoutAmount = Number(payout.sdr_payout_amount || payout.salary_amount);
      
      console.log(`Processing payout ${payout.id} for SDR ${payout.sdr_id}: $${payoutAmount}`);

      try {
        // Get SDR's Connect account
        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('stripe_connect_account_id, stripe_connect_status, email, full_name')
          .eq('id', payout.sdr_id)
          .single();

        if (sdrProfile?.stripe_connect_status === 'active' && sdrProfile?.stripe_connect_account_id) {
          // Create transfer to SDR's Connect account
          const transfer = await stripe.transfers.create({
            amount: Math.round(payoutAmount * 100),
            currency: 'usd',
            destination: sdrProfile.stripe_connect_account_id,
            description: `Salary payment for ${payout.job?.title || 'position'}`,
            metadata: {
              salary_payment_id: payout.id,
              sdr_id: payout.sdr_id,
              workspace_id: payout.workspace_id,
              type: 'salary_payout',
            },
          });

          console.log(`Created transfer ${transfer.id} to SDR ${payout.sdr_id} for $${payoutAmount}`);

          // Update salary payment as paid
          await supabase
            .from('salary_payments')
            .update({
              sdr_payout_status: 'paid',
              sdr_paid_at: new Date().toISOString(),
              sdr_stripe_transfer_id: transfer.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payout.id);

          // Notify SDR
          await supabase.from('notifications').insert({
            user_id: payout.sdr_id,
            workspace_id: payout.workspace_id,
            type: 'salary_paid',
            title: 'Salary Paid! 💰',
            message: `Your salary of $${payoutAmount.toFixed(2)} has been transferred to your bank account.`,
            data: { salary_payment_id: payout.id, amount: payoutAmount, transfer_id: transfer.id },
          });

          results.successful++;
          results.details.push({ id: payout.id, status: 'paid', transfer_id: transfer.id });

        } else {
          // SDR doesn't have active Connect account - hold payout
          console.log(`SDR ${payout.sdr_id} doesn't have active Connect account - holding payout`);

          await supabase
            .from('salary_payments')
            .update({
              sdr_payout_status: 'held',
              updated_at: new Date().toISOString(),
            })
            .eq('id', payout.id);

          // Prompt SDR to connect bank
          await supabase.from('notifications').insert({
            user_id: payout.sdr_id,
            workspace_id: payout.workspace_id,
            type: 'connect_bank_prompt',
            title: 'Connect Bank to Receive $' + payoutAmount.toFixed(2),
            message: `Your salary payment is waiting! Connect your bank account in Settings to receive it.`,
            data: { salary_payment_id: payout.id, amount: payoutAmount },
          });

          results.held++;
          results.details.push({ id: payout.id, status: 'held', reason: 'No Connect account' });
        }

      } catch (payoutError: any) {
        console.error(`Payout error for ${payout.id}:`, payoutError);

        await supabase
          .from('salary_payments')
          .update({
            sdr_payout_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.id);

        await supabase.from('notifications').insert({
          user_id: payout.sdr_id,
          workspace_id: payout.workspace_id,
          type: 'salary_payout_failed',
          title: 'Salary Payout Failed',
          message: `There was an issue with your salary payment. Our team will investigate.`,
          data: { salary_payment_id: payout.id, error: payoutError.message },
        });

        results.failed++;
        results.details.push({ id: payout.id, status: 'failed', error: payoutError.message });
      }
    }

    console.log(`Payout processing complete. Successful: ${results.successful}, Failed: ${results.failed}, Held: ${results.held}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-salary-payouts:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
