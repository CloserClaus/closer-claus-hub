import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, to_email, to_name, tier, workspace_name, grace_period_end } = await req.json();

    if (!to_email || !type) {
      return new Response(JSON.stringify({ error: 'to_email and type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tierDisplay = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'your';
    const name = to_name || 'there';

    let subject = '';
    let htmlBody = '';

    switch (type) {
      case 'purchase':
        subject = `Welcome to Closer Claus ${tierDisplay} Plan! 🎉`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a;">Welcome aboard, ${name}! 🎉</h1>
            <p style="color: #4a4a4a; font-size: 16px;">Your <strong>${tierDisplay}</strong> plan is now active for <strong>${workspace_name || 'your agency'}</strong>.</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #166534; font-weight: bold;">✅ Subscription Activated</p>
              <p style="margin: 8px 0 0; color: #166534;">You now have access to all ${tierDisplay} plan features including leads, dialer, email campaigns, and more.</p>
            </div>
            <p style="color: #4a4a4a;">Your subscription will automatically renew each billing cycle. You can manage your subscription from the dashboard at any time.</p>
            <p style="color: #6b7280; font-size: 14px;">— The Closer Claus Team</p>
          </div>
        `;
        break;

      case 'renewal':
        subject = `Subscription Renewed — ${tierDisplay} Plan ✅`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a;">Subscription Renewed! ✅</h1>
            <p style="color: #4a4a4a; font-size: 16px;">Hi ${name}, your <strong>${tierDisplay}</strong> plan for <strong>${workspace_name || 'your agency'}</strong> has been successfully renewed.</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #166534;">Your 1,000 free calling minutes have been refreshed for this billing cycle.</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">— The Closer Claus Team</p>
          </div>
        `;
        break;

      case 'payment_failed':
        subject = `⚠️ Payment Failed — Action Required`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Payment Failed ⚠️</h1>
            <p style="color: #4a4a4a; font-size: 16px;">Hi ${name}, we were unable to process your subscription payment for <strong>${workspace_name || 'your agency'}</strong>.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b; font-weight: bold;">⏰ You have 7 days to update your payment method</p>
              <p style="margin: 8px 0 0; color: #991b1b;">If payment is not resolved${grace_period_end ? ` by ${new Date(grace_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ' within 7 days'}, your account will be restricted.</p>
            </div>
            <p style="color: #4a4a4a;">Please log in to your dashboard and update your payment method or contact support for assistance.</p>
            <p style="color: #6b7280; font-size: 14px;">— The Closer Claus Team</p>
          </div>
        `;
        break;

      case 'account_restricted':
        subject = `🔒 Account Restricted — Subscription Payment Overdue`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Account Restricted 🔒</h1>
            <p style="color: #4a4a4a; font-size: 16px;">Hi ${name}, your account for <strong>${workspace_name || 'your agency'}</strong> has been restricted due to non-payment.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;">Your premium features have been disabled. To regain access, please update your payment method and resubscribe.</p>
            </div>
            <p style="color: #4a4a4a;">Log in to your dashboard to reactivate your subscription.</p>
            <p style="color: #6b7280; font-size: 14px;">— The Closer Claus Team</p>
          </div>
        `;
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Closer Claus <notifications@closerclaus.com>',
        to: [to_email],
        subject,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Resend error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await res.json();
    console.log(`Sent ${type} subscription email to ${to_email}:`, result.id);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-subscription-email:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
