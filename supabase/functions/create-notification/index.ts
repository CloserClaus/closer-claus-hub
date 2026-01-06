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

    const { action, ...params } = await req.json();
    console.log(`Notification action: ${action}`, params);

    switch (action) {
      case 'dispute_created': {
        const { dispute_id, workspace_id, deal_id, raised_by, reason } = params;

        // Get workspace owner and deal details
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', workspace_id)
          .single();

        const { data: deal } = await supabase
          .from('deals')
          .select('title')
          .eq('id', deal_id)
          .single();

        const { data: raiserProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', raised_by)
          .single();

        // Notify workspace owner about dispute
        if (workspace?.owner_id && workspace.owner_id !== raised_by) {
          await supabase
            .from('notifications')
            .insert({
              user_id: workspace.owner_id,
              workspace_id,
              type: 'dispute_created',
              title: 'New Dispute Filed',
              message: `${raiserProfile?.full_name || 'An SDR'} has filed a dispute on "${deal?.title || 'a deal'}": ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
              data: { dispute_id, deal_id },
            });
          console.log('Created dispute notification for owner');
        }

        // Notify platform admins
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'platform_admin');

        for (const admin of admins || []) {
          await supabase
            .from('notifications')
            .insert({
              user_id: admin.user_id,
              workspace_id,
              type: 'dispute_created',
              title: 'New Dispute Requires Review',
              message: `A dispute was filed on "${deal?.title || 'a deal'}" at ${workspace?.name || 'an agency'}.`,
              data: { dispute_id, deal_id, workspace_id },
            });
        }
        console.log(`Notified ${admins?.length || 0} platform admins about dispute`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'dispute_resolved': {
        const { dispute_id, workspace_id, deal_id, raised_by, resolution, admin_notes } = params;

        const { data: deal } = await supabase
          .from('deals')
          .select('title')
          .eq('id', deal_id)
          .single();

        // Notify the SDR who raised the dispute
        await supabase
          .from('notifications')
          .insert({
            user_id: raised_by,
            workspace_id,
            type: 'dispute_resolved',
            title: `Dispute ${resolution}`,
            message: `Your dispute on "${deal?.title || 'a deal'}" has been ${resolution.toLowerCase()}.${admin_notes ? ` Note: ${admin_notes.substring(0, 100)}` : ''}`,
            data: { dispute_id, deal_id, resolution },
          });
        console.log('Created dispute resolution notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sdr_joined': {
        const { workspace_id, sdr_user_id } = params;

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', workspace_id)
          .single();

        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', sdr_user_id)
          .single();

        // Notify workspace owner
        if (workspace?.owner_id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: workspace.owner_id,
              workspace_id,
              type: 'sdr_joined',
              title: 'New Team Member',
              message: `${sdrProfile?.full_name || sdrProfile?.email || 'A new SDR'} has joined your team.`,
              data: { sdr_user_id },
            });
          console.log('Created SDR joined notification for owner');
        }

        // Notify the SDR
        await supabase
          .from('notifications')
          .insert({
            user_id: sdr_user_id,
            workspace_id,
            type: 'sdr_joined',
            title: 'Welcome to the Team!',
            message: `You've joined ${workspace?.name || 'a new agency'}. Check out the training materials to get started.`,
            data: { workspace_id },
          });
        console.log('Created welcome notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sdr_removed': {
        const { workspace_id, sdr_user_id, reason } = params;

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspace_id)
          .single();

        // Notify the removed SDR
        await supabase
          .from('notifications')
          .insert({
            user_id: sdr_user_id,
            workspace_id,
            type: 'sdr_removed',
            title: 'Removed from Team',
            message: `You've been removed from ${workspace?.name || 'an agency'}.${reason ? ` Reason: ${reason}` : ''} Note: You'll still receive commissions for deals that close within 14 days.`,
            data: { workspace_id, reason },
          });
        console.log('Created removal notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'commission_paid': {
        const { commission_id, sdr_user_id, workspace_id, amount } = params;

        // Notify SDR about payout
        await supabase
          .from('notifications')
          .insert({
            user_id: sdr_user_id,
            workspace_id,
            type: 'commission_paid',
            title: 'Commission Paid!',
            message: `You've received a $${amount.toFixed(2)} commission payout. Check your PayPal for the transfer.`,
            data: { commission_id, amount },
          });
        console.log('Created commission paid notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'conversation_started': {
        const { workspace_id, sdr_user_id, agency_owner_id } = params;

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspace_id)
          .single();

        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', agency_owner_id)
          .single();

        // Notify SDR about the new conversation
        await supabase
          .from('notifications')
          .insert({
            user_id: sdr_user_id,
            workspace_id,
            type: 'conversation_started',
            title: 'New Message',
            message: `${ownerProfile?.full_name || 'An agency owner'} from ${workspace?.name || 'an agency'} started a conversation with you.`,
            data: { agency_owner_id, workspace_id },
          });
        console.log('Created conversation started notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'video_call_started': {
        const { conversation_id, caller_id, callee_id, room_name } = params;

        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', caller_id)
          .single();

        // Notify the callee about the video call
        await supabase
          .from('notifications')
          .insert({
            user_id: callee_id,
            type: 'video_call_started',
            title: 'Incoming Video Call',
            message: `${callerProfile?.full_name || 'Someone'} is calling you.`,
            data: { conversation_id, caller_id, room_name },
          });
        console.log('Created video call notification');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sdr_leaving': {
        const { workspace_id, target_user_id, sdr_user_id, reason, leave_at } = params;

        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', sdr_user_id)
          .single();

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspace_id)
          .single();

        // Notify the agency owner
        await supabase
          .from('notifications')
          .insert({
            user_id: target_user_id,
            workspace_id,
            type: 'sdr_leaving',
            title: 'SDR Leaving Notice',
            message: `${sdrProfile?.full_name || sdrProfile?.email || 'An SDR'} has submitted a 24-hour leave notice from ${workspace?.name || 'your agency'}.${reason ? ` Reason: ${reason}` : ''}`,
            data: { sdr_user_id, leave_at, reason },
          });
        console.log('Created SDR leaving notification for agency owner');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'contract_request': {
        const { workspace_id, target_user_id, deal_id } = params;

        const { data: deal } = await supabase
          .from('deals')
          .select('title')
          .eq('id', deal_id)
          .single();

        // Notify agency owner about new contract request
        await supabase
          .from('notifications')
          .insert({
            user_id: target_user_id,
            workspace_id,
            type: 'contract_request',
            title: 'New Contract Request',
            message: `A contract request has been submitted for "${deal?.title || 'a deal'}". Please review and approve or reject.`,
            data: { deal_id },
          });
        console.log('Created contract request notification for agency owner');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'contract_request_approved': {
        const { workspace_id, target_user_id, deal_id } = params;

        const { data: deal } = await supabase
          .from('deals')
          .select('title')
          .eq('id', deal_id)
          .single();

        // Notify SDR about approval
        await supabase
          .from('notifications')
          .insert({
            user_id: target_user_id,
            workspace_id,
            type: 'contract_request_approved',
            title: 'Contract Request Approved',
            message: `Your contract request for "${deal?.title || 'a deal'}" has been approved. The agency will prepare and send the contract.`,
            data: { deal_id },
          });
        console.log('Created contract request approval notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'contract_request_rejected': {
        const { workspace_id, target_user_id, deal_id, reason } = params;

        const { data: deal } = await supabase
          .from('deals')
          .select('title')
          .eq('id', deal_id)
          .single();

        // Notify SDR about rejection
        await supabase
          .from('notifications')
          .insert({
            user_id: target_user_id,
            workspace_id,
            type: 'contract_request_rejected',
            title: 'Contract Request Rejected',
            message: `Your contract request for "${deal?.title || 'a deal'}" has been rejected.${reason ? ` Reason: ${reason.substring(0, 100)}` : ''}`,
            data: { deal_id, reason },
          });
        console.log('Created contract request rejection notification for SDR');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Notification function error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
