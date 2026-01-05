import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractEmailRequest {
  contractId: string;
  leadEmail: string;
  leadName: string;
  contractTitle: string;
  dealTitle: string;
  dealValue: number;
  agencyName: string;
  signingUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      contractId,
      leadEmail,
      leadName,
      contractTitle,
      dealTitle,
      dealValue,
      agencyName,
      signingUrl,
    }: ContractEmailRequest = await req.json();

    console.log("Sending contract email:", { contractId, leadEmail, leadName });

    if (!leadEmail || !contractId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const emailResponse = await resend.emails.send({
      from: "Contracts <onboarding@resend.dev>",
      to: [leadEmail],
      subject: `Action Required: Please sign "${contractTitle}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contract Signing Request</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Contract Signing Request</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin-top: 0;">Hello <strong>${leadName}</strong>,</p>
            
            <p>${agencyName} has sent you a contract for your review and signature.</p>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #6366f1;">Contract Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Contract:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${contractTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Deal:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${dealTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Value:</td>
                  <td style="padding: 8px 0; font-weight: 600;">$${dealValue.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <p>To review and sign this contract, click the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review & Sign Contract
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              For your security, you will be asked to verify your email address with a one-time code before signing.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              If you did not expect this email or have questions, please contact ${agencyName} directly.
              <br><br>
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Contract email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending contract email:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
