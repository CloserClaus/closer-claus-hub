import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutEmailRequest {
  type: 'processing' | 'paid' | 'failed' | 'held';
  to_email: string;
  to_name: string;
  amount: number;
  deal_title: string;
  agency_name?: string;
  transfer_id?: string;
  error_reason?: string;
}

const getEmailContent = (data: PayoutEmailRequest) => {
  const baseUrl = 'https://closer-claus.lovable.app';
  
  switch (data.type) {
    case 'processing':
      return {
        subject: `💸 Payout Processing - $${data.amount.toFixed(2)}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">💸 Payout Processing</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi ${data.to_name},</p>
    
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
      Great news! Your commission payout is being transferred to your bank account.
    </p>
    
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 8px 0;">Amount</td>
          <td style="text-align: right; font-weight: bold; color: #10b981; font-size: 20px;">$${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 8px 0;">Deal</td>
          <td style="text-align: right; color: #374151;">${data.deal_title}</td>
        </tr>
        ${data.agency_name ? `
        <tr>
          <td style="color: #6b7280; padding: 8px 0;">Agency</td>
          <td style="text-align: right; color: #374151;">${data.agency_name}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="color: #6b7280; padding: 8px 0;">Status</td>
          <td style="text-align: right;"><span style="background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 12px;">Processing</span></td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Payouts typically arrive in your bank account within 2-5 business days, depending on your bank.
    </p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${baseUrl}/commissions" style="background: #10b981; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">View Payout Details</a>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; text-align: center;">
      — The Closer Claus Team
    </p>
  </div>
</body>
</html>
        `,
      };

    case 'paid':
      return {
        subject: `✅ Payout Complete - $${data.amount.toFixed(2)} Deposited`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Money Deposited!</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi ${data.to_name},</p>
    
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
      Your commission has been successfully deposited to your bank account! 🎉
    </p>
    
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #a7f3d0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #065f46; padding: 8px 0;">Amount Deposited</td>
          <td style="text-align: right; font-weight: bold; color: #059669; font-size: 24px;">$${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color: #065f46; padding: 8px 0;">Deal</td>
          <td style="text-align: right; color: #065f46;">${data.deal_title}</td>
        </tr>
        <tr>
          <td style="color: #065f46; padding: 8px 0;">Status</td>
          <td style="text-align: right;"><span style="background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">Paid</span></td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${baseUrl}/commissions" style="background: #10b981; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">View All Payouts</a>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; text-align: center;">
      — The Closer Claus Team
    </p>
  </div>
</body>
</html>
        `,
      };

    case 'failed':
      return {
        subject: `⚠️ Payout Failed - Action Required`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Payout Failed</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi ${data.to_name},</p>
    
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
      Unfortunately, there was an issue transferring your commission payout. Don't worry – your money is safe and we'll retry once you update your bank details.
    </p>
    
    <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #fecaca;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #991b1b; padding: 8px 0;">Amount</td>
          <td style="text-align: right; font-weight: bold; color: #dc2626; font-size: 20px;">$${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color: #991b1b; padding: 8px 0;">Deal</td>
          <td style="text-align: right; color: #991b1b;">${data.deal_title}</td>
        </tr>
        ${data.error_reason ? `
        <tr>
          <td style="color: #991b1b; padding: 8px 0;">Reason</td>
          <td style="text-align: right; color: #991b1b; font-size: 14px;">${data.error_reason}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>What to do:</strong> Please check your bank account settings in the Payouts section to ensure your details are correct.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${baseUrl}/commissions" style="background: #ef4444; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">Update Bank Details</a>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; text-align: center;">
      — The Closer Claus Team
    </p>
  </div>
</body>
</html>
        `,
      };

    case 'held':
      return {
        subject: `🏦 Connect Your Bank - $${data.amount.toFixed(2)} Waiting`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🏦 Payout Waiting</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi ${data.to_name},</p>
    
    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
      Congratulations! You've earned a commission, but we need your bank details to send you the money.
    </p>
    
    <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #fcd34d;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #92400e; padding: 8px 0;">Amount Waiting</td>
          <td style="text-align: right; font-weight: bold; color: #d97706; font-size: 24px;">$${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color: #92400e; padding: 8px 0;">Deal</td>
          <td style="text-align: right; color: #92400e;">${data.deal_title}</td>
        </tr>
        ${data.agency_name ? `
        <tr>
          <td style="color: #92400e; padding: 8px 0;">Agency</td>
          <td style="text-align: right; color: #92400e;">${data.agency_name}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="color: #92400e; padding: 8px 0;">Status</td>
          <td style="text-align: right;"><span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">Held</span></td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Connect your bank account now and we'll automatically send your payout. It only takes a minute!
    </p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${baseUrl}/commissions" style="background: #f59e0b; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">Connect Bank Account</a>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; text-align: center;">
      — The Closer Claus Team
    </p>
  </div>
</body>
</html>
        `,
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PayoutEmailRequest = await req.json();

    if (!data.to_email || !data.type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to_email, type' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailContent = getEmailContent(data);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Closer Claus <notifications@closerclaus.com>",
        to: [data.to_email],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await emailResponse.json();
    console.log("Payout email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-payout-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
