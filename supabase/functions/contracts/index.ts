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

    const { action, ...params } = await req.json();
    console.log(`Contract action: ${action}`, params);

    switch (action) {
      case 'get_contract': {
        const { contractId } = params;

        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get contract details for signing page
        const { data: contract, error } = await supabase
          .from('contracts')
          .select(`
            id,
            title,
            content,
            status,
            deal_id,
            deals (
              title,
              value,
              leads (
                first_name,
                last_name,
                email,
                company
              )
            )
          `)
          .eq('id', contractId)
          .single();

        if (error || !contract) {
          return new Response(
            JSON.stringify({ error: 'Contract not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (contract.status !== 'sent') {
          return new Response(
            JSON.stringify({ error: 'Contract is not available for signing', status: contract.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ contract }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sign_contract': {
        const { contractId, signerName, signerEmail, signatureData, agreed } = params;

        if (!contractId || !signerName || !signerEmail || !agreed) {
          return new Response(
            JSON.stringify({ error: 'All fields are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(signerEmail)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get client IP and user agent
        const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                          req.headers.get('x-real-ip') || 
                          'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Verify contract exists and is in 'sent' status
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select('id, status, deal_id, workspace_id')
          .eq('id', contractId)
          .single();

        if (contractError || !contract) {
          return new Response(
            JSON.stringify({ error: 'Contract not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (contract.status !== 'sent') {
          return new Response(
            JSON.stringify({ error: 'Contract cannot be signed', currentStatus: contract.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create signature record
        const { error: signatureError } = await supabase
          .from('contract_signatures')
          .insert({
            contract_id: contractId,
            signer_name: signerName.trim(),
            signer_email: signerEmail.trim().toLowerCase(),
            signature_data: signatureData || null,
            ip_address: ipAddress,
            user_agent: userAgent,
          });

        if (signatureError) {
          console.error('Error creating signature:', signatureError);
          return new Response(
            JSON.stringify({ error: 'Failed to record signature' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update contract status to signed
        const { error: updateContractError } = await supabase
          .from('contracts')
          .update({ status: 'signed', signed_at: new Date().toISOString() })
          .eq('id', contractId);

        if (updateContractError) {
          console.error('Error updating contract:', updateContractError);
        }

        // Update deal to Closed Won
        const { error: updateDealError } = await supabase
          .from('deals')
          .update({ 
            stage: 'closed_won', 
            closed_at: new Date().toISOString() 
          })
          .eq('id', contract.deal_id);

        if (updateDealError) {
          console.error('Error updating deal:', updateDealError);
        }

        // Get deal details for commission calculation
        const { data: deal } = await supabase
          .from('deals')
          .select('value, assigned_to')
          .eq('id', contract.deal_id)
          .single();

        // Get workspace rake percentage
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('rake_percentage')
          .eq('id', contract.workspace_id)
          .single();

        // Create commission record
        if (deal && workspace) {
          const rakePercentage = workspace.rake_percentage || 2;
          const rakeAmount = (deal.value * rakePercentage) / 100;
          const commissionAmount = deal.value - rakeAmount;

          const { error: commissionError } = await supabase
            .from('commissions')
            .insert({
              workspace_id: contract.workspace_id,
              deal_id: contract.deal_id,
              sdr_id: deal.assigned_to,
              amount: commissionAmount,
              rake_amount: rakeAmount,
              status: 'pending',
            });

          if (commissionError) {
            console.error('Error creating commission:', commissionError);
          }
        }

        // Log deal activity
        if (deal) {
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: contract.deal_id,
              user_id: deal.assigned_to,
              activity_type: 'contract_signed',
              description: `Contract signed by ${signerName} (${signerEmail})`,
            });
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Contract signed successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Contract function error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});