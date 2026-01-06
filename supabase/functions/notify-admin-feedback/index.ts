import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, title, description, userName, userEmail, userRole, targetAudience } = await req.json();

    console.log(`Received ${type} notification request from ${userName} (${userEmail})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all platform admins
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "platform_admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No platform admins found");
      return new Response(JSON.stringify({ success: true, message: "No admins to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map((r) => r.user_id);

    // Get admin emails
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw profilesError;
    }

    // Create in-app notifications for all admins
    const notifications = adminIds.map((adminId) => ({
      user_id: adminId,
      type: type === "bug" ? "new_bug_report" : "new_feature_request",
      title: type === "bug" ? "New Bug Report" : "New Feature Request",
      message: `${userName} submitted: "${title}"`,
      data: {
        submission_type: type,
        title,
        user_email: userEmail,
        user_role: userRole,
      },
    }));

    const { error: notifError } = await supabase.from("notifications").insert(notifications);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    } else {
      console.log(`Created ${notifications.length} in-app notifications`);
    }

    // Send email notifications if Resend is configured
    if (resendApiKey && adminProfiles && adminProfiles.length > 0) {
      const resend = new Resend(resendApiKey);

      const typeLabel = type === "bug" ? "Bug Report" : "Feature Request";
      const bgColor = type === "bug" ? "#ef4444" : "#f59e0b";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="background-color: ${bgColor}; padding: 24px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px;">New ${typeLabel}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px;">${title}</h2>
                      <p style="margin: 0 0 24px 0; color: #52525b; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${description}</p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; border-radius: 8px; padding: 16px;">
                        <tr>
                          <td style="padding: 8px 16px;">
                            <p style="margin: 0; color: #71717a; font-size: 14px;">Submitted by</p>
                            <p style="margin: 4px 0 0 0; color: #18181b; font-size: 16px; font-weight: 500;">${userName}</p>
                            <p style="margin: 4px 0 0 0; color: #52525b; font-size: 14px;">${userEmail}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 16px;">
                            <p style="margin: 0; color: #71717a; font-size: 14px;">User Role</p>
                            <p style="margin: 4px 0 0 0; color: #18181b; font-size: 16px; font-weight: 500;">${userRole}</p>
                          </td>
                        </tr>
                        ${type === "feature" && targetAudience ? `
                        <tr>
                          <td style="padding: 8px 16px;">
                            <p style="margin: 0; color: #71717a; font-size: 14px;">Target Audience</p>
                            <p style="margin: 4px 0 0 0; color: #18181b; font-size: 16px; font-weight: 500;">${targetAudience === "agency" ? "Agency Owners" : targetAudience === "sdr" ? "SDRs" : "Everyone"}</p>
                          </td>
                        </tr>
                        ` : ""}
                      </table>
                      
                      <p style="margin: 24px 0 0 0; color: #71717a; font-size: 14px; text-align: center;">
                        View and manage this in the admin dashboard.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      for (const admin of adminProfiles) {
        try {
          await resend.emails.send({
            from: "Closer Claus <notifications@closerclaus.com>",
            to: [admin.email],
            subject: `New ${typeLabel}: ${title}`,
            html: emailHtml,
          });
          console.log(`Email sent to admin: ${admin.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }
    } else {
      console.log("Resend not configured or no admin emails, skipping email notifications");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in notify-admin-feedback:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
