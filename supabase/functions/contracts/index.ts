import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SIGN_ATTEMPTS = 5; // Max 5 signing attempts per 10 minutes per IP
const MAX_GET_ATTEMPTS = 20; // Max 20 get contract attempts per 10 minutes per IP
const MAX_OTP_REQUESTS = 5; // Max 5 OTP requests per 10 minutes per email
const MAX_OTP_VERIFY_ATTEMPTS = 3; // Max 3 OTP verify attempts per session
const OTP_EXPIRY_MINUTES = 10;

// Helper function to sanitize name input - allow only safe characters
function sanitizeName(name: string): string {
  let sanitized = name.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, '');
  sanitized = sanitized.trim();
  sanitized = sanitized.replace(/\s+/g, ' ');
  return sanitized;
}

// Helper function to sanitize email
function sanitizeEmail(email: string): string {
  let sanitized = email.replace(/<[^>]*>/g, '').trim().toLowerCase();
  sanitized = sanitized.replace(/javascript:/gi, '');
  return sanitized;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Rate limiting helper function
async function checkRateLimit(
  supabase: any,
  key: string,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  await supabase
    .from('rate_limits')
    .delete()
    .eq('key', key)
    .lt('timestamp', windowStart);

  const { count, error: countError } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('timestamp', windowStart);

  if (countError) {
    console.error('Rate limit check error:', countError);
    return { allowed: true, remaining: maxRequests };
  }

  const currentCount = count || 0;
  const allowed = currentCount < maxRequests;
  const remaining = Math.max(0, maxRequests - currentCount - 1);

  if (allowed) {
    await supabase.from('rate_limits').insert({
      key,
      timestamp: new Date().toISOString()
    });
  }

  return { allowed, remaining };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    const { action, ...params } = await req.json();
    console.log(`Contract action: ${action}`, { ip: clientIp });

    switch (action) {
      case 'get_contract': {
        const { contractId } = params;

        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(contractId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid contract ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const rateLimitKey = `get_contract_${clientIp}`;
        const { allowed } = await checkRateLimit(supabase, rateLimitKey, MAX_GET_ATTEMPTS);
        
        if (!allowed) {
          console.log('Rate limit exceeded for get_contract:', { ip: clientIp });
          return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later.' }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Retry-After': '600'
              } 
            }
          );
        }

        const { data: contract, error } = await supabase
          .from('contracts')
          .select(`
            id,
            title,
            content,
            status,
            deal_id,
            deals (
              title,
              value,
              leads (
                first_name,
                last_name,
                email,
                company
              )
            )
          `)
          .eq('id', contractId)
          .single();

        if (error || !contract) {
          return new Response(
            JSON.stringify({ error: 'Contract not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (contract.status !== 'sent') {
          return new Response(
            JSON.stringify({ error: 'Contract is not available for signing', status: contract.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ contract }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'request_signing_otp': {
        const { contractId, email } = params;

        if (!contractId || !email) {
          return new Response(
            JSON.stringify({ error: 'Contract ID and email are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(contractId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid contract ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedEmail = sanitizeEmail(email);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limit OTP requests
        const rateLimitKey = `otp_request_${sanitizedEmail}_${contractId}`;
        const { allowed } = await checkRateLimit(supabase, rateLimitKey, MAX_OTP_REQUESTS);
        
        if (!allowed) {
          console.log('Rate limit exceeded for OTP request:', { email: sanitizedEmail, contractId });
          return new Response(
            JSON.stringify({ error: 'Too many verification code requests. Please try again later.' }),
            { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '600' } 
            }
          );
        }

        // Verify contract exists and is in 'sent' status, and get expected email
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select(`
            id, 
            status, 
            title,
            deals (
              title,
              leads (
                email,
                first_name,
                last_name
              )
            )
          `)
          .eq('id', contractId)
          .single();

        if (contractError || !contract) {
          return new Response(
            JSON.stringify({ error: 'Contract not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (contract.status !== 'sent') {
          return new Response(
            JSON.stringify({ error: 'Contract is not available for signing', status: contract.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate email matches expected lead email
        const expectedEmail = (contract.deals as any)?.leads?.email?.toLowerCase();
        
        if (!expectedEmail) {
          console.log('No lead email found for contract:', contractId);
          return new Response(
            JSON.stringify({ error: 'No recipient email associated with this contract' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (expectedEmail !== sanitizedEmail) {
          console.log('Email mismatch for OTP request:', { contractId, expectedEmail, providedEmail: sanitizedEmail });
          return new Response(
            JSON.stringify({ error: 'Email does not match contract recipient' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Invalidate any existing unused OTPs for this contract/email
        await supabase
          .from('contract_signing_otps')
          .update({ expires_at: new Date().toISOString() })
          .eq('contract_id', contractId)
          .eq('email', sanitizedEmail)
          .is('verified_at', null);

        // Generate new OTP
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        const { error: insertError } = await supabase
          .from('contract_signing_otps')
          .insert({
            contract_id: contractId,
            email: sanitizedEmail,
            otp_code: otpCode,
            expires_at: expiresAt,
          });

        if (insertError) {
          console.error('Error creating OTP:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to generate verification code' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Send OTP via email
        if (!resendApiKey) {
          console.error('RESEND_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Email service not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const resend = new Resend(resendApiKey);
        const leadName = `${(contract.deals as any)?.leads?.first_name || ''} ${(contract.deals as any)?.leads?.last_name || ''}`.trim() || 'there';

        try {
          await resend.emails.send({
            from: "Contracts <onboarding@resend.dev>",
            to: [sanitizedEmail],
            subject: `Your verification code: ${otpCode}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 20px;">Verification Code</h1>
                </div>
                
                <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="margin-top: 0;">Hello ${leadName},</p>
                  
                  <p>Use this code to verify your identity and sign "${contract.title}":</p>
                  
                  <div style="background: white; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${otpCode}</span>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px;">
                    This code expires in ${OTP_EXPIRY_MINUTES} minutes.
                  </p>
                  
                  <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                    If you did not request this code, please ignore this email.
                  </p>
                </div>
              </body>
              </html>
            `,
          });
          console.log('OTP email sent successfully to:', sanitizedEmail);
        } catch (emailErr) {
          console.error('Failed to send OTP email:', emailErr);
          return new Response(
            JSON.stringify({ error: 'Failed to send verification email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Verification code sent to your email',
            expiresInMinutes: OTP_EXPIRY_MINUTES
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify_signing_otp': {
        const { contractId, email, otpCode } = params;

        if (!contractId || !email || !otpCode) {
          return new Response(
            JSON.stringify({ error: 'Contract ID, email, and verification code are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedEmail = sanitizeEmail(email);
        const sanitizedOtp = otpCode.toString().trim();

        // Get the latest valid OTP for this contract/email
        const { data: otpRecord, error: otpError } = await supabase
          .from('contract_signing_otps')
          .select('*')
          .eq('contract_id', contractId)
          .eq('email', sanitizedEmail)
          .is('verified_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (otpError || !otpRecord) {
          console.log('No valid OTP found:', { contractId, email: sanitizedEmail });
          return new Response(
            JSON.stringify({ error: 'No valid verification code found. Please request a new one.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check attempt limit
        if (otpRecord.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
          console.log('OTP attempt limit exceeded:', { contractId, email: sanitizedEmail });
          return new Response(
            JSON.stringify({ error: 'Too many incorrect attempts. Please request a new code.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Increment attempts
        await supabase
          .from('contract_signing_otps')
          .update({ attempts: otpRecord.attempts + 1 })
          .eq('id', otpRecord.id);

        // Verify OTP
        if (otpRecord.otp_code !== sanitizedOtp) {
          const remainingAttempts = MAX_OTP_VERIFY_ATTEMPTS - otpRecord.attempts - 1;
          console.log('Invalid OTP entered:', { contractId, email: sanitizedEmail, remainingAttempts });
          return new Response(
            JSON.stringify({ 
              error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate session token
        const sessionToken = crypto.randomUUID();

        // Mark OTP as verified
        const { error: updateError } = await supabase
          .from('contract_signing_otps')
          .update({ 
            verified_at: new Date().toISOString(),
            session_token: sessionToken 
          })
          .eq('id', otpRecord.id);

        if (updateError) {
          console.error('Error updating OTP record:', updateError);
          return new Response(
            JSON.stringify({ error: 'Verification failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('OTP verified successfully:', { contractId, email: sanitizedEmail });

        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionToken,
            message: 'Email verified successfully' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sign_contract': {
        const { contractId, signerName, signerEmail, signatureData, agreed, sessionToken } = params;

        if (!contractId || !signerName || !signerEmail || !agreed) {
          return new Response(
            JSON.stringify({ error: 'All fields are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Require session token for verified signing
        if (!sessionToken) {
          return new Response(
            JSON.stringify({ error: 'Email verification required before signing' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(contractId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid contract ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate session token
        const sanitizedEmail = sanitizeEmail(signerEmail);
        const { data: otpRecord, error: otpError } = await supabase
          .from('contract_signing_otps')
          .select('*')
          .eq('contract_id', contractId)
          .eq('email', sanitizedEmail)
          .eq('session_token', sessionToken)
          .not('verified_at', 'is', null)
          .single();

        if (otpError || !otpRecord) {
          console.log('Invalid or expired session token:', { contractId, email: sanitizedEmail });
          return new Response(
            JSON.stringify({ error: 'Invalid or expired verification session. Please verify your email again.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check session token is still valid (within 30 minutes of verification)
        const verifiedAt = new Date(otpRecord.verified_at);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (verifiedAt < thirtyMinutesAgo) {
          console.log('Session token expired:', { contractId, email: sanitizedEmail, verifiedAt });
          return new Response(
            JSON.stringify({ error: 'Verification session expired. Please verify your email again.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limit check for sign_contract
        const rateLimitKey = `sign_contract_${clientIp}`;
        const { allowed } = await checkRateLimit(supabase, rateLimitKey, MAX_SIGN_ATTEMPTS);
        
        if (!allowed) {
          console.log('Rate limit exceeded for sign_contract:', { ip: clientIp, contractId });
          return new Response(
            JSON.stringify({ error: 'Too many signing attempts. Please try again later.' }),
            { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '600' } 
            }
          );
        }

        // Validate input lengths
        if (signerName.length > 200 || signerEmail.length > 255) {
          return new Response(
            JSON.stringify({ error: 'Input exceeds maximum length' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedName = sanitizeName(signerName);

        if (sanitizedName.length < 2 || sanitizedName.length > 200) {
          return new Response(
            JSON.stringify({ error: 'Invalid name provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ipAddress = clientIp;
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Verify contract exists and is in 'sent' status
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select(`
            id, 
            status, 
            deal_id, 
            workspace_id,
            deals (
              leads (
                email
              )
            )
          `)
          .eq('id', contractId)
          .single();

        if (contractError || !contract) {
          console.log('Contract signing attempt failed - contract not found:', contractId);
          return new Response(
            JSON.stringify({ error: 'Contract not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (contract.status !== 'sent') {
          console.log('Contract signing attempt failed - invalid status:', contract.status, contractId);
          return new Response(
            JSON.stringify({ error: 'Contract cannot be signed', currentStatus: contract.status }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate signer email matches expected lead email
        const expectedEmail = (contract.deals as any)?.leads?.email?.toLowerCase();
        
        if (expectedEmail && expectedEmail !== sanitizedEmail) {
          console.log('Contract signing attempt failed - email mismatch:', {
            contractId,
            expectedEmail,
            providedEmail: sanitizedEmail,
            ipAddress,
          });
          return new Response(
            JSON.stringify({ error: 'Email does not match contract recipient' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create signature record
        const { error: signatureError } = await supabase
          .from('contract_signatures')
          .insert({
            contract_id: contractId,
            signer_name: sanitizedName,
            signer_email: sanitizedEmail,
            signature_data: signatureData || null,
            ip_address: ipAddress,
            user_agent: userAgent.substring(0, 500),
          });

        if (signatureError) {
          console.error('Error creating signature:', signatureError);
          return new Response(
            JSON.stringify({ error: 'Failed to record signature' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Contract signed successfully:', { contractId, sanitizedName, sanitizedEmail, ipAddress });

        // Update contract status to signed
        const { error: updateContractError } = await supabase
          .from('contracts')
          .update({ status: 'signed', signed_at: new Date().toISOString() })
          .eq('id', contractId);

        if (updateContractError) {
          console.error('Error updating contract:', updateContractError);
        }

        // Update deal to Closed Won
        const { error: updateDealError } = await supabase
          .from('deals')
          .update({ 
            stage: 'closed_won', 
            closed_at: new Date().toISOString() 
          })
          .eq('id', contract.deal_id);

        if (updateDealError) {
          console.error('Error updating deal:', updateDealError);
        }

        // Get deal details for commission calculation
        const { data: deal } = await supabase
          .from('deals')
          .select('value, assigned_to')
          .eq('id', contract.deal_id)
          .single();

        // Get workspace rake percentage and owner_id
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('rake_percentage, owner_id')
          .eq('id', contract.workspace_id)
          .single();

        // Get commission percentage from the job
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', contract.workspace_id)
          .eq('user_id', deal?.assigned_to)
          .maybeSingle();

        let commissionPercentage = 10;

        if (membership) {
          const { data: application } = await supabase
            .from('job_applications')
            .select('job_id')
            .eq('user_id', deal?.assigned_to)
            .eq('status', 'hired')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (application?.job_id) {
            const { data: job } = await supabase
              .from('jobs')
              .select('commission_percentage')
              .eq('id', application.job_id)
              .maybeSingle();

            if (job?.commission_percentage) {
              commissionPercentage = job.commission_percentage;
            }
          }
        }

        // Create commission record and notifications
        if (deal && workspace) {
          const rakePercentage = workspace.rake_percentage || 2;
          
          // Check if deal was closed by agency owner (no SDR involved)
          const isAgencyClosed = deal.assigned_to === workspace.owner_id;
          
          // Calculate agency rake from deal value (always charged)
          const agencyRakeAmount = (deal.value * rakePercentage) / 100;
          
          if (isAgencyClosed) {
            // Agency closed deal themselves - no SDR commission, just track the rake
            console.log('Agency closed deal - no SDR commission created, agency rake:', agencyRakeAmount);
            
            // Create a record for the agency rake only (no SDR payout)
            const { error: commissionError } = await supabase
              .from('commissions')
              .insert({
                workspace_id: contract.workspace_id,
                deal_id: contract.deal_id,
                sdr_id: deal.assigned_to, // Agency owner
                amount: 0, // No SDR commission
                rake_amount: agencyRakeAmount,
                agency_rake_amount: agencyRakeAmount,
                platform_cut_percentage: 0,
                platform_cut_amount: 0,
                sdr_payout_amount: 0,
                status: 'pending',
              });

            if (commissionError) {
              console.error('Error creating agency rake record:', commissionError);
            } else {
              // Notify agency owner about the rake
              const { data: dealDetails } = await supabase
                .from('deals')
                .select('title')
                .eq('id', contract.deal_id)
                .single();

              const { error: notifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: workspace.owner_id,
                  workspace_id: contract.workspace_id,
                  type: 'commission_created',
                  title: 'Deal Closed - Platform Fee Due',
                  message: `Platform fee of $${agencyRakeAmount.toFixed(2)} is due for "${dealDetails?.title || 'Closed Deal'}". Payment due within 7 days.`,
                  data: {
                    deal_id: contract.deal_id,
                    agency_rake_amount: agencyRakeAmount,
                  },
                });
              if (notifError) console.error('Error creating rake notification:', notifError);
            }
          } else {
            // SDR closed the deal - full commission calculation
            const sdrGrossCommission = (deal.value * commissionPercentage) / 100;
            
            // Get SDR level for platform cut calculation
            const { data: sdrProfile } = await supabase
              .from('profiles')
              .select('sdr_level, full_name, email')
              .eq('id', deal.assigned_to)
              .single();

            const sdrLevel = sdrProfile?.sdr_level || 1;
            
            // Platform cut from SDR based on level: 5% L1, 4% L2, 2.5% L3
            let platformCutPercentage = 5; // Level 1
            if (sdrLevel === 2) platformCutPercentage = 4;
            if (sdrLevel >= 3) platformCutPercentage = 2.5;

            const platformCutAmount = (sdrGrossCommission * platformCutPercentage) / 100;
            const sdrPayoutAmount = sdrGrossCommission - platformCutAmount;

            console.log('Commission calculation:', {
              dealValue: deal.value,
              commissionPercentage,
              sdrGrossCommission,
              sdrLevel,
              platformCutPercentage,
              platformCutAmount,
              sdrPayoutAmount,
              agencyRakeAmount,
            });

            const { error: commissionError } = await supabase
              .from('commissions')
              .insert({
                workspace_id: contract.workspace_id,
                deal_id: contract.deal_id,
                sdr_id: deal.assigned_to,
                amount: sdrGrossCommission,
                rake_amount: agencyRakeAmount,
                agency_rake_amount: agencyRakeAmount,
                platform_cut_percentage: platformCutPercentage,
                platform_cut_amount: platformCutAmount,
                sdr_payout_amount: sdrPayoutAmount,
                status: 'pending',
              });

            if (commissionError) {
              console.error('Error creating commission:', commissionError);
            } else {
              const { data: workspaceDetails } = await supabase
                .from('workspaces')
                .select('name, owner_id')
                .eq('id', contract.workspace_id)
                .single();

              const { data: ownerProfile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', workspaceDetails?.owner_id)
                .single();

              const { data: dealDetails } = await supabase
                .from('deals')
                .select('title')
                .eq('id', contract.deal_id)
                .single();

              // Total agency owes = SDR commission + agency rake
              const totalAgencyOwes = sdrGrossCommission + agencyRakeAmount;

              if (workspaceDetails?.owner_id) {
                const { error: notifError } = await supabase
                  .from('notifications')
                  .insert({
                    user_id: workspaceDetails.owner_id,
                    workspace_id: contract.workspace_id,
                    type: 'commission_created',
                    title: 'New Commission Due',
                    message: `Commission of $${sdrGrossCommission.toFixed(2)} plus $${agencyRakeAmount.toFixed(2)} platform fee (total: $${totalAgencyOwes.toFixed(2)}) is due for "${dealDetails?.title || 'Closed Deal'}" closed by ${sdrProfile?.full_name || 'SDR'}. Payment due within 7 days.`,
                    data: {
                      deal_id: contract.deal_id,
                      commission_amount: sdrGrossCommission,
                      agency_rake_amount: agencyRakeAmount,
                      total_due: totalAgencyOwes,
                      sdr_name: sdrProfile?.full_name,
                    },
                  });
                if (notifError) console.error('Error creating commission notification:', notifError);
              }

              const { error: sdrNotifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: deal.assigned_to,
                  workspace_id: contract.workspace_id,
                  type: 'commission_created',
                  title: 'Commission Earned!',
                  message: `You earned a $${sdrGrossCommission.toFixed(2)} commission for closing "${dealDetails?.title || 'Deal'}". After ${platformCutPercentage}% platform fee, your payout will be $${sdrPayoutAmount.toFixed(2)}.`,
                  data: {
                    deal_id: contract.deal_id,
                    gross_commission: sdrGrossCommission,
                    platform_cut: platformCutAmount,
                    net_payout: sdrPayoutAmount,
                  },
                });
              if (sdrNotifError) console.error('Error creating SDR commission notification:', sdrNotifError);

              // Send deal won email to SDR
              if (sdrProfile?.email) {
                try {
                  await fetch(`${supabaseUrl}/functions/v1/send-contract-request-email`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                      type: 'deal_won',
                      recipientEmail: sdrProfile.email,
                      recipientName: sdrProfile.full_name || 'SDR',
                      dealTitle: dealDetails?.title || 'Closed Deal',
                      dealValue: deal.value,
                      agencyName: workspaceDetails?.name || 'Agency',
                      commissionAmount: sdrPayoutAmount,
                    }),
                  });
                  console.log('Deal won email sent to SDR');
                } catch (dealWonEmailErr) {
                  console.error('Failed to send deal won email:', dealWonEmailErr);
                }
              }

              if (ownerProfile?.email) {
                try {
                  await fetch(`${supabaseUrl}/functions/v1/send-commission-email`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                      type: 'commission_created',
                      to_email: ownerProfile.email,
                      to_name: ownerProfile.full_name || 'Agency Owner',
                      workspace_name: workspaceDetails?.name || 'Your Agency',
                      amount: totalAgencyOwes,
                      deal_title: dealDetails?.title || 'Closed Deal',
                      sdr_name: sdrProfile?.full_name || 'SDR',
                    }),
                  });
                  console.log('Commission created email sent');
                } catch (emailErr) {
                  console.error('Failed to send commission email:', emailErr);
                }
              }
            }
          }
        }

        // Log deal activity
        if (deal) {
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: contract.deal_id,
              user_id: deal.assigned_to,
              activity_type: 'contract_signed',
              description: `Contract signed by ${sanitizedName} (${sanitizedEmail})`,
            });
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Contract signed successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Contract function error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
