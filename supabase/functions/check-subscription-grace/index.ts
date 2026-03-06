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

    console.log('Running subscription grace period check...');

    // Find workspaces past their grace period
    const { data: expiredWorkspaces, error } = await supabase
      .from('workspaces')
      .select('id, owner_id, name, grace_period_end')
      .eq('subscription_status', 'past_due')
      .lte('grace_period_end', new Date().toISOString())
      .not('grace_period_end', 'is', null);

    if (error) {
      console.error('Error querying expired workspaces:', error);
      throw error;
    }

    console.log(`Found ${expiredWorkspaces?.length || 0} workspaces past grace period`);

    for (const workspace of expiredWorkspaces || []) {
      // Restrict the account
      await supabase
        .from('workspaces')
        .update({
          subscription_status: 'cancelled',
          is_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id);

      console.log(`Restricted workspace ${workspace.id} (${workspace.name})`);

      // Send notification
      if (workspace.owner_id) {
        await supabase.from('notifications').insert({
          user_id: workspace.owner_id,
          workspace_id: workspace.id,
          type: 'account_restricted',
          title: 'Account Restricted 🔒',
          message: 'Your account has been restricted due to non-payment. Please resubscribe to regain access.',
        });

        // Send email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', workspace.owner_id)
          .single();

        if (profile?.email) {
          try {
            await supabase.functions.invoke('send-subscription-email', {
              body: {
                type: 'account_restricted',
                to_email: profile.email,
                to_name: profile.full_name || 'there',
                workspace_name: workspace.name,
              },
            });
          } catch (emailError) {
            console.error(`Failed to send restriction email for workspace ${workspace.id}:`, emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: expiredWorkspaces?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-subscription-grace:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
