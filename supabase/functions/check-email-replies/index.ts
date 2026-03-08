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
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting reply detection scan...');

    // Get all active follow-ups with their inbox info
    const { data: activeFollowUps, error: fupErr } = await supabase
      .from('active_follow_ups')
      .select('*, email_inboxes:sender_inbox_id(id, email_address, external_inbox_id, provider_id)')
      .eq('status', 'active');

    if (fupErr) {
      console.error('Error fetching active follow-ups:', fupErr);
      throw fupErr;
    }

    if (!activeFollowUps || activeFollowUps.length === 0) {
      console.log('No active follow-ups to check.');
      return new Response(JSON.stringify({ checked: 0, replies_found: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let repliesFound = 0;
    let checked = 0;

    // Group by inbox to minimize token refreshes
    const byInbox: Record<string, any[]> = {};
    for (const fup of activeFollowUps as any[]) {
      const inboxId = fup.sender_inbox_id;
      if (!inboxId || !fup.email_inboxes) continue;
      if (!byInbox[inboxId]) byInbox[inboxId] = [];
      byInbox[inboxId].push(fup);
    }

    for (const [inboxId, followUps] of Object.entries(byInbox)) {
      const inbox = followUps[0].email_inboxes;
      const refreshToken = inbox.external_inbox_id;
      if (!refreshToken) continue;

      // Refresh access token
      let accessToken: string;
      try {
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
          console.error(`Token refresh failed for inbox ${inbox.email_address}:`, tokenData);
          continue;
        }
        accessToken = tokenData.access_token;
      } catch (err) {
        console.error(`Token refresh exception for inbox ${inbox.email_address}:`, err);
        continue;
      }

      // For each active follow-up, check for replies
      for (const fup of followUps) {
        checked++;

        // Get the lead's email
        const { data: lead } = await supabase
          .from('leads')
          .select('email, first_name, last_name')
          .eq('id', fup.lead_id)
          .single();

        if (!lead?.email) continue;

        // Search Gmail for messages from this lead
        const query = `from:${lead.email} after:${Math.floor(new Date(fup.started_at).getTime() / 1000)}`;
        try {
          const searchRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=1`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          const searchData = await searchRes.json();

          if (searchData.messages && searchData.messages.length > 0) {
            const msgId = searchData.messages[0].id;

            // Dedup check: skip if we already processed this Gmail message
            const { data: existingMsg } = await supabase
              .from('email_conversation_messages')
              .select('id')
              .eq('gmail_message_id', msgId)
              .limit(1)
              .maybeSingle();

            if (existingMsg) {
              // Already processed this reply, skip
              continue;
            }

            // Reply detected!
            repliesFound++;
            console.log(`Reply detected from ${lead.email} for follow-up ${fup.id}`);

            // Stop the sequence
            await supabase
              .from('active_follow_ups')
              .update({
                status: 'replied',
                completed_at: new Date().toISOString(),
              })
              .eq('id', fup.id);

            // Update lead state
            await supabase
              .from('leads')
              .update({ email_sending_state: 'replied' } as any)
              .eq('id', fup.lead_id);

            // Update email conversation status
            if (fup.sequence_id) {
              await supabase
                .from('email_conversations')
                .update({ status: 'replied' } as any)
                .eq('sequence_id', fup.sequence_id)
                .eq('lead_id', fup.lead_id);
            }

            // Get the reply message content
            const msgId = searchData.messages[0].id;
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            const msgData = await msgRes.json();

            // Extract body
            let replyBody = '';
            if (msgData.payload?.body?.data) {
              replyBody = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (msgData.snippet) {
              replyBody = msgData.snippet;
            }

            // Store reply in conversation messages
            const { data: convo } = await supabase
              .from('email_conversations')
              .select('id')
              .eq('lead_id', fup.lead_id)
              .eq('workspace_id', fup.workspace_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (convo) {
              await supabase.from('email_conversation_messages').insert({
                conversation_id: convo.id,
                direction: 'inbound',
                subject: msgData.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'Re:',
                body: replyBody,
                sender_email: lead.email,
                message_type: 'email',
                gmail_message_id: msgId,
              } as any);
            }

            // Notify SDR
            await supabase.from('notifications').insert({
              user_id: fup.started_by,
              workspace_id: fup.workspace_id,
              type: 'email_reply',
              title: 'Email Reply Received',
              message: `${lead.first_name} ${lead.last_name} replied to your email sequence. The sequence has been stopped automatically.`,
              data: { lead_id: fup.lead_id, follow_up_id: fup.id },
            });

            // Audit log
            await supabase.from('email_audit_log').insert({
              workspace_id: fup.workspace_id,
              action_type: 'reply_detected',
              actor_id: fup.started_by,
              inbox_id: inboxId,
              lead_id: fup.lead_id,
              sequence_id: fup.sequence_id,
              metadata: { gmail_message_id: msgId, lead_email: lead.email },
            });
          }
        } catch (err) {
          console.error(`Gmail search error for lead ${lead.email}:`, err);
        }
      }
    }

    console.log(`Reply detection complete. Checked: ${checked}, Replies found: ${repliesFound}`);

    return new Response(
      JSON.stringify({ checked, replies_found: repliesFound }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Reply detection error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
