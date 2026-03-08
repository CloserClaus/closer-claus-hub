import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function generateUnsubscribeToken(leadId: string): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(leadId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function appendUnsubscribeFooter(body: string, leadId: string, token: string, supabaseUrl: string): string {
  const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?lead_id=${leadId}&token=${token}`;
  return body + `\n\n---\nIf you no longer wish to receive these emails, click here to unsubscribe: ${unsubUrl}`;
}

interface SendResult {
  success: boolean;
  external_id?: string;
  thread_id?: string;
  message_id?: string;
  error?: string;
  error_reason?: string;
}

// ─── Real Gmail API Send ────────────────────────────────────
async function sendViaGmail(inbox: any, _provider: any, payload: any): Promise<SendResult> {
  const refreshToken = inbox.external_inbox_id; // stored as refresh token
  if (!refreshToken) {
    return { success: false, error: 'No refresh token stored for this inbox.', error_reason: 'auth_expired' };
  }

  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return { success: false, error: 'Google OAuth not configured.', error_reason: 'api_failure' };
  }

  try {
    // 1. Refresh the access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token refresh failed:', tokenData);
      return { success: false, error: 'Gmail auth expired. Please reconnect.', error_reason: 'auth_expired' };
    }

    const accessToken = tokenData.access_token;

    // 2. Build RFC 2822 email
    const fromEmail = inbox.email_address;
    const toEmail = payload.to_email;
    const subject = payload.subject;
    const body = payload.body;

    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ];
    const rawEmail = emailLines.join('\r\n');

    // Base64url encode
    const encoder = new TextEncoder();
    const encoded = encoder.encode(rawEmail);
    const base64 = btoa(String.fromCharCode(...encoded))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 3. Send via Gmail API
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64 }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      console.error('Gmail send failed:', sendData);
      const errorMsg = sendData.error?.message || 'Gmail API error';
      let errorReason = 'api_failure';
      if (sendRes.status === 429) errorReason = 'rate_limit';
      else if (sendRes.status === 401 || sendRes.status === 403) errorReason = 'auth_expired';
      return { success: false, error: errorMsg, error_reason: errorReason };
    }

    return {
      success: true,
      external_id: sendData.id,
      thread_id: sendData.threadId,
      message_id: sendData.id,
    };
  } catch (err: any) {
    console.error('Gmail send exception:', err);
    return { success: false, error: err.message, error_reason: 'api_failure' };
  }
}

// ─── Stub handlers for other providers ──────────────────────
async function sendViaInstantly(_inbox: any, _provider: any, _payload: any): Promise<SendResult> {
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

    const { to_email, subject, body, lead_id, workspace_id, sequence_id, sequence_step, conversation_id } = await req.json();

    if (!workspace_id || !to_email || !subject || !body) {
      throw new Error('Missing required fields: workspace_id, to_email, subject, body');
    }

    // SERVER-SIDE SENDER ENFORCEMENT
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

    if (provider.status !== 'connected') {
      throw new Error(`Provider "${provider.provider_name || provider.provider_type}" is disconnected. Please reconnect.`);
    }

    // Check daily send limit
    const inboxData = inbox as any;
    if (inboxData.sends_today >= inboxData.daily_send_limit) {
      throw new Error(`Daily send limit reached (${inboxData.daily_send_limit}). Try again tomorrow.`);
    }

    // Check lead sending state if lead_id provided
    if (lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('email_sending_state, opted_out')
        .eq('id', lead_id)
        .single();

      if (lead?.opted_out) {
        throw new Error('This lead has opted out of emails.');
      }

      if (lead && lead.email_sending_state === 'active_sequence' && !sequence_id) {
        throw new Error('Lead already in active sequence. Cannot send manual email while sequence is active.');
      }
    }

    // Append unsubscribe footer if lead_id is provided
    let finalBody = body;
    if (lead_id) {
      const unsubToken = await generateUnsubscribeToken(lead_id);
      finalBody = appendUnsubscribeFooter(body, lead_id, unsubToken, supabaseUrl);
    }

    // Route to provider handler
    const handler = PROVIDER_HANDLERS[provider.provider_type] || PROVIDER_HANDLERS.other;
    const payload = { to_email, subject, body: finalBody, lead_id };
    const result = await handler(inbox, provider, payload);

    if (!result.success) {
      // Log failure
      await supabase.from('email_audit_log').insert({
        workspace_id,
        action_type: 'email_send_failed',
        actor_id: user.id,
        inbox_id: inbox.id,
        provider_id: provider.id,
        lead_id,
        sequence_id,
        metadata: { error: result.error, error_reason: result.error_reason, subject },
      });

      // Update lead status to error if lead_id provided
      if (lead_id) {
        await supabase.from('leads').update({ email_sending_state: 'error' } as any).eq('id', lead_id);
      }

      // Log to email_logs with error
      await supabase.from('email_logs').insert({
        workspace_id, lead_id, sent_by: user.id,
        provider: provider.provider_type, subject, body,
        status: 'failed', inbox_id: inbox.id,
        sequence_id: sequence_id || null,
        sequence_step: sequence_step ?? null,
        error_reason: result.error_reason || result.error,
      } as any);

      throw new Error(result.error || 'Provider unavailable. Please retry.');
    }

    // Log the email
    await supabase.from('email_logs').insert({
      workspace_id, lead_id, sent_by: user.id,
      provider: provider.provider_type, subject, body,
      status: 'sent', inbox_id: inbox.id,
      sequence_id: sequence_id || null,
      sequence_step: sequence_step ?? null,
      thread_id: result.thread_id || null,
      message_id: result.message_id || null,
    } as any);

    // Increment daily send count atomically
    await supabase.rpc('increment_inbox_sends_today' as any, { p_inbox_id: inbox.id }).catch(async () => {
      // Fallback: direct update
      await supabase.from('email_inboxes')
        .update({ sends_today: (inboxData.sends_today || 0) + 1 } as any)
        .eq('id', inbox.id);
    });

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
        subject, to_email,
        external_id: result.external_id,
        thread_id: result.thread_id,
        inbox_email: inbox.email_address,
      },
    });

    // Update lead's last_contacted_at
    if (lead_id) {
      await supabase.from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead_id);
    }

    // Auto-create email conversation for one-off sends (not sequence sends)
    if (lead_id && !sequence_id) {
      // Check if conversation already exists for this lead
      const { data: existingConvo } = await supabase
        .from('email_conversations')
        .select('id')
        .eq('lead_id', lead_id)
        .eq('workspace_id', workspace_id)
        .is('sequence_id', null)
        .limit(1)
        .maybeSingle();

      if (existingConvo) {
        // Update existing conversation
        await supabase.from('email_conversations').update({
          last_message_preview: body.substring(0, 100),
          last_activity_at: new Date().toISOString(),
          status: 'active',
        } as any).eq('id', existingConvo.id);

        // Add message to conversation
        await supabase.from('email_conversation_messages').insert({
          conversation_id: existingConvo.id,
          direction: 'outbound',
          subject,
          body,
          sender_email: inbox.email_address,
          message_type: 'email',
        } as any);
      } else {
        // Create new conversation
        const { data: newConvo } = await supabase.from('email_conversations').insert({
          workspace_id,
          lead_id,
          assigned_to: user.id,
          inbox_id: inbox.id,
          status: 'active',
          last_message_preview: body.substring(0, 100),
          last_activity_at: new Date().toISOString(),
        } as any).select('id').single();

        if (newConvo) {
          await supabase.from('email_conversation_messages').insert({
            conversation_id: newConvo.id,
            direction: 'outbound',
            subject,
            body,
            sender_email: inbox.email_address,
            message_type: 'email',
          } as any);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true, status: 'sent',
        inbox_id: inbox.id, provider: provider.provider_type,
        thread_id: result.thread_id, message_id: result.message_id,
      }),
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
