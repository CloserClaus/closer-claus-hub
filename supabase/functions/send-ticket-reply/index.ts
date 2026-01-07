import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketReplyRequest {
  userEmail: string;
  userName: string;
  ticketTitle: string;
  replyMessage: string;
  ticketId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, ticketTitle, replyMessage, ticketId }: TicketReplyRequest = await req.json();

    console.log(`Sending ticket reply notification to ${userEmail} for ticket ${ticketId}`);

    if (RESEND_API_KEY) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Update on Your Support Ticket</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Our support team has responded to your ticket:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Ticket:</strong> ${ticketTitle}</p>
            <p style="margin: 0 0 10px 0;"><strong>Ticket ID:</strong> ${ticketId.slice(0, 8).toUpperCase()}</p>
            <hr style="border: 1px solid #ddd; margin: 15px 0;" />
            <p style="margin: 0;"><strong>Response:</strong></p>
            <div style="white-space: pre-wrap; margin-top: 10px; padding: 15px; background: white; border-radius: 4px; border-left: 4px solid #007bff;">
              ${replyMessage}
            </div>
          </div>
          
          <p>If you have any additional questions, simply reply to this email or submit a new ticket through the help widget.</p>
          <p>Best regards,<br/>The CloserClaus Support Team</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            This is an automated message from CloserClaus Support.
          </p>
        </div>
      `;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "CloserClaus Support <support@closerclaus.com>",
          to: [userEmail],
          subject: `Update on your support ticket: ${ticketTitle}`,
          html: emailHtml,
        }),
      });

      if (!emailRes.ok) {
        const errorText = await emailRes.text();
        console.error("Failed to send ticket reply email:", errorText);
        throw new Error(`Email sending failed: ${errorText}`);
      }

      console.log("Ticket reply email sent successfully");
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notification");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Error in send-ticket-reply:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
