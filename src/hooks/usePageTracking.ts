import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function getSessionId(): string {
  let sid = sessionStorage.getItem('_cc_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('_cc_sid', sid);
  }
  return sid;
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

async function trackPageView(path: string, userId: string | null) {
  const sessionId = getSessionId();
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(`https://${projectId}.supabase.co/functions/v1/track-pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
        session_id: sessionId,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        user_id: userId,
      }),
      keepalive: true,
    });
  } catch {
    // Silent fail - analytics should never break the app
  }
}

export function usePageTracking() {
  const location = useLocation();
  const userIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>('');

  // Get user id once
  useEffect(() => {
    getUserId().then(id => { userIdRef.current = id; });
  }, []);

  // Track on route change
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (fullPath === lastPathRef.current) return;
    lastPathRef.current = fullPath;
    trackPageView(fullPath, userIdRef.current);
  }, [location.pathname, location.search]);

  // Heartbeat every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const fullPath = location.pathname + location.search;
      trackPageView(fullPath, userIdRef.current);
    }, 30000);

    return () => clearInterval(interval);
  }, [location.pathname, location.search]);
}
