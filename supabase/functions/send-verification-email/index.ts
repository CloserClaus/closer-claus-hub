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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, email, full_name } = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a secure token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();

    // Store the token in the database
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

    if (tokenError) {
      console.error('Error storing token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build verification URL
    const appUrl = Deno.env.get('APP_URL') || 'https://xlgzxmzejlshsgeiidsz.lovableproject.com';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    // Check if Resend API key is configured
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured. Verification URL:', verificationUrl);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email verification token created (email sending not configured)',
          verification_url: verificationUrl // For development/testing
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Closer Claus <noreply@closerclaus.com>',
        to: email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0D0D0F;">Welcome to Closer Claus${full_name ? `, ${full_name}` : ''}!</h1>
            <p>Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; background-color: #4A7BF7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p style="color: #6B7280; font-size: 14px;">
              This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
              © ${new Date().getFullYear()} Closer Claus. All rights reserved.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verification email sent to:', email);
    return new Response(
      JSON.stringify({ success: true, message: 'Verification email sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-verification-email:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
