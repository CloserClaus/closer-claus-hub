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

    // Get SDR profile to determine their level and platform cut
    const { data: sdrProfile, error: sdrError } = await supabase
      .from('profiles')
      .select('full_name, sdr_level, total_deals_closed_value')
      .eq('id', deal.assigned_to)
      .single();

    if (sdrError) {
      console.error('SDR profile not found:', sdrError);
    }

    const sdrLevel = sdrProfile?.sdr_level || 1;
    
    // Platform cut based on SDR level: Level 1 = 5%, Level 2 = 4%, Level 3 = 2.5%
    let platformCutPercentage: number;
    switch (sdrLevel) {
      case 3:
        platformCutPercentage = 2.5;
        break;
      case 2:
        platformCutPercentage = 4;
        break;
      default:
        platformCutPercentage = 5;
    }

    // Calculate commission (workspace rake is separate from platform cut)
    const rakePercentage = workspace.rake_percentage || 2;
    const rakeAmount = (Number(deal.value) * rakePercentage) / 100;
    const grossCommission = Number(deal.value) - rakeAmount;
    
    // Platform takes a cut from the SDR's commission based on their level
    const platformCutAmount = (grossCommission * platformCutPercentage) / 100;
    const sdrPayoutAmount = grossCommission - platformCutAmount;

    console.log(`Commission calculation: value=${deal.value}, rake=${rakePercentage}%, rakeAmount=${rakeAmount}, grossCommission=${grossCommission}`);
    console.log(`SDR Level: ${sdrLevel}, Platform Cut: ${platformCutPercentage}% ($${platformCutAmount}), SDR Payout: $${sdrPayoutAmount}`);

    // Create commission record with platform cut details
    const { error: commissionError } = await supabase
      .from('commissions')
      .insert({
        workspace_id: workspaceId,
        deal_id: dealId,
        sdr_id: deal.assigned_to,
        amount: grossCommission,
        rake_amount: rakeAmount,
        platform_cut_percentage: platformCutPercentage,
        platform_cut_amount: platformCutAmount,
        sdr_payout_amount: sdrPayoutAmount,
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

    // Create notification for agency owner with clear breakdown
    // Agency pays: grossCommission (which is deal value - rake)
    // They keep the rake amount for themselves
    if (workspace.owner_id) {
      await supabase.from('notifications').insert({
        user_id: workspace.owner_id,
        workspace_id: workspaceId,
        type: 'commission_created',
        title: 'New Commission Due',
        message: `Commission due for "${deal.title}" closed by ${sdrProfile?.full_name || 'SDR'}: $${grossCommission.toFixed(2)} (after your $${rakeAmount.toFixed(2)} agency fee). Payment due within 7 days.`,
        data: {
          deal_id: dealId,
          deal_value: deal.value,
          rake_amount: rakeAmount,
          commission_amount: grossCommission,
          sdr_name: sdrProfile?.full_name,
        },
      });
      console.log('Created notification for owner');
    }

    // Create notification for SDR with payout details
    await supabase.from('notifications').insert({
      user_id: deal.assigned_to,
      workspace_id: workspaceId,
      type: 'commission_created',
      title: 'Commission Earned!',
      message: `You earned a $${sdrPayoutAmount.toFixed(2)} commission for closing "${deal.title}" (Level ${sdrLevel} - ${platformCutPercentage}% platform fee applied). Payout pending agency payment.`,
      data: {
        deal_id: dealId,
        gross_commission: grossCommission,
        platform_cut: platformCutAmount,
        sdr_payout: sdrPayoutAmount,
        sdr_level: sdrLevel,
      },
    });
    console.log('Created notification for SDR');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Commission created successfully',
        commission: {
          amount: grossCommission,
          rake_amount: rakeAmount,
          platform_cut_percentage: platformCutPercentage,
          platform_cut_amount: platformCutAmount,
          sdr_payout_amount: sdrPayoutAmount,
          sdr_level: sdrLevel,
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
