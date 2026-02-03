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

    console.log('Processing callback reminders...');

    // Find all pending callbacks that are due within the next 15 minutes
    // This allows the cron to run every 15 minutes and catch all due callbacks
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
    
    const { data: dueCallbacks, error: callbackError } = await supabase
      .from('scheduled_callbacks')
      .select(`
        id,
        workspace_id,
        lead_id,
        scheduled_for,
        reason,
        notes,
        created_by,
        leads:lead_id (
          first_name,
          last_name,
          company,
          phone
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', fifteenMinutesFromNow.toISOString())
      .gte('scheduled_for', now.toISOString());

    if (callbackError) {
      console.error('Error fetching due callbacks:', callbackError);
      throw callbackError;
    }

    console.log(`Found ${dueCallbacks?.length || 0} callbacks due for notification`);

    let notificationsSent = 0;

    for (const callback of dueCallbacks || []) {
      const lead = callback.leads as any;
      const leadName = lead 
        ? `${lead.first_name} ${lead.last_name}${lead.company ? ` at ${lead.company}` : ''}`
        : 'Unknown Lead';

      // Check if we already sent a notification for this callback
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'callback_reminder')
        .eq('data->>callback_id', callback.id)
        .single();

      if (existingNotification) {
        console.log(`Notification already sent for callback ${callback.id}, skipping`);
        continue;
      }

      // Create notification for the user who scheduled the callback
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: callback.created_by,
          workspace_id: callback.workspace_id,
          type: 'callback_reminder',
          title: 'Callback Reminder',
          message: `Time to call ${leadName}${lead?.phone ? ` (${lead.phone})` : ''}`,
          data: {
            callback_id: callback.id,
            lead_id: callback.lead_id,
            scheduled_for: callback.scheduled_for,
            reason: callback.reason,
            phone: lead?.phone,
          },
        });

      if (notifError) {
        console.error(`Error creating notification for callback ${callback.id}:`, notifError);
      } else {
        notificationsSent++;
        console.log(`Sent notification for callback ${callback.id} to user ${callback.created_by}`);
      }
    }

    // Also process callbacks scheduled for today that haven't been notified yet (morning reminder)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    
    // Only run the morning reminder check between 8 AM and 9 AM
    const currentHour = now.getHours();
    if (currentHour >= 8 && currentHour < 9) {
      const { data: todaysCallbacks, error: todayError } = await supabase
        .from('scheduled_callbacks')
        .select(`
          id,
          workspace_id,
          lead_id,
          scheduled_for,
          reason,
          notes,
          created_by,
          leads:lead_id (
            first_name,
            last_name,
            company
          )
        `)
        .eq('status', 'pending')
        .gte('scheduled_for', startOfToday.toISOString())
        .lte('scheduled_for', endOfToday.toISOString());

      if (!todayError && todaysCallbacks && todaysCallbacks.length > 0) {
        // Group callbacks by user
        const callbacksByUser = todaysCallbacks.reduce((acc, cb) => {
          if (!acc[cb.created_by]) acc[cb.created_by] = [];
          acc[cb.created_by].push(cb);
          return acc;
        }, {} as Record<string, typeof todaysCallbacks>);

        for (const [userId, userCallbacks] of Object.entries(callbacksByUser)) {
          // Check if we already sent a daily summary for this user today
          const { data: existingSummary } = await supabase
            .from('notifications')
            .select('id')
            .eq('type', 'callback_daily_summary')
            .eq('user_id', userId)
            .gte('created_at', startOfToday.toISOString())
            .single();

          if (existingSummary) {
            continue;
          }

          const { error: summaryError } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              workspace_id: userCallbacks[0].workspace_id,
              type: 'callback_daily_summary',
              title: 'Today\'s Callbacks',
              message: `You have ${userCallbacks.length} scheduled callback${userCallbacks.length !== 1 ? 's' : ''} today. Check your dialer to start calling.`,
              data: {
                callback_count: userCallbacks.length,
                callback_ids: userCallbacks.map(c => c.id),
              },
            });

          if (!summaryError) {
            notificationsSent++;
            console.log(`Sent daily summary to user ${userId} with ${userCallbacks.length} callbacks`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${dueCallbacks?.length || 0} due callbacks, sent ${notificationsSent} notifications` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Callback reminder processing error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
