/**
 * System Event Bus — Centralized event logging for CloserClaus
 * 
 * RULE: All future features MUST log actions through this system.
 * Do NOT create tracking logic outside this module.
 */
import { supabase } from '@/integrations/supabase/client';

export type ActorType = 'owner' | 'sales_rep' | 'system' | 'admin';

export interface SystemEvent {
  event_type: string;
  actor_type: ActorType;
  actor_id?: string;
  organization_id?: string;
  object_type?: string;
  object_id?: string;
  metadata?: Record<string, any>;
}

// In-memory queue for retry
const eventQueue: SystemEvent[] = [];
let isProcessing = false;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function flushQueue() {
  if (isProcessing || eventQueue.length === 0) return;
  isProcessing = true;

  while (eventQueue.length > 0) {
    const event = eventQueue[0];
    let retries = 0;
    let success = false;

    while (retries < MAX_RETRIES && !success) {
      try {
        const { error } = await supabase.from('system_events').insert({
          event_type: event.event_type,
          actor_type: event.actor_type,
          actor_id: event.actor_id || null,
          organization_id: event.organization_id || null,
          object_type: event.object_type || null,
          object_id: event.object_id || null,
          metadata: event.metadata || {},
        });
        if (error) throw error;
        success = true;
      } catch {
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY * retries));
        }
      }
    }

    // Remove from queue regardless (don't block on permanent failures)
    eventQueue.shift();
  }

  isProcessing = false;
}

/**
 * Track a system event asynchronously.
 * Never blocks UI. Retries on failure.
 */
export function trackEvent(event: SystemEvent): void {
  eventQueue.push(event);
  // Fire and forget - never blocks
  queueMicrotask(() => { flushQueue().catch(() => {}); });
}

/**
 * Helper to get current actor info from auth session.
 */
export async function getCurrentActor(): Promise<{ id: string; type: ActorType } | null> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    
    // Check role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .limit(1);
    
    const role = roles?.[0]?.role;
    let actorType: ActorType = 'sales_rep';
    if (role === 'platform_admin') actorType = 'admin';
    else if (role === 'agency_owner') actorType = 'owner';
    
    return { id: data.user.id, type: actorType };
  } catch {
    return null;
  }
}

/**
 * Convenience: track with auto-resolved actor.
 */
export async function trackEventWithActor(
  event: Omit<SystemEvent, 'actor_type' | 'actor_id'> & { actor_type?: ActorType; actor_id?: string }
): Promise<void> {
  if (event.actor_id && event.actor_type) {
    trackEvent(event as SystemEvent);
    return;
  }
  
  const actor = await getCurrentActor();
  trackEvent({
    ...event,
    actor_type: event.actor_type || actor?.type || 'system',
    actor_id: event.actor_id || actor?.id,
  });
}
