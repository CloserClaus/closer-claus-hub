import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "commission_created" | "commission_due" | "commission_overdue" | "account_locked" | "auto_charge_failed";
  to_email: string;
  to_name: string;
  workspace_name: string;
  amount?: number;
  days_overdue?: number;
  deal_title?: string;
  sdr_name?: string;
  commission_count?: number;
  error_reason?: string;
  last4?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured - email notification skipped");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { type, to_email, to_name, workspace_name, amount, days_overdue, commission_count, deal_title, sdr_name, error_reason, last4 }: EmailRequest = await req.json();

    let subject = "";
    let html = "";

    switch (type) {
      case "commission_created":
        subject = `New Commission Created - ${deal_title || 'Deal Closed'}`;
        html = `
          <h1>Commission Payment Required</h1>
          <p>Hi ${to_name},</p>
          <p>A new commission has been created for <strong>${workspace_name}</strong>.</p>
          <p><strong>Deal:</strong> ${deal_title || 'N/A'}</p>
          <p><strong>SDR:</strong> ${sdr_name || 'N/A'}</p>
          <p><strong>Amount Due:</strong> $${amount?.toFixed(2)}</p>
          <p>Please complete the payment within 7 days to avoid automatic charging.</p>
          <p>Best regards,<br>The Closer Claus Team</p>
        `;
        break;

      case "commission_due":
        subject = `Commission Payment Due - ${workspace_name}`;
        html = `
          <h1>Commission Payment Reminder</h1>
          <p>Hi ${to_name},</p>
          <p>You have a commission payment of <strong>$${amount?.toFixed(2)}</strong> due for ${workspace_name}.</p>
          <p>Please complete the payment within 7 days to avoid automatic charging.</p>
          <p>Best regards,<br>The Closer Claus Team</p>
        `;
        break;

      case "commission_overdue":
        subject = `Action Required: Overdue Commission - ${workspace_name}`;
        html = `
          <h1>Commission Payment Overdue</h1>
          <p>Hi ${to_name},</p>
          <p>Your commission payment of <strong>$${amount?.toFixed(2)}</strong> for ${workspace_name} is now <strong>${days_overdue} days overdue</strong>.</p>
          <p>Your card on file will be charged automatically. If payment fails, your account may be locked.</p>
          <p>Best regards,<br>The Closer Claus Team</p>
        `;
        break;

      case "account_locked":
        subject = `Account Locked - ${workspace_name}`;
        html = `
          <h1>Your Account Has Been Locked</h1>
          <p>Hi ${to_name},</p>
          <p>Your ${workspace_name} account has been locked due to <strong>${commission_count} overdue commission(s)</strong> totaling <strong>$${amount?.toFixed(2)}</strong>.</p>
          <p>Please contact support to resolve outstanding payments and unlock your account.</p>
          <p>Best regards,<br>The Closer Claus Team</p>
        `;
        break;

      case "auto_charge_failed":
        subject = `Payment Failed - Action Required - ${workspace_name}`;
        html = `
          <h1>Automatic Payment Failed</h1>
          <p>Hi ${to_name},</p>
          <p>We attempted to automatically charge your payment method for a commission payment of <strong>$${amount?.toFixed(2)}</strong> for ${workspace_name}, but it was declined.</p>
          ${last4 ? `<p><strong>Card ending in:</strong> ${last4}</p>` : ''}
          ${error_reason ? `<p><strong>Reason:</strong> ${error_reason}</p>` : ''}
          <p>Please update your payment method or complete the payment manually to avoid account restrictions.</p>
          <p>You can update your payment method in Settings → Billing.</p>
          <p>Best regards,<br>The Closer Claus Team</p>
        `;
        break;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Closer Claus <notifications@resend.dev>",
        to: [to_email],
        subject,
        html,
      }),
    });

    const result = await response.json();
    console.log(`Email sent (${type}) to ${to_email}:`, result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
