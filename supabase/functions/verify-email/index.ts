import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 10; // Max 10 verification attempts per minute per IP

// Rate limiting helper function
async function checkRateLimit(
  supabase: any,
  key: string,
  maxRequests: number
): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  // Clean old entries for this key
  await supabase
    .from('rate_limits')
    .delete()
    .eq('key', key)
    .lt('timestamp', windowStart);

  // Count recent requests
  const { count, error: countError } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('timestamp', windowStart);

  if (countError) {
    console.error('Rate limit check error:', countError);
    return { allowed: true };
  }

  const currentCount = count || 0;
  const allowed = currentCount < maxRequests;

  if (allowed) {
    await supabase.from('rate_limits').insert({
      key,
      timestamp: new Date().toISOString()
    });
  }

  return { allowed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Rate limit check
    const rateLimitKey = `verify_email_${clientIp}`;
    const { allowed } = await checkRateLimit(supabase, rateLimitKey, MAX_ATTEMPTS);
    
    if (!allowed) {
      console.log('Rate limit exceeded for verify-email:', { ip: clientIp });
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token format (should be two UUIDs joined by hyphen)
    if (typeof token !== 'string' || token.length > 100 || token.length < 10) {
      console.log('Invalid token format received:', { ip: clientIp });
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      console.log('Token not found or already used:', { ip: clientIp });
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as used
    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Update user's email_verified status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', tokenData.user_id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email verified for user:', tokenData.user_id);
    return new Response(
      JSON.stringify({ success: true, message: 'Email verified successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-email:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});