import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SignupNotification {
  type: "new_user" | "sdr_application";
  fullName: string;
  email: string;
  role?: string;
  // SDR application fields
  country?: string;
  experience?: string;
  resumeText?: string;
  resumeUrl?: string;
  referralCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SignupNotification = await req.json();
    const { type, fullName, email, role, country, experience, resumeText, resumeUrl, referralCode } = data;

    console.log(`Admin signup notification: ${type} from ${fullName} (${email})`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);

    const isApplication = type === "sdr_application";
    const subject = isApplication
      ? `New SDR Application: ${fullName}`
      : `New User Signup: ${fullName} (${role || "unknown"})`;

    const bgColor = isApplication ? "#f59e0b" : "#22c55e";
    const heading = isApplication ? "New SDR Application" : "New User Registration";

    const detailRows = [
      { label: "Name", value: fullName },
      { label: "Email", value: email },
    ];

    if (role) detailRows.push({ label: "Role", value: role === "agency_owner" ? "Agency Owner" : "SDR" });
    if (referralCode) detailRows.push({ label: "Referral Code", value: referralCode });
    if (country) detailRows.push({ label: "Country", value: country });
    if (experience) detailRows.push({ label: "Experience", value: experience });
    if (resumeText) detailRows.push({ label: "About / Resume", value: resumeText });
    if (resumeUrl) detailRows.push({ label: "Resume File", value: `<a href="${resumeUrl}" style="color:#2563eb;">Download Resume</a>` });

    const rowsHtml = detailRows
      .map(
        (r) => `
        <tr>
          <td style="padding:8px 16px;">
            <p style="margin:0;color:#71717a;font-size:14px;">${r.label}</p>
            <p style="margin:4px 0 0 0;color:#18181b;font-size:16px;font-weight:500;">${r.value}</p>
          </td>
        </tr>`
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color:${bgColor};padding:24px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;">${heading}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:8px;">
                      ${rowsHtml}
                    </table>
                    <p style="margin:24px 0 0 0;color:#71717a;font-size:14px;text-align:center;">
                      View details in the admin dashboard.
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

    await resend.emails.send({
      from: "Closer Claus <notifications@closerclaus.com>",
      to: ["Saransh@closerclaus.com"],
      subject,
      html: emailHtml,
    });

    console.log("Admin signup notification email sent to Saransh@closerclaus.com");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in notify-admin-signup:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
