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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { connection_id, to_email, subject, body, lead_id, workspace_id } = await req.json();

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) throw new Error('Email connection not found');

    // Route to provider
    // For now, we log the email. Actual provider integration would happen here
    // based on connection.provider and connection.api_key
    let sendStatus = 'sent';

    // Log the email
    const { error: logError } = await supabase.from('email_logs').insert({
      workspace_id,
      lead_id,
      sent_by: user.id,
      provider: connection.provider,
      subject,
      body,
      status: sendStatus,
    });

    if (logError) throw logError;

    // Update lead's last_contacted_at
    if (lead_id) {
      await supabase
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead_id);
    }

    return new Response(
      JSON.stringify({ success: true, status: sendStatus }),
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
