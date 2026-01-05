import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Get all workspaces with saved payment methods
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id, stripe_customer_id, stripe_default_payment_method')
      .not('stripe_default_payment_method', 'is', null)
      .not('stripe_customer_id', 'is', null);

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const notificationsSent = [];

    for (const workspace of workspaces || []) {
      try {
        // Get payment method details from Stripe
        const paymentMethod = await stripe.paymentMethods.retrieve(
          workspace.stripe_default_payment_method
        );

        if (paymentMethod.card) {
          const expMonth = paymentMethod.card.exp_month;
          const expYear = paymentMethod.card.exp_year;

          // Check if card expires this month or next month
          const expiresThisMonth = expYear === currentYear && expMonth === currentMonth;
          const expiresNextMonth = 
            (expYear === currentYear && expMonth === currentMonth + 1) ||
            (currentMonth === 12 && expYear === currentYear + 1 && expMonth === 1);

          if (expiresThisMonth || expiresNextMonth) {
            // Get workspace owner
            const { data: owner } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', workspace.owner_id)
              .single();

            if (owner) {
              // Create in-app notification
              await supabase.from('notifications').insert({
                user_id: workspace.owner_id,
                workspace_id: workspace.id,
                type: 'card_expiring',
                title: 'Payment Method Expiring Soon',
                message: `Your card ending in ${paymentMethod.card.last4} expires ${expiresThisMonth ? 'this month' : 'next month'}. Please update it to avoid payment failures.`,
                data: {
                  last4: paymentMethod.card.last4,
                  exp_month: expMonth,
                  exp_year: expYear,
                },
              });

              // Send email notification
              if (resendApiKey) {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Closer Claus <notifications@resend.dev>",
                    to: [owner.email],
                    subject: `Your payment method is expiring soon - ${workspace.name}`,
                    html: `
                      <h1>Payment Method Expiring</h1>
                      <p>Hi ${owner.full_name || 'there'},</p>
                      <p>Your payment method (card ending in <strong>${paymentMethod.card.last4}</strong>) for <strong>${workspace.name}</strong> is expiring ${expiresThisMonth ? 'this month' : 'next month'}.</p>
                      <p>Please update your payment method to avoid any interruption to your service and automatic commission payments.</p>
                      <p>You can update your payment method in Settings → Billing.</p>
                      <p>Best regards,<br>The Closer Claus Team</p>
                    `,
                  }),
                });
              }

              notificationsSent.push({
                workspace_id: workspace.id,
                workspace_name: workspace.name,
                last4: paymentMethod.card.last4,
                expires: `${expMonth}/${expYear}`,
              });

              console.log(`Notified ${owner.email} about expiring card for workspace ${workspace.name}`);
            }
          }
        }
      } catch (err) {
        console.error(`Error processing workspace ${workspace.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: notificationsSent.length,
        details: notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking expiring cards:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
