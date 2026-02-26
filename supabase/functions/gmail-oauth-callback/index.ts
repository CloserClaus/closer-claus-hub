import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // This function handles two flows:
  // 1. GET  → Google redirects here with ?code=...&state=... — exchanges code for tokens, stores inbox, redirects to app
  // 2. POST → Frontend sends { action: "get_auth_url", workspace_id, redirect_uri } — returns the Google OAuth URL

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ─── POST: Generate OAuth URL ───────────────────────────────
  if (req.method === "POST") {
    try {
      const { workspace_id, user_id } = await req.json();

      // The callback URL is this same function's GET endpoint
      const callbackUrl = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`;

      // State encodes workspace + user so callback knows where to store the inbox
      const state = btoa(JSON.stringify({ workspace_id, user_id }));

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
        access_type: "offline",
        prompt: "select_account consent",  // FORCE account selector + consent every time
        state,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ─── GET: OAuth Callback from Google ────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      // User denied or error — redirect back to app with error
      return new Response(null, {
        status: 302,
        headers: { Location: `${getAppUrl()}/settings?gmail_error=${encodeURIComponent(error)}` },
      });
    }

    if (!code || !stateParam) {
      return new Response("Missing code or state", { status: 400 });
    }

    let state: { workspace_id: string; user_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response("Invalid state", { status: 400 });
    }

    // Exchange code for tokens
    const callbackUrl = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${getAppUrl()}/settings?gmail_error=token_exchange_failed` },
      });
    }

    // Get the Gmail account email address
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const gmailEmail = userInfo.email;

    if (!gmailEmail) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${getAppUrl()}/settings?gmail_error=no_email` },
      });
    }

    // Check for duplicate inbox
    const { data: existingInbox } = await supabaseAdmin
      .from("email_inboxes")
      .select("id")
      .eq("workspace_id", state.workspace_id)
      .eq("email_address", gmailEmail)
      .maybeSingle();

    if (existingInbox) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${getAppUrl()}/email?gmail_error=duplicate&email=${encodeURIComponent(gmailEmail)}` },
      });
    }

    // Find or create Gmail provider for this workspace
    let providerId: string;
    const { data: existingProvider } = await supabaseAdmin
      .from("email_providers")
      .select("id")
      .eq("workspace_id", state.workspace_id)
      .eq("provider_type", "gmail")
      .maybeSingle();

    if (existingProvider) {
      providerId = existingProvider.id;
    } else {
      const { data: newProvider, error: provErr } = await supabaseAdmin
        .from("email_providers")
        .insert({
          workspace_id: state.workspace_id,
          provider_type: "gmail",
          provider_name: "Gmail",
          status: "connected",
          created_by: state.user_id,
          last_validated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (provErr || !newProvider) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${getAppUrl()}/email?gmail_error=provider_create_failed` },
        });
      }
      providerId = newProvider.id;
    }

    // Store the inbox with refresh token
    const { error: inboxErr } = await supabaseAdmin
      .from("email_inboxes")
      .insert({
        provider_id: providerId,
        workspace_id: state.workspace_id,
        email_address: gmailEmail,
        external_inbox_id: tokenData.refresh_token || null,
        status: "active",
      });

    if (inboxErr) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${getAppUrl()}/email?gmail_error=inbox_create_failed` },
      });
    }

    // Audit log
    await supabaseAdmin.from("email_audit_log").insert({
      workspace_id: state.workspace_id,
      action_type: "gmail_inbox_connected",
      actor_id: state.user_id,
      provider_id: providerId,
      metadata: { email: gmailEmail },
    });

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: { Location: `${getAppUrl()}/email?gmail_connected=${encodeURIComponent(gmailEmail)}` },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});

function getAppUrl(): string {
  // Use the published app URL
  return "https://closerclaus.lovable.app";
}
