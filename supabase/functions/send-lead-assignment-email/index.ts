import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadAssignmentEmailRequest {
  sdrId: string;
  leadIds: string[];
  workspaceId: string;
  assignedBy?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sdrId, leadIds, workspaceId, assignedBy }: LeadAssignmentEmailRequest = await req.json();

    console.log(`Sending lead assignment email to SDR ${sdrId} for ${leadIds.length} leads`);

    if (!sdrId || !leadIds || leadIds.length === 0 || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'SDR ID, lead IDs, and workspace ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SDR profile
    const { data: sdrProfile, error: sdrError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', sdrId)
      .single();

    if (sdrError || !sdrProfile?.email) {
      console.error('SDR profile not found:', sdrError);
      return new Response(
        JSON.stringify({ error: 'SDR profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    // Get lead details
    const { data: leads } = await supabase
      .from('leads')
      .select('first_name, last_name, company, email, phone')
      .in('id', leadIds);

    // Get assigner name if provided
    let assignerName = 'Your agency';
    if (assignedBy) {
      const { data: assignerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignedBy)
        .single();
      assignerName = assignerProfile?.full_name || 'Your agency';
    }

    const leadCount = leadIds.length;
    const leadWord = leadCount === 1 ? 'lead' : 'leads';
    const agencyName = workspace?.name || 'your agency';

    // Build lead list HTML
    const leadListHtml = leads?.slice(0, 10).map(lead => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 16px; font-weight: 500;">${lead.first_name} ${lead.last_name}</td>
        <td style="padding: 12px 16px; color: #6b7280;">${lead.company || '-'}</td>
        <td style="padding: 12px 16px; color: #6b7280;">${lead.email || lead.phone || '-'}</td>
      </tr>
    `).join('') || '';

    const moreLeadsNote = leadCount > 10 
      ? `<p style="color: #6b7280; font-size: 14px; margin-top: 12px;">...and ${leadCount - 10} more ${leadCount - 10 === 1 ? 'lead' : 'leads'}</p>` 
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
                  🎯 New ${leadWord} Assigned!
                </h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                  Hi ${sdrProfile.full_name || 'there'},
                </p>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                  ${assignerName} has assigned you <strong>${leadCount} new ${leadWord}</strong> from <strong>${agencyName}</strong>.
                </p>

                <!-- Lead Table -->
                <div style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #f9fafb;">
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Name</th>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Company</th>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${leadListHtml}
                    </tbody>
                  </table>
                  ${moreLeadsNote}
                </div>

                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                  Log in to your dashboard to view and start working on these leads.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${Deno.env.get('SITE_URL') || 'https://app.example.com'}/crm" 
                     style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    View My Leads
                  </a>
                </div>

                <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 24px;">
                  Good luck closing those deals! 💪
                </p>
              </div>

              <!-- Footer -->
              <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  This is an automated notification from ${agencyName}
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Lead Notifications <onboarding@resend.dev>",
      to: [sdrProfile.email],
      subject: `🎯 ${leadCount} New ${leadWord} Assigned to You`,
      html: emailHtml,
    });

    console.log("Lead assignment email sent successfully:", emailResponse);

    // Also create an in-app notification
    await supabase.from('notifications').insert({
      user_id: sdrId,
      workspace_id: workspaceId,
      type: 'leads_assigned',
      title: `${leadCount} New ${leadWord} Assigned`,
      message: `${assignerName} assigned you ${leadCount} new ${leadWord}. Check your CRM to start working on them.`,
      data: {
        lead_ids: leadIds,
        lead_count: leadCount,
        assigned_by: assignedBy,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error sending lead assignment email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
