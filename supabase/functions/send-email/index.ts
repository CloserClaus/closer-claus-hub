import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Provider handler interface - each provider implements this
interface SendResult {
  success: boolean;
  external_id?: string;
  error?: string;
}

// Provider-agnostic routing handlers (mock implementations - swap with real APIs later)
async function sendViaGmail(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
  // TODO: Implement Gmail API send via OAuth tokens
  console.log('Gmail handler: would send email via Gmail API');
  return { success: true, external_id: `gmail-${crypto.randomUUID().slice(0, 8)}` };
}

async function sendViaInstantly(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
  // TODO: Implement Instantly API send
  console.log('Instantly handler: would send email via Instantly API');
  return { success: true, external_id: `instantly-${crypto.randomUUID().slice(0, 8)}` };
}

async function sendViaSmartlead(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
  console.log('Smartlead handler: would send email via Smartlead API');
  return { success: true, external_id: `smartlead-${crypto.randomUUID().slice(0, 8)}` };
}

async function sendViaLemlist(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
  console.log('Lemlist handler: would send email via Lemlist API');
  return { success: true, external_id: `lemlist-${crypto.randomUUID().slice(0, 8)}` };
}

async function sendViaOther(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
  console.log('Other handler: would send email via custom provider API');
  return { success: true, external_id: `other-${crypto.randomUUID().slice(0, 8)}` };
}

// Router: selects handler based on provider type
const PROVIDER_HANDLERS: Record<string, (inbox: any, provider: any, payload: any) => Promise<SendResult>> = {
  gmail: sendViaGmail,
  instantly: sendViaInstantly,
  smartlead: sendViaSmartlead,
  lemlist: sendViaLemlist,
  other: sendViaOther,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { to_email, subject, body, lead_id, workspace_id, sequence_id, sequence_step } = await req.json();

    if (!workspace_id || !to_email || !subject || !body) {
      throw new Error('Missing required fields: workspace_id, to_email, subject, body');
    }

    // SERVER-SIDE SENDER ENFORCEMENT: Find assigned inbox for this SDR
    const { data: inbox, error: inboxError } = await supabase
      .from('email_inboxes')
      .select('*, email_providers!inner(*)')
      .eq('workspace_id', workspace_id)
      .eq('assigned_to', user.id)
      .eq('status', 'active')
      .single();

    if (inboxError || !inbox) {
      throw new Error('No active inbox assigned to you. Contact your agency owner to assign an inbox.');
    }

    const provider = (inbox as any).email_providers;

    // Validate provider is connected
    if (provider.status !== 'connected') {
      throw new Error(`Provider "${provider.provider_name || provider.provider_type}" is disconnected. Please reconnect.`);
    }

    // Check lead sending state if lead_id provided
    if (lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('email_sending_state')
        .eq('id', lead_id)
        .single();

      if (lead && lead.email_sending_state === 'active_sequence' && !sequence_id) {
        throw new Error('Lead already in active sequence. Cannot send manual email while sequence is active.');
      }
    }

    // Route to provider handler
    const handler = PROVIDER_HANDLERS[provider.provider_type] || PROVIDER_HANDLERS.other;
    const payload = { to_email, subject, body, lead_id };
    const result = await handler(inbox, provider, payload);

    if (!result.success) {
      // Log failure - never create false activity
      await supabase.from('email_audit_log').insert({
        workspace_id,
        action_type: 'email_send_failed',
        actor_id: user.id,
        inbox_id: inbox.id,
        provider_id: provider.id,
        lead_id,
        sequence_id,
        metadata: { error: result.error, subject },
      });

      throw new Error(result.error || 'Provider unavailable. Please retry.');
    }

    // Log the email
    const { error: logError } = await supabase.from('email_logs').insert({
      workspace_id,
      lead_id,
      sent_by: user.id,
      provider: provider.provider_type,
      subject,
      body,
      status: 'sent',
      inbox_id: inbox.id,
      sequence_id: sequence_id || null,
      sequence_step: sequence_step ?? null,
    });

    if (logError) console.error('Email log error:', logError);

    // Audit log
    await supabase.from('email_audit_log').insert({
      workspace_id,
      action_type: sequence_id ? 'sequence_email_sent' : 'email_sent',
      actor_id: user.id,
      inbox_id: inbox.id,
      provider_id: provider.id,
      lead_id,
      sequence_id,
      metadata: {
        subject,
        to_email,
        external_id: result.external_id,
        inbox_email: inbox.email_address,
      },
    });

    // Update lead's last_contacted_at
    if (lead_id) {
      await supabase
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead_id);
    }

    return new Response(
      JSON.stringify({ success: true, status: 'sent', inbox_id: inbox.id, provider: provider.provider_type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
