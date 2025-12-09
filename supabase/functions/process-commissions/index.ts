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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TODO: Add Stripe integration
    // const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    // const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get pending commissions older than 7 days for auto-charge
    const { data: commissionsToCharge, error: chargeError } = await supabase
      .from('commissions')
      .select(`
        *,
        workspace:workspaces(id, name, stripe_customer_id, owner_id)
      `)
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (chargeError) {
      console.error('Error fetching commissions to charge:', chargeError);
      throw chargeError;
    }

    console.log(`Found ${commissionsToCharge?.length || 0} commissions to auto-charge`);

    const chargeResults = [];

    for (const commission of commissionsToCharge || []) {
      try {
        // TODO: Implement Stripe charging when API key is added
        // if (stripe && commission.workspace?.stripe_customer_id) {
        //   const paymentIntent = await stripe.paymentIntents.create({...});
        // }

        // Get owner email for notification
        if (commission.workspace?.owner_id) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', commission.workspace.owner_id)
            .single();

          if (ownerProfile?.email) {
            // Send overdue notification email
            const daysOld = Math.floor((now.getTime() - new Date(commission.created_at).getTime()) / (1000 * 60 * 60 * 24));
            
            await fetch(`${supabaseUrl}/functions/v1/send-commission-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: 'commission_overdue',
                to_email: ownerProfile.email,
                to_name: ownerProfile.full_name || 'Agency Owner',
                workspace_name: commission.workspace.name,
                amount: commission.amount + commission.rake_amount,
                days_overdue: daysOld,
              }),
            });
            console.log(`Sent overdue notification for commission ${commission.id}`);
          }
        }

        console.log(`Would auto-charge commission ${commission.id} for $${commission.amount + commission.rake_amount}`);
        
        chargeResults.push({
          commission_id: commission.id,
          status: 'pending_stripe_integration',
          amount: commission.amount + commission.rake_amount,
          workspace_id: commission.workspace_id,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing commission ${commission.id}:`, err);
        chargeResults.push({
          commission_id: commission.id,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    // Get commissions older than 14 days that are still unpaid - lock accounts
    const { data: overdueCommissions, error: overdueError } = await supabase
      .from('commissions')
      .select('workspace_id')
      .eq('status', 'pending')
      .lt('created_at', fourteenDaysAgo.toISOString());

    if (overdueError) {
      console.error('Error fetching overdue commissions:', overdueError);
      throw overdueError;
    }

    // Get unique workspace IDs that need to be locked
    const workspacesToLock = [...new Set(overdueCommissions?.map(c => c.workspace_id) || [])];
    
    console.log(`Found ${workspacesToLock.length} workspaces to lock due to overdue commissions`);

    const lockResults = [];

    for (const workspaceId of workspacesToLock) {
      try {
        // Get workspace details and owner info
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name, owner_id, is_locked')
          .eq('id', workspaceId)
          .single();

        if (workspace?.is_locked) {
          console.log(`Workspace ${workspaceId} already locked, skipping`);
          continue;
        }

        const { error: lockError } = await supabase
          .from('workspaces')
          .update({ is_locked: true })
          .eq('id', workspaceId);

        if (lockError) throw lockError;

        console.log(`Locked workspace ${workspaceId} due to overdue commissions`);

        // Send account locked email
        if (workspace?.owner_id) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', workspace.owner_id)
            .single();

          // Get total owed for this workspace
          const { data: workspaceCommissions } = await supabase
            .from('commissions')
            .select('amount, rake_amount')
            .eq('workspace_id', workspaceId)
            .eq('status', 'pending');

          const totalOwed = workspaceCommissions?.reduce((sum, c) => sum + c.amount + c.rake_amount, 0) || 0;

          if (ownerProfile?.email) {
            await fetch(`${supabaseUrl}/functions/v1/send-commission-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: 'account_locked',
                to_email: ownerProfile.email,
                to_name: ownerProfile.full_name || 'Agency Owner',
                workspace_name: workspace.name,
                amount: totalOwed,
                commission_count: workspaceCommissions?.length || 0,
              }),
            });
            console.log(`Sent account locked notification for workspace ${workspaceId}`);
          }
        }
        
        lockResults.push({
          workspace_id: workspaceId,
          status: 'locked',
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error locking workspace ${workspaceId}:`, err);
        lockResults.push({
          workspace_id: workspaceId,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_at: now.toISOString(),
        charges: {
          total: chargeResults.length,
          results: chargeResults,
        },
        locks: {
          total: lockResults.length,
          results: lockResults,
        },
        stripe_enabled: false, // TODO: Change to true when Stripe is configured
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-commissions:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
