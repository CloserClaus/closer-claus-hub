import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function GmailOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/settings?gmail_error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!code || !state) {
      navigate('/settings?gmail_error=missing_params', { replace: true });
      return;
    }

    // Forward code + state to the edge function for server-side token exchange
    const exchangeToken = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('gmail-oauth-callback', {
          body: { action: 'exchange', code, state },
        });

        if (fnError || data?.error) {
          const errMsg = data?.error || fnError?.message || 'exchange_failed';
          navigate(`/settings?gmail_error=${encodeURIComponent(errMsg)}`, { replace: true });
          return;
        }

        // Success — redirect to email page
        const email = data?.email || '';
        navigate(`/email?gmail_connected=${encodeURIComponent(email)}`, { replace: true });
      } catch {
        setStatus('error');
        navigate('/settings?gmail_error=exchange_failed', { replace: true });
      }
    };

    exchangeToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Connecting your Gmail account...</p>
      </div>
    </div>
  );
}
