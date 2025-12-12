import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function should be called periodically (e.g., via cron job or scheduled trigger)
// It processes overdue commissions:
// - After 7 days: Auto-charge via Stripe if configured
// - After 14 days: Lock the agency workspace

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    console.log('Processing overdue commissions...');
    console.log(`7 days threshold: ${sevenDaysAgo.toISOString()}`);
    console.log(`14 days threshold: ${fourteenDaysAgo.toISOString()}`);

    // Fetch all pending commissions
    const { data: pendingCommissions, error: fetchError } = await supabase
      .from('commissions')
      .select(`
        *,
        workspace:workspaces(id, name, stripe_customer_id, owner_id, is_locked),
        deal:deals(title, value)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching commissions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingCommissions?.length || 0} pending commissions`);

    const results = {
      processed: 0,
      auto_charged: 0,
      locked_workspaces: 0,
      errors: [] as string[],
    };

    for (const commission of pendingCommissions || []) {
      const createdAt = new Date(commission.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      console.log(`Commission ${commission.id}: ${daysSinceCreation} days old`);

      // Check if 14+ days overdue - lock workspace
      if (createdAt < fourteenDaysAgo) {
        console.log(`Commission ${commission.id} is 14+ days overdue - locking workspace`);

        if (!commission.workspace?.is_locked) {
          const { error: lockError } = await supabase
            .from('workspaces')
            .update({ is_locked: true })
            .eq('id', commission.workspace_id);

          if (lockError) {
            console.error(`Error locking workspace ${commission.workspace_id}:`, lockError);
            results.errors.push(`Failed to lock workspace ${commission.workspace_id}`);
          } else {
            results.locked_workspaces++;
            console.log(`Locked workspace ${commission.workspace_id}`);

            // Notify workspace owner
            if (commission.workspace?.owner_id) {
              await supabase.functions.invoke('create-notification', {
                body: {
                  user_id: commission.workspace.owner_id,
                  title: 'Account Locked',
                  message: `Your account has been locked due to unpaid commissions totaling $${(Number(commission.amount) + Number(commission.rake_amount)).toFixed(2)}. Please pay immediately to restore access.`,
                  type: 'account_locked',
                  workspace_id: commission.workspace_id,
                },
              });
            }
          }
        }

        // Update commission status to overdue
        await supabase
          .from('commissions')
          .update({ status: 'overdue' })
          .eq('id', commission.id);

        results.processed++;
        continue;
      }

      // Check if 7+ days overdue - auto-charge if Stripe is configured
      if (createdAt < sevenDaysAgo && stripeSecretKey) {
        console.log(`Commission ${commission.id} is 7+ days overdue - attempting auto-charge`);

        try {
          // Call pay-commission function
          const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('pay-commission', {
            body: {
              commission_id: commission.id,
              payment_method: 'stripe',
            },
          });

          if (paymentError) {
            console.error(`Auto-charge failed for commission ${commission.id}:`, paymentError);
            results.errors.push(`Auto-charge failed for ${commission.id}: ${paymentError.message}`);
          } else if (paymentResult?.success) {
            results.auto_charged++;
            console.log(`Auto-charged commission ${commission.id}`);
          } else if (paymentResult?.requires_action) {
            // Payment requires additional action (3D Secure, etc.)
            // Notify the agency owner
            if (commission.workspace?.owner_id) {
              await supabase.functions.invoke('create-notification', {
                body: {
                  user_id: commission.workspace.owner_id,
                  title: 'Payment Action Required',
                  message: `Your commission payment of $${(Number(commission.amount) + Number(commission.rake_amount)).toFixed(2)} requires additional verification. Please complete the payment to avoid account lock.`,
                  type: 'payment_action_required',
                  workspace_id: commission.workspace_id,
                },
              });
            }
          }
        } catch (chargeError: any) {
          console.error(`Error auto-charging commission ${commission.id}:`, chargeError);
          results.errors.push(`Error charging ${commission.id}: ${chargeError.message}`);
        }

        results.processed++;
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        stripe_enabled: !!stripeSecretKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-overdue-commissions:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
