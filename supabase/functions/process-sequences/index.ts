import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing due sequence emails...');

    const now = new Date().toISOString();

    // Get all active follow-ups where next_send_at <= now
    const { data: dueFollowUps, error: fetchErr } = await supabase
      .from('active_follow_ups')
      .select('*')
      .eq('status', 'active')
      .lte('next_send_at', now)
      .order('next_send_at', { ascending: true })
      .limit(50); // Process max 50 per run to avoid timeouts

    if (fetchErr) {
      console.error('Error fetching due follow-ups:', fetchErr);
      throw fetchErr;
    }

    if (!dueFollowUps || dueFollowUps.length === 0) {
      console.log('No due sequence emails to process.');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const fup of dueFollowUps as any[]) {
      try {
        // Get sequence steps
        const { data: steps } = await supabase
          .from('follow_up_sequence_steps')
          .select('*')
          .eq('sequence_id', fup.sequence_id)
          .order('step_order', { ascending: true });

        if (!steps || steps.length === 0) {
          console.log(`No steps for sequence ${fup.sequence_id}, marking completed.`);
          await supabase.from('active_follow_ups').update({
            status: 'completed',
            completed_at: now,
          }).eq('id', fup.id);
          continue;
        }

        const currentStep = (steps as any[]).find(s => s.step_order === fup.current_step);
        if (!currentStep) {
          // Current step doesn't exist, mark as completed
          await supabase.from('active_follow_ups').update({
            status: 'completed',
            completed_at: now,
          }).eq('id', fup.id);
          await supabase.from('leads').update({
            email_sending_state: 'idle',
          } as any).eq('id', fup.lead_id);
          continue;
        }

        // Get lead info for variable replacement
        const { data: lead } = await supabase
          .from('leads')
          .select('first_name, last_name, email, company, title, phone')
          .eq('id', fup.lead_id)
          .single();

        if (!lead?.email) {
          console.log(`Lead ${fup.lead_id} has no email, skipping.`);
          await supabase.from('active_follow_ups').update({
            status: 'error',
            completed_at: now,
          }).eq('id', fup.id);
          continue;
        }

        // Get inbox info
        const inboxId = fup.sender_inbox_id;
        if (!inboxId) {
          console.log(`No inbox for follow-up ${fup.id}, marking error.`);
          await supabase.from('active_follow_ups').update({ status: 'error', completed_at: now }).eq('id', fup.id);
          continue;
        }

        const { data: inbox } = await supabase
          .from('email_inboxes')
          .select('*, email_providers!inner(*)')
          .eq('id', inboxId)
          .single();

        if (!inbox) {
          await supabase.from('active_follow_ups').update({ status: 'error', completed_at: now }).eq('id', fup.id);
          continue;
        }

        const inboxData = inbox as any;
        const provider = inboxData.email_providers;

        // Check daily limit
        if (inboxData.sends_today >= inboxData.daily_send_limit) {
          console.log(`Inbox ${inboxData.email_address} hit daily limit, skipping.`);
          // Reschedule for next day
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          await supabase.from('active_follow_ups').update({
            next_send_at: tomorrow.toISOString(),
          }).eq('id', fup.id);
          continue;
        }

        // Check sending window from sequence or campaign settings
        const { data: settings } = await supabase
          .from('email_campaign_settings')
          .select('*')
          .eq('workspace_id', fup.workspace_id)
          .maybeSingle();

        // Replace variables in subject and body
        const replaceVars = (text: string) => {
          return text
            .replace(/\{\{first_name\}\}/g, lead.first_name || '')
            .replace(/\{\{last_name\}\}/g, lead.last_name || '')
            .replace(/\{\{company\}\}/g, lead.company || '')
            .replace(/\{\{title\}\}/g, lead.title || '')
            .replace(/\{\{email\}\}/g, lead.email || '')
            .replace(/\{\{phone\}\}/g, lead.phone || '');
        };

        const subject = replaceVars(currentStep.subject);
        const body = replaceVars(currentStep.body);

        // Random delay (stagger)
        const minDelay = settings?.random_delay_min_seconds ?? 45;
        const maxDelay = settings?.random_delay_max_seconds ?? 120;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        // Wait the random delay
        await new Promise(resolve => setTimeout(resolve, randomDelay * 1000));

        // Send via Gmail
        let sendSuccess = false;
        let threadId: string | null = null;
        let messageId: string | null = null;
        let errorReason: string | null = null;

        if (provider.provider_type === 'gmail') {
          const refreshToken = inboxData.external_inbox_id;
          if (!refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            errorReason = 'auth_expired';
          } else {
            try {
              // Refresh access token
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
                errorReason = 'auth_expired';
              } else {
                // Build and send email
                const emailLines = [
                  `From: ${inboxData.email_address}`,
                  `To: ${lead.email}`,
                  `Subject: ${subject}`,
                  'MIME-Version: 1.0',
                  'Content-Type: text/plain; charset=UTF-8',
                  '',
                  body,
                ];
                const rawEmail = emailLines.join('\r\n');
                const encoder = new TextEncoder();
                const encoded = encoder.encode(rawEmail);
                const base64 = btoa(String.fromCharCode(...encoded))
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=+$/, '');

                const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ raw: base64 }),
                });

                const sendData = await sendRes.json();
                if (sendRes.ok) {
                  sendSuccess = true;
                  threadId = sendData.threadId;
                  messageId = sendData.id;
                } else {
                  if (sendRes.status === 429) errorReason = 'rate_limit';
                  else if (sendRes.status === 401 || sendRes.status === 403) errorReason = 'auth_expired';
                  else errorReason = 'api_failure';
                }
              }
            } catch (err: any) {
              console.error(`Gmail send error for fup ${fup.id}:`, err);
              errorReason = 'api_failure';
            }
          }
        } else {
          // Stub for other providers
          sendSuccess = true;
          messageId = `${provider.provider_type}-${crypto.randomUUID().slice(0, 8)}`;
        }

        if (sendSuccess) {
          // Log the email
          await supabase.from('email_logs').insert({
            workspace_id: fup.workspace_id,
            lead_id: fup.lead_id,
            sent_by: fup.started_by,
            provider: provider.provider_type,
            subject,
            body,
            status: 'sent',
            inbox_id: inboxId,
            sequence_id: fup.sequence_id,
            sequence_step: fup.current_step,
            thread_id: threadId,
            message_id: messageId,
          } as any);

          // Update conversation
          await supabase.from('email_conversations')
            .update({
              last_message_preview: body.substring(0, 100),
              last_activity_at: new Date().toISOString(),
            } as any)
            .eq('sequence_id', fup.sequence_id)
            .eq('lead_id', fup.lead_id);

          // Store outbound message in conversation
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
              direction: 'outbound',
              subject,
              body,
              sender_email: inboxData.email_address,
              message_type: 'email',
            } as any);
          }

          // Increment sends_today
          await supabase.from('email_inboxes')
            .update({ sends_today: (inboxData.sends_today || 0) + 1 } as any)
            .eq('id', inboxId);

          // Update lead last_contacted_at
          await supabase.from('leads')
            .update({ last_contacted_at: new Date().toISOString() })
            .eq('id', fup.lead_id);

          // Advance to next step or complete
          const nextStepOrder = fup.current_step + 1;
          const nextStep = (steps as any[]).find(s => s.step_order === nextStepOrder);

          if (nextStep) {
            const nextSendAt = new Date();
            nextSendAt.setDate(nextSendAt.getDate() + nextStep.delay_days);
            // Set to within sending window
            nextSendAt.setHours(9, 0, 0, 0);

            await supabase.from('active_follow_ups').update({
              current_step: nextStepOrder,
              next_send_at: nextSendAt.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', fup.id);
          } else {
            // Sequence complete
            await supabase.from('active_follow_ups').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', fup.id);

            await supabase.from('leads').update({
              email_sending_state: 'idle',
            } as any).eq('id', fup.lead_id);

            // Update conversation
            await supabase.from('email_conversations')
              .update({ status: 'completed' } as any)
              .eq('sequence_id', fup.sequence_id)
              .eq('lead_id', fup.lead_id);
          }

          // Audit log
          await supabase.from('email_audit_log').insert({
            workspace_id: fup.workspace_id,
            action_type: 'sequence_email_sent',
            actor_id: fup.started_by,
            inbox_id: inboxId,
            provider_id: provider.id,
            lead_id: fup.lead_id,
            sequence_id: fup.sequence_id,
            metadata: { step: fup.current_step, subject, thread_id: threadId },
          });

          processed++;
        } else {
          // Send failed
          await supabase.from('email_logs').insert({
            workspace_id: fup.workspace_id,
            lead_id: fup.lead_id,
            sent_by: fup.started_by,
            provider: provider.provider_type,
            subject,
            body,
            status: 'failed',
            inbox_id: inboxId,
            sequence_id: fup.sequence_id,
            sequence_step: fup.current_step,
            error_reason: errorReason,
          } as any);

          // Mark follow-up as error
          await supabase.from('active_follow_ups').update({
            status: 'error',
            completed_at: new Date().toISOString(),
          }).eq('id', fup.id);

          await supabase.from('leads').update({
            email_sending_state: 'error',
          } as any).eq('id', fup.lead_id);

          errors++;
        }
      } catch (err: any) {
        console.error(`Error processing follow-up ${fup.id}:`, err);
        errors++;
      }
    }

    console.log(`Sequence processing complete. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ processed, errors, total_due: dueFollowUps.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Process sequences error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
