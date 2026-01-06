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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing pending SDR leaves...');
    const now = new Date().toISOString();

    // Find all workspace members with pending_leave_at <= now and not yet removed
    const { data: pendingLeaves, error: fetchError } = await supabase
      .from('workspace_members')
      .select('id, user_id, workspace_id, pending_leave_at')
      .lte('pending_leave_at', now)
      .is('removed_at', null);

    if (fetchError) {
      console.error('Error fetching pending leaves:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingLeaves?.length || 0} pending leaves to process`);

    if (!pendingLeaves || pendingLeaves.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending leaves to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const member of pendingLeaves) {
      try {
        // Calculate 48-hour cooldown
        const cooldownUntil = new Date();
        cooldownUntil.setHours(cooldownUntil.getHours() + 48);

        // Update the member to mark as removed
        // This will trigger the existing reassign_leads_on_member_removal trigger
        const { error: updateError } = await supabase
          .from('workspace_members')
          .update({
            removed_at: now,
            cooldown_until: cooldownUntil.toISOString(),
            pending_leave_at: null,
          })
          .eq('id', member.id);

        if (updateError) {
          console.error(`Error processing leave for member ${member.id}:`, updateError);
          errors.push(`Member ${member.id}: ${updateError.message}`);
          continue;
        }

        // Get workspace and SDR info for notifications
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name, owner_id')
          .eq('id', member.workspace_id)
          .single();

        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', member.user_id)
          .single();

        // Notify agency owner that SDR has left
        if (workspace?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: workspace.owner_id,
            workspace_id: member.workspace_id,
            type: 'team_member_left',
            title: 'Team Member Left',
            message: `${sdrProfile?.full_name || 'An SDR'} has left your team after their 24-hour notice period.`,
            data: {
              sdr_id: member.user_id,
              sdr_name: sdrProfile?.full_name,
            },
          });
        }

        // Notify SDR that they've successfully left
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          workspace_id: member.workspace_id,
          type: 'leave_completed',
          title: 'Left Team Successfully',
          message: `You have successfully left ${workspace?.name || 'the agency'}. A 48-hour cooldown is now active before you can rejoin.`,
          data: {
            workspace_id: member.workspace_id,
            cooldown_until: cooldownUntil.toISOString(),
          },
        });

        processedCount++;
        console.log(`Processed leave for member ${member.id} (user: ${member.user_id})`);
      } catch (memberError) {
        console.error(`Unexpected error processing member ${member.id}:`, memberError);
        errors.push(`Member ${member.id}: ${memberError instanceof Error ? memberError.message : 'Unknown error'}`);
      }
    }

    console.log(`Finished processing. Processed: ${processedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} pending leaves`,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Process pending leaves error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
