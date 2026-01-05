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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, limit = 10 } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace with Stripe customer ID
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workspace.stripe_customer_id) {
      return new Response(
        JSON.stringify({ invoices: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { default: Stripe } = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: workspace.stripe_customer_id,
      limit: limit,
      status: 'paid',
    });

    // Also fetch payment intents for one-time payments (commissions)
    const paymentIntents = await stripe.paymentIntents.list({
      customer: workspace.stripe_customer_id,
      limit: limit,
    });

    // Format invoices
    const formattedInvoices = invoices.data.map((invoice: any) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100,
      status: invoice.status,
      created: invoice.created * 1000,
      paid_at: invoice.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : null,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      description: invoice.lines?.data?.[0]?.description || 'Subscription payment',
      type: 'subscription',
    }));

    // Format payment intents (commissions)
    const formattedPayments = paymentIntents.data
      .filter((pi: any) => pi.status === 'succeeded' && pi.metadata?.type?.includes('commission'))
      .map((pi: any) => ({
        id: pi.id,
        number: null,
        amount: pi.amount / 100,
        status: 'paid',
        created: pi.created * 1000,
        paid_at: pi.created * 1000,
        invoice_pdf: null,
        hosted_invoice_url: null,
        description: pi.description || 'Commission payment',
        type: 'commission',
      }));

    // Combine and sort by date
    const allPayments = [...formattedInvoices, ...formattedPayments]
      .sort((a, b) => b.created - a.created);

    console.log(`Fetched ${allPayments.length} invoices/payments for workspace ${workspace_id}`);

    return new Response(
      JSON.stringify({ invoices: allPayments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching invoices:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
