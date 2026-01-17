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

    const { job_id, application_id, sdr_user_id } = await req.json();

    if (!job_id || !application_id || !sdr_user_id) {
      return new Response(
        JSON.stringify({ error: 'job_id, application_id, and sdr_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing salary charge for job ${job_id}, application ${application_id}, SDR ${sdr_user_id}`);

    // Fetch job details with workspace
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        workspace:workspaces(id, name, owner_id, stripe_customer_id, stripe_default_payment_method)
      `)
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.employment_type !== 'salary') {
      return new Response(
        JSON.stringify({ error: 'This job is not a salary position' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!job.salary_amount || job.salary_amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'No salary amount specified for this job' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const salaryAmount = Number(job.salary_amount);
    const hiredAt = new Date();
    
    // Calculate payout date: same day next month
    const payoutDate = new Date(hiredAt);
    payoutDate.setMonth(payoutDate.getMonth() + 1);
    
    // Handle edge case: if hired on 31st and next month has fewer days
    // e.g., hired Jan 31 -> payout Feb 28
    if (payoutDate.getDate() !== hiredAt.getDate()) {
      payoutDate.setDate(0); // Last day of previous month
    }

    console.log(`Salary: $${salaryAmount}, Hired: ${hiredAt.toISOString()}, Payout date: ${payoutDate.toISOString()}`);

    // Create salary payment record
    const { data: salaryPayment, error: insertError } = await supabase
      .from('salary_payments')
      .insert({
        workspace_id: job.workspace_id,
        sdr_id: sdr_user_id,
        job_id: job_id,
        application_id: application_id,
        salary_amount: salaryAmount,
        sdr_payout_date: payoutDate.toISOString().split('T')[0],
        sdr_payout_amount: salaryAmount,
        hired_at: hiredAt.toISOString(),
        agency_charge_status: 'pending',
        sdr_payout_status: 'scheduled',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create salary payment record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create salary payment record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created salary payment record: ${salaryPayment.id}`);

    // Check if Stripe is configured
    if (!stripeSecretKey) {
      console.log('Stripe not configured - salary payment created but not charged');
      return new Response(
        JSON.stringify({
          success: true,
          salary_payment_id: salaryPayment.id,
          charged: false,
          message: 'Salary payment record created. Stripe not configured for charging.',
          payout_date: payoutDate.toISOString().split('T')[0],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Get or create Stripe customer
    let customerId = job.workspace?.stripe_customer_id;

    if (!customerId) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', job.workspace?.owner_id)
        .single();

      if (!ownerProfile) {
        return new Response(
          JSON.stringify({ error: 'Workspace owner not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await stripe.customers.create({
        email: ownerProfile.email,
        name: ownerProfile.full_name || job.workspace?.name,
        metadata: {
          workspace_id: job.workspace_id,
          workspace_name: job.workspace?.name,
        },
      });

      customerId = customer.id;

      await supabase
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', job.workspace_id);

      console.log(`Created Stripe customer ${customerId} for workspace ${job.workspace_id}`);
    }

    // Attempt to charge with saved payment method
    const savedPaymentMethod = job.workspace?.stripe_default_payment_method;
    
    if (savedPaymentMethod) {
      console.log(`Attempting auto-charge with saved payment method for salary payment ${salaryPayment.id}`);
      
      try {
        const amountInCents = Math.round(salaryAmount * 100);
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          customer: customerId,
          payment_method: savedPaymentMethod,
          off_session: true,
          confirm: true,
          description: `Salary payment for SDR - ${job.title}`,
          metadata: {
            salary_payment_id: salaryPayment.id,
            job_id: job_id,
            workspace_id: job.workspace_id,
            sdr_id: sdr_user_id,
            type: 'salary_charge',
          },
        });

        console.log(`PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded') {
          // Update salary payment as charged
          await supabase
            .from('salary_payments')
            .update({
              agency_charge_status: 'paid',
              agency_charged_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', salaryPayment.id);

          console.log(`Salary payment ${salaryPayment.id} charged successfully`);

          // Notify SDR about salary being secured
          await supabase.from('notifications').insert({
            user_id: sdr_user_id,
            workspace_id: job.workspace_id,
            type: 'salary_secured',
            title: 'Salary Secured! 🎉',
            message: `Your salary of $${salaryAmount.toFixed(2)} has been secured. Payout scheduled for ${payoutDate.toLocaleDateString()}.`,
            data: { salary_payment_id: salaryPayment.id, amount: salaryAmount, payout_date: payoutDate.toISOString() },
          });

          // Notify agency owner
          if (job.workspace?.owner_id) {
            await supabase.from('notifications').insert({
              user_id: job.workspace.owner_id,
              workspace_id: job.workspace_id,
              type: 'salary_charged',
              title: 'Salary Payment Processed',
              message: `Salary payment of $${salaryAmount.toFixed(2)} for new SDR hire was charged successfully.`,
              data: { salary_payment_id: salaryPayment.id, amount: salaryAmount, job_id },
            });
          }

          return new Response(
            JSON.stringify({
              success: true,
              salary_payment_id: salaryPayment.id,
              charged: true,
              payment_intent_id: paymentIntent.id,
              amount: salaryAmount,
              payout_date: payoutDate.toISOString().split('T')[0],
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Payment requires action (3D Secure)
        if (paymentIntent.status === 'requires_action') {
          console.log(`Salary payment requires 3D Secure authentication`);
          
          await supabase
            .from('salary_payments')
            .update({
              agency_charge_status: 'pending',
              updated_at: new Date().toISOString(),
            })
            .eq('id', salaryPayment.id);

          return new Response(
            JSON.stringify({
              success: false,
              salary_payment_id: salaryPayment.id,
              requires_action: true,
              message: 'Payment requires additional authentication.',
              payout_date: payoutDate.toISOString().split('T')[0],
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      } catch (chargeError: any) {
        console.error('Salary charge error:', chargeError);
        
        await supabase
          .from('salary_payments')
          .update({
            agency_charge_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', salaryPayment.id);

        // Notify agency owner about failed charge
        if (job.workspace?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: job.workspace.owner_id,
            workspace_id: job.workspace_id,
            type: 'salary_charge_failed',
            title: 'Salary Payment Failed',
            message: `Failed to charge salary payment of $${salaryAmount.toFixed(2)}. Please update your payment method.`,
            data: { salary_payment_id: salaryPayment.id, amount: salaryAmount, error: chargeError.message },
          });
        }

        return new Response(
          JSON.stringify({
            success: false,
            salary_payment_id: salaryPayment.id,
            error: 'charge_failed',
            message: chargeError.message || 'Failed to charge salary payment',
            payout_date: payoutDate.toISOString().split('T')[0],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No saved payment method - notify agency to add one
    console.log('No saved payment method - salary payment created but pending charge');
    
    if (job.workspace?.owner_id) {
      await supabase.from('notifications').insert({
        user_id: job.workspace.owner_id,
        workspace_id: job.workspace_id,
        type: 'salary_payment_pending',
        title: 'Salary Payment Required',
        message: `Please add a payment method to complete the salary payment of $${salaryAmount.toFixed(2)} for your new SDR hire.`,
        data: { salary_payment_id: salaryPayment.id, amount: salaryAmount, job_id },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        salary_payment_id: salaryPayment.id,
        charged: false,
        message: 'Salary payment created. Payment method required.',
        payout_date: payoutDate.toISOString().split('T')[0],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in charge-salary:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
