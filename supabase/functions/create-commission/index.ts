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

    const { dealId, workspaceId } = await req.json();
    console.log(`Creating commission for deal: ${dealId}, workspace: ${workspaceId}`);

    if (!dealId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Deal ID and Workspace ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if commission already exists for this deal
    const { data: existingCommission } = await supabase
      .from('commissions')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();

    if (existingCommission) {
      console.log('Commission already exists for this deal');
      return new Response(
        JSON.stringify({ success: true, message: 'Commission already exists', existing: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get deal details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, title, value, assigned_to, stage')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      console.error('Deal not found:', dealError);
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only create commission for closed_won deals
    if (deal.stage !== 'closed_won') {
      console.log('Deal is not closed_won, skipping commission creation');
      return new Response(
        JSON.stringify({ success: true, message: 'Deal not closed_won, no commission created' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace rake percentage
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('rake_percentage, name, owner_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace not found:', workspaceError);
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate commission
    const rakePercentage = workspace.rake_percentage || 2;
    const rakeAmount = (Number(deal.value) * rakePercentage) / 100;
    const commissionAmount = Number(deal.value) - rakeAmount;

    console.log(`Commission calculation: value=${deal.value}, rake=${rakePercentage}%, rakeAmount=${rakeAmount}, commissionAmount=${commissionAmount}`);

    // Create commission record
    const { error: commissionError } = await supabase
      .from('commissions')
      .insert({
        workspace_id: workspaceId,
        deal_id: dealId,
        sdr_id: deal.assigned_to,
        amount: commissionAmount,
        rake_amount: rakeAmount,
        status: 'pending',
      });

    if (commissionError) {
      console.error('Error creating commission:', commissionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create commission' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Commission created successfully');

    // Get profiles for notifications
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', workspace.owner_id)
      .maybeSingle();

    const { data: sdrProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', deal.assigned_to)
      .maybeSingle();

    const totalAmount = commissionAmount + rakeAmount;

    // Create notification for agency owner
    if (workspace.owner_id) {
      await supabase.from('notifications').insert({
        user_id: workspace.owner_id,
        workspace_id: workspaceId,
        type: 'commission_created',
        title: 'New Commission Due',
        message: `A $${totalAmount.toFixed(2)} commission is due for "${deal.title}" closed by ${sdrProfile?.full_name || 'SDR'}. Payment due within 7 days.`,
        data: {
          deal_id: dealId,
          commission_amount: totalAmount,
          sdr_name: sdrProfile?.full_name,
        },
      });
      console.log('Created notification for owner');
    }

    // Create notification for SDR
    await supabase.from('notifications').insert({
      user_id: deal.assigned_to,
      workspace_id: workspaceId,
      type: 'commission_created',
      title: 'Commission Earned!',
      message: `You earned a $${commissionAmount.toFixed(2)} commission for closing "${deal.title}". Payout pending agency payment.`,
      data: {
        deal_id: dealId,
        commission_amount: commissionAmount,
      },
    });
    console.log('Created notification for SDR');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Commission created successfully',
        commission: {
          amount: commissionAmount,
          rake_amount: rakeAmount,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Create commission error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});