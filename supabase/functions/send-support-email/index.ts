import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupportEmailRequest {
  userEmail: string;
  userName: string;
  title: string;
  description: string;
  ticketId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, title, description, ticketId }: SupportEmailRequest = await req.json();

    // Send notification to support team
    if (RESEND_API_KEY) {
      const supportEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Support Ticket Submitted</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>From:</strong> ${userName} (${userEmail})</p>
            <p><strong>Subject:</strong> ${title}</p>
            <hr style="border: 1px solid #ddd; margin: 15px 0;" />
            <p><strong>Description:</strong></p>
            <p style="white-space: pre-wrap;">${description}</p>
          </div>
          <p style="color: #666; font-size: 12px;">Reply directly to this email to respond to the user.</p>
        </div>
      `;

      const supportEmailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "CloserClaus <noreply@closerclaus.com>",
          to: ["support@closerclaus.com"],
          reply_to: userEmail,
          subject: `[Support Ticket] ${title}`,
          html: supportEmailHtml,
        }),
      });

      if (!supportEmailRes.ok) {
        console.error("Failed to send support email:", await supportEmailRes.text());
      }

      // Send confirmation to user
      const userEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">We've Received Your Support Request</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Thank you for reaching out! We've received your support request and will get back to you as soon as possible.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>Subject:</strong> ${title}</p>
            <p><strong>Your message:</strong></p>
            <p style="white-space: pre-wrap; color: #666;">${description}</p>
          </div>
          <p>If you have any additional information to add, simply reply to this email.</p>
          <p>Best regards,<br/>The CloserClaus Support Team</p>
        </div>
      `;

      const userEmailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "CloserClaus Support <support@closerclaus.com>",
          to: [userEmail],
          subject: `We've received your support request: ${title}`,
          html: userEmailHtml,
        }),
      });

      if (!userEmailRes.ok) {
        console.error("Failed to send user confirmation email:", await userEmailRes.text());
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Error in send-support-email:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
