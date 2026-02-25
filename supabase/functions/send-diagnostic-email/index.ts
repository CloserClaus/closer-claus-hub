import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getReadinessEmoji(label: string): string {
  switch (label) {
    case 'Strong': return '🟢';
    case 'Moderate': return '🟡';
    case 'Weak': return '🔴';
    default: return '⚪';
  }
}

function getScoreInterpretation(score: number): string {
  if (score >= 80) return 'This offer is structurally ready for outbound.';
  if (score >= 60) return 'This offer can work in outbound with targeted fixes.';
  return 'This offer will struggle in outbound without structural changes.';
}

const LATENT_LABELS: Record<string, string> = {
  EFI: 'Economic Feasibility (EFI)',
  proofPromise: 'Proof-to-Promise Credibility',
  fulfillmentScalability: 'Fulfillment Scalability',
  riskAlignment: 'Risk Alignment',
  channelFit: 'Channel Fit',
  icpSpecificity: 'ICP Specificity',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, alignmentScore, readinessLabel, bottleneckLabel, latentScores, outboundReady, primaryBottleneck } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const scoreEmoji = getReadinessEmoji(readinessLabel);
    const interpretation = getScoreInterpretation(alignmentScore);

    // Build latent scores rows
    let latentScoresHtml = '';
    if (latentScores) {
      for (const [key, label] of Object.entries(LATENT_LABELS)) {
        const score = latentScores[key] ?? 0;
        const percentage = Math.round((score / 20) * 100);
        const color = percentage < 50 ? '#ef4444' : percentage < 75 ? '#eab308' : '#22c55e';
        latentScoresHtml += `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${label}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${color};">${score}/20</td>
          </tr>
        `;
      }
    }

    const outboundStatusHtml = outboundReady
      ? `<div style="background: #dcfce7; color: #166534; padding: 12px 16px; border-radius: 8px; font-weight: 600;">✅ Outbound Ready</div>`
      : `<div style="background: #fef2f2; color: #991b1b; padding: 12px 16px; border-radius: 8px; font-weight: 600;">⚠️ Outbound Blocked</div>`;

    const bottleneckHtml = bottleneckLabel
      ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-top: 16px;">
           <div style="font-weight: 600; color: #991b1b; margin-bottom: 4px;">Primary Constraint</div>
           <div style="color: #374151;">${bottleneckLabel}${primaryBottleneck?.severity === 'blocking' ? ' <span style="color: #ef4444; font-weight: 600;">(Blocking)</span>' : ''}</div>
         </div>`
      : '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 0; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="font-size: 24px; color: #111827; margin: 0;">Your Offer Diagnostic Results</h1>
            </div>

            <p style="color: #374151; font-size: 16px; line-height: 1.6;">${greeting}</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Here's your personalized Offer Diagnostic breakdown. Keep this email for reference as you optimize your offer.</p>

            <!-- Score -->
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; width: 120px; height: 120px; border-radius: 50%; border: 4px solid ${readinessLabel === 'Strong' ? '#22c55e' : readinessLabel === 'Moderate' ? '#eab308' : '#ef4444'}; line-height: 120px; text-align: center;">
                <span style="font-size: 36px; font-weight: 700; color: ${readinessLabel === 'Strong' ? '#22c55e' : readinessLabel === 'Moderate' ? '#eab308' : '#ef4444'};">${alignmentScore}</span>
              </div>
              <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">/ 100</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 600;">${scoreEmoji} ${readinessLabel}</div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">${interpretation}</p>
            </div>

            ${outboundStatusHtml}
            ${bottleneckHtml}

            <!-- Latent Scores -->
            ${latentScoresHtml ? `
              <div style="margin-top: 24px;">
                <h3 style="font-size: 16px; color: #111827; margin-bottom: 12px;">Score Breakdown</h3>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px;">
                  <thead>
                    <tr style="background: #f9fafb;">
                      <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Dimension</th>
                      <th style="padding: 8px 12px; text-align: right; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${latentScoresHtml}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <!-- CTA -->
            <div style="text-align: center; margin-top: 32px; padding: 24px; background: #f0f9ff; border-radius: 8px;">
              <p style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Want help scaling this?</p>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">Book a 30-minute slot and we'll walk through the exact roadmap.</p>
              <a href="https://calendly.com/closer_claus/30-minute-meeting" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Book a Call →</a>
            </div>

          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">Sent by CloserClaus • Offer Diagnostic Tool</p>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CloserClaus <noreply@closerclaus.com>',
        to: [email],
        subject: `Your Offer Diagnostic Score: ${alignmentScore}/100 (${readinessLabel})`,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    console.log('Diagnostic email sent successfully to:', email);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending diagnostic email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
