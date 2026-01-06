import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractRequestEmailPayload {
  type: 'submitted' | 'approved' | 'rejected' | 'contract_sent' | 'deal_won';
  recipientEmail: string;
  recipientName: string;
  dealTitle: string;
  dealValue: number;
  agencyName: string;
  sdrName?: string;
  rejectionReason?: string;
  clientName?: string;
  commissionAmount?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: ContractRequestEmailPayload = await req.json();
    const { type, recipientEmail, recipientName, dealTitle, dealValue, agencyName, sdrName, rejectionReason, clientName, commissionAmount } = payload;

    console.log(`Sending contract request ${type} email to:`, recipientEmail);

    const resend = new Resend(resendApiKey);
    
    let subject: string;
    let content: string;

    switch (type) {
      case 'submitted':
        subject = `New Contract Request: ${dealTitle}`;
        content = `
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p><strong>${sdrName || 'An SDR'}</strong> has submitted a contract request for your review.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6366f1;">Contract Request Details</h3>
            <p><strong>Deal:</strong> ${dealTitle}</p>
            <p><strong>Value:</strong> $${dealValue.toLocaleString()}</p>
          </div>
          <p>Please log in to review the request and approve or reject it.</p>
        `;
        break;
      
      case 'approved':
        subject = `Contract Request Approved: ${dealTitle}`;
        content = `
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Great news! Your contract request has been <strong style="color: #10b981;">approved</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6366f1;">Contract Details</h3>
            <p><strong>Deal:</strong> ${dealTitle}</p>
            <p><strong>Value:</strong> $${dealValue.toLocaleString()}</p>
            <p><strong>Agency:</strong> ${agencyName}</p>
          </div>
          <p>The agency will now prepare and send the contract to your client.</p>
        `;
        break;
      
      case 'rejected':
        subject = `Contract Request Rejected: ${dealTitle}`;
        content = `
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Unfortunately, your contract request has been <strong style="color: #ef4444;">rejected</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6366f1;">Contract Details</h3>
            <p><strong>Deal:</strong> ${dealTitle}</p>
            <p><strong>Value:</strong> $${dealValue.toLocaleString()}</p>
            ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
          </div>
          <p>Please review the feedback and submit a new request if needed.</p>
        `;
        break;
      
      case 'contract_sent':
        subject = `Contract Sent to Client: ${dealTitle}`;
        content = `
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Great news! The contract for your deal has been <strong style="color: #6366f1;">sent to the client</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6366f1;">Contract Details</h3>
            <p><strong>Deal:</strong> ${dealTitle}</p>
            <p><strong>Value:</strong> $${dealValue.toLocaleString()}</p>
            <p><strong>Client:</strong> ${clientName || 'Client'}</p>
            <p><strong>Agency:</strong> ${agencyName}</p>
          </div>
          <p>The client has received a signing link. You'll be notified once they sign!</p>
        `;
        break;
      
      case 'deal_won':
        subject = `🎉 Deal Won! Contract Signed: ${dealTitle}`;
        content = `
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p><strong style="color: #10b981; font-size: 18px;">🎉 Congratulations!</strong></p>
          <p>Your deal has been <strong style="color: #10b981;">closed and won</strong>! The client has signed the contract.</p>
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: white;">
            <h3 style="margin-top: 0; color: white;">🏆 Deal Closed</h3>
            <p style="margin: 8px 0;"><strong>Deal:</strong> ${dealTitle}</p>
            <p style="margin: 8px 0;"><strong>Value:</strong> $${dealValue.toLocaleString()}</p>
            ${commissionAmount ? `<p style="margin: 8px 0;"><strong>Your Commission:</strong> $${commissionAmount.toLocaleString()}</p>` : ''}
          </div>
          <p>Great work! Your commission is now pending and will be processed by the agency.</p>
        `;
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: "Invalid email type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const emailResponse = await resend.emails.send({
      from: "Contracts <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Contract Update</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            ${content}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Contract request email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending contract request email:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
