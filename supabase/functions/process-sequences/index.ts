import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isWithinSendingWindow(settings: any): boolean {
  if (!settings?.sending_window_start || !settings?.sending_window_end) return true;

  const tz = settings.sending_timezone || 'America/New_York';
  const nowStr = new Date().toLocaleString('en-US', { timeZone: tz });
  const nowLocal = new Date(nowStr);
  const hours = nowLocal.getHours();
  const minutes = nowLocal.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = settings.sending_window_start.split(':').map(Number);
  const [endH, endM] = settings.sending_window_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

async function checkBounceThreshold(supabase: any, workspaceId: string, settings: any): Promise<boolean> {
  if (!settings?.auto_pause_on_bounce_threshold) return false;

  const threshold = settings.bounce_threshold_percent ?? 5;

  // Check emails from last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: totalCount } = await supabase
    .from('email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('sent_at', since);

  if (!totalCount || totalCount < 10) return false; // Not enough data

  const { count: bounceCount } = await supabase
    .from('email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'bounced')
    .gte('sent_at', since);

  const bounceRate = ((bounceCount || 0) / totalCount) * 100;
  return bounceRate >= threshold;
}

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
      .limit(50);

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

    // Group by workspace for settings lookup
    const workspaceIds = [...new Set(dueFollowUps.map((f: any) => f.workspace_id))];
    const settingsCache: Record<string, any> = {};
    const pausedWorkspaces = new Set<string>();

    // Pre-fetch settings for all workspaces
    for (const wsId of workspaceIds) {
      const { data: settings } = await supabase
        .from('email_campaign_settings')
        .select('*')
        .eq('workspace_id', wsId)
        .maybeSingle();
      settingsCache[wsId as string] = settings;

      // Check sending window
      if (!isWithinSendingWindow(settings)) {
        console.log(`Workspace ${wsId} outside sending window, skipping.`);
        pausedWorkspaces.add(wsId as string);
        continue;
      }

      // Check bounce threshold
      const breached = await checkBounceThreshold(supabase, wsId as string, settings);
      if (breached) {
        console.log(`Workspace ${wsId} breached bounce threshold, pausing all sequences.`);
        pausedWorkspaces.add(wsId as string);

        // Pause all active sequences for this workspace
        await supabase.from('active_follow_ups')
          .update({ status: 'paused' })
          .eq('workspace_id', wsId)
          .eq('status', 'active');

        // Audit log
        await supabase.from('email_audit_log').insert({
          workspace_id: wsId,
          action_type: 'bounce_threshold_paused',
          metadata: { reason: 'Bounce rate exceeded threshold' },
        });
      }
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const fup of dueFollowUps as any[]) {
      // Skip paused workspaces
      if (pausedWorkspaces.has(fup.workspace_id)) {
        skipped++;
        continue;
      }

      try {
        // Get sequence steps
        const { data: steps } = await supabase
          .from('follow_up_sequence_steps')
          .select('*')
          .eq('sequence_id', fup.sequence_id)
          .order('step_order', { ascending: true });

        if (!steps || steps.length === 0) {
          await supabase.from('active_follow_ups').update({
            status: 'completed', completed_at: now,
          }).eq('id', fup.id);
          continue;
        }

        const currentStep = (steps as any[]).find(s => s.step_order === fup.current_step);
        if (!currentStep) {
          await supabase.from('active_follow_ups').update({
            status: 'completed', completed_at: now,
          }).eq('id', fup.id);
          await supabase.from('leads').update({
            email_sending_state: 'idle',
          } as any).eq('id', fup.lead_id);
          continue;
        }

        // Get lead info
        const { data: lead } = await supabase
          .from('leads')
          .select('first_name, last_name, email, company, title, phone, opted_out')
          .eq('id', fup.lead_id)
          .single();

        if (!lead?.email) {
          await supabase.from('active_follow_ups').update({
            status: 'error', completed_at: now,
          }).eq('id', fup.id);
          continue;
        }

        // Check opt-out
        if (lead.opted_out) {
          await supabase.from('active_follow_ups').update({
            status: 'completed', completed_at: now,
          }).eq('id', fup.id);
          await supabase.from('leads').update({
            email_sending_state: 'idle',
          } as any).eq('id', fup.lead_id);
          console.log(`Lead ${fup.lead_id} opted out, skipping sequence.`);
          skipped++;
          continue;
        }

        // Get inbox info
        const inboxId = fup.sender_inbox_id;
        if (!inboxId) {
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
          console.log(`Inbox ${inboxData.email_address} hit daily limit, rescheduling.`);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          await supabase.from('active_follow_ups').update({
            next_send_at: tomorrow.toISOString(),
          }).eq('id', fup.id);
          skipped++;
          continue;
        }

        // Check workspace concurrent send limit
        const settings = settingsCache[fup.workspace_id];
        const maxConcurrent = settings?.max_concurrent_sends ?? 3;
        // Simple concurrency: count emails sent in last 60 seconds
        const recentCutoff = new Date(Date.now() - 60_000).toISOString();
        const { count: recentSends } = await supabase
          .from('email_logs')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', fup.workspace_id)
          .gte('sent_at', recentCutoff);

        if ((recentSends || 0) >= maxConcurrent) {
          // Reschedule 2 minutes later
          const later = new Date(Date.now() + 2 * 60_000).toISOString();
          await supabase.from('active_follow_ups').update({ next_send_at: later }).eq('id', fup.id);
          skipped++;
          continue;
        }

        // Variable replacement
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
        let body = replaceVars(currentStep.body);

        // Append unsubscribe footer
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const encoder = new TextEncoder();
        const hmacKey = await crypto.subtle.importKey(
          'raw', encoder.encode(serviceKey),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(fup.lead_id));
        const unsubToken = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
        const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?lead_id=${fup.lead_id}&token=${unsubToken}`;
        body += `\n\n---\nIf you no longer wish to receive these emails, click here to unsubscribe: ${unsubUrl}`;

        // Random delay (stagger)
        const minDelay = settings?.random_delay_min_seconds ?? 45;
        const maxDelay = settings?.random_delay_max_seconds ?? 120;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
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
          sendSuccess = true;
          messageId = `${provider.provider_type}-${crypto.randomUUID().slice(0, 8)}`;
        }

        if (sendSuccess) {
          // Log email
          await supabase.from('email_logs').insert({
            workspace_id: fup.workspace_id,
            lead_id: fup.lead_id,
            sent_by: fup.started_by,
            provider: provider.provider_type,
            subject, body,
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

          // Store outbound message — match by sequence_id + lead_id for accuracy
          const { data: convo } = await supabase
            .from('email_conversations')
            .select('id')
            .eq('sequence_id', fup.sequence_id)
            .eq('lead_id', fup.lead_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (convo) {
            await supabase.from('email_conversation_messages').insert({
              conversation_id: convo.id,
              direction: 'outbound',
              subject, body,
              sender_email: inboxData.email_address,
              message_type: 'email',
            } as any);
          }

          // Increment sends_today atomically
          await supabase.rpc('increment_inbox_sends_today' as any, { p_inbox_id: inboxId }).catch(async () => {
            await supabase.from('email_inboxes')
              .update({ sends_today: (inboxData.sends_today || 0) + 1 } as any)
              .eq('id', inboxId);
          });

          // Update lead
          await supabase.from('leads')
            .update({ last_contacted_at: new Date().toISOString() })
            .eq('id', fup.lead_id);

          // Advance or complete
          const nextStepOrder = fup.current_step + 1;
          const nextStep = (steps as any[]).find(s => s.step_order === nextStepOrder);

          if (nextStep) {
            const nextSendAt = new Date();
            nextSendAt.setDate(nextSendAt.getDate() + nextStep.delay_days);
            // Schedule within sending window
            const windowStart = settings?.sending_window_start || '09:00';
            const [startH] = windowStart.split(':').map(Number);
            nextSendAt.setHours(startH, 0, 0, 0);

            await supabase.from('active_follow_ups').update({
              current_step: nextStepOrder,
              next_send_at: nextSendAt.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', fup.id);
          } else {
            await supabase.from('active_follow_ups').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', fup.id);

            await supabase.from('leads').update({
              email_sending_state: 'idle',
            } as any).eq('id', fup.lead_id);

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
          // Send failed — check if transient and retryable
          const isTransient = errorReason === 'rate_limit' || errorReason === 'api_failure';
          const currentRetry = fup.retry_count || 0;

          await supabase.from('email_logs').insert({
            workspace_id: fup.workspace_id,
            lead_id: fup.lead_id,
            sent_by: fup.started_by,
            provider: provider.provider_type,
            subject, body,
            status: 'failed',
            inbox_id: inboxId,
            sequence_id: fup.sequence_id,
            sequence_step: fup.current_step,
            error_reason: errorReason,
          } as any);

          if (isTransient && currentRetry < 3) {
            // Reschedule for 15 minutes later
            const retryAt = new Date(Date.now() + 15 * 60_000).toISOString();
            await supabase.from('active_follow_ups').update({
              next_send_at: retryAt,
              retry_count: currentRetry + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', fup.id);
            console.log(`Transient error for fup ${fup.id}, retry ${currentRetry + 1}/3 scheduled at ${retryAt}`);
          } else {
            // Permanent failure
            await supabase.from('active_follow_ups').update({
              status: 'error',
              completed_at: new Date().toISOString(),
            }).eq('id', fup.id);

            await supabase.from('leads').update({
              email_sending_state: 'error',
            } as any).eq('id', fup.lead_id);
          }

          errors++;
        }
      } catch (err: any) {
        console.error(`Error processing follow-up ${fup.id}:`, err);
        errors++;
      }
    }

    console.log(`Sequence processing complete. Processed: ${processed}, Errors: ${errors}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ processed, errors, skipped, total_due: dueFollowUps.length }),
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
