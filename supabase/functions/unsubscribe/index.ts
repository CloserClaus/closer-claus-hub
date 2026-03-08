import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


async function generateHmacSHA256(leadId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(leadId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get('lead_id');
    const token = url.searchParams.get('token');

    if (!leadId || !token) {
      return new Response(renderHtml('Invalid Link', 'This unsubscribe link is invalid or has expired.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedToken = await generateHmacSHA256(leadId, secret);

    if (token !== expectedToken) {
      return new Response(renderHtml('Invalid Link', 'This unsubscribe link is invalid or has expired.'), {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, secret);

    // Mark lead as opted out
    const { error } = await supabase
      .from('leads')
      .update({
        opted_out: true,
        opted_out_at: new Date().toISOString(),
      } as any)
      .eq('id', leadId);

    if (error) {
      console.error('Unsubscribe error:', error);
      return new Response(renderHtml('Error', 'Something went wrong. Please try again later.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Stop any active sequences for this lead
    await supabase
      .from('active_follow_ups')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('status', 'active');

    // Update lead email state
    await supabase
      .from('leads')
      .update({ email_sending_state: 'idle' } as any)
      .eq('id', leadId);

    // Audit log
    const { data: lead } = await supabase
      .from('leads')
      .select('workspace_id')
      .eq('id', leadId)
      .single();

    if (lead) {
      await supabase.from('email_audit_log').insert({
        workspace_id: lead.workspace_id,
        action_type: 'lead_unsubscribed',
        lead_id: leadId,
        metadata: { method: 'email_link' },
      });
    }

    return new Response(renderHtml('Unsubscribed', 'You have been successfully unsubscribed. You will no longer receive emails from us.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    return new Response(renderHtml('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { font-size: 16px; color: #6b7280; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
