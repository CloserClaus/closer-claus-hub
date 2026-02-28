/**
 * React hook for the System Event Bus.
 * Provides track() with auto-resolved actor context.
 */
import { useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { trackEvent, ActorType } from '@/lib/eventBus';

export function useEventBus() {
  const { user, userRole } = useAuth();
  const { currentWorkspace } = useWorkspace();
  
  const userRef = useRef(user);
  const roleRef = useRef(userRole);
  const wsRef = useRef(currentWorkspace);
  userRef.current = user;
  roleRef.current = userRole;
  wsRef.current = currentWorkspace;

  const track = useCallback((
    eventType: string,
    opts?: {
      objectType?: string;
      objectId?: string;
      metadata?: Record<string, any>;
      organizationId?: string;
    }
  ) => {
    const role = roleRef.current;
    let actorType: ActorType = 'system';
    if (role === 'platform_admin') actorType = 'admin';
    else if (role === 'agency_owner') actorType = 'owner';
    else if (role === 'sdr') actorType = 'sales_rep';

    trackEvent({
      event_type: eventType,
      actor_type: actorType,
      actor_id: userRef.current?.id,
      organization_id: opts?.organizationId || wsRef.current?.id,
      object_type: opts?.objectType,
      object_id: opts?.objectId,
      metadata: opts?.metadata,
    });
  }, []);

  return { track };
}
