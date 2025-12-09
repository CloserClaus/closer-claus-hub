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

    const { workspace_id, force_unlock } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for pending commissions
    const { data: pendingCommissions, error: pendingError } = await supabase
      .from('commissions')
      .select('id, amount, rake_amount, created_at')
      .eq('workspace_id', workspace_id)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    const hasPendingCommissions = (pendingCommissions?.length || 0) > 0;
    const totalOwed = pendingCommissions?.reduce((sum, c) => sum + c.amount + c.rake_amount, 0) || 0;

    // Only unlock if no pending commissions OR force_unlock by admin
    if (hasPendingCommissions && !force_unlock) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot unlock workspace with pending commissions',
          pending_count: pendingCommissions?.length || 0,
          total_owed: totalOwed,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unlock the workspace
    const { error: unlockError } = await supabase
      .from('workspaces')
      .update({ is_locked: false })
      .eq('id', workspace_id);

    if (unlockError) throw unlockError;

    console.log(`Unlocked workspace ${workspace_id}${force_unlock ? ' (forced by admin)' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        workspace_id,
        force_unlocked: force_unlock || false,
        remaining_pending: hasPendingCommissions ? pendingCommissions?.length : 0,
        remaining_owed: hasPendingCommissions ? totalOwed : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in unlock-workspace:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
