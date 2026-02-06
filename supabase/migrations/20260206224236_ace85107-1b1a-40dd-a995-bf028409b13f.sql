-- Backfill: deduct all historical completed call minutes from workspace credits
UPDATE workspace_credits wc
SET free_minutes_remaining = GREATEST(
  0,
  wc.free_minutes_remaining - COALESCE(
    (SELECT CEIL(SUM(cl.duration_seconds)::numeric / 60)
     FROM call_logs cl
     WHERE cl.workspace_id = wc.workspace_id
       AND cl.call_status = 'completed'
       AND cl.duration_seconds > 0),
    0
  )
),
updated_at = now();