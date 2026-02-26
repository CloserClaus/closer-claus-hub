import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIMARY_DOMAIN = "https://closerclaus.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // All operations are now POST-based (called from frontend)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const action = body.action;

      // ─── Generate OAuth URL ───────────────────────────────
      if (!action || action === "get_auth_url") {
        const { workspace_id, user_id, origin } = body;
        const appOrigin = origin || PRIMARY_DOMAIN;

        // Redirect URI points to the frontend callback page on the custom domain
        const callbackUrl = `${appOrigin}/auth/google/callback`;

        const state = btoa(JSON.stringify({ workspace_id, user_id, origin: appOrigin }));

        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: callbackUrl,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
          access_type: "offline",
          prompt: "select_account consent",
          state,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return new Response(JSON.stringify({ auth_url: authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Exchange code for tokens (called by frontend callback page) ───
      if (action === "exchange") {
        const { code, state: stateParam } = body;

        if (!code || !stateParam) {
          return new Response(JSON.stringify({ error: "missing_params" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let state: { workspace_id: string; user_id: string; origin?: string };
        try {
          state = JSON.parse(atob(stateParam));
        } catch {
          return new Response(JSON.stringify({ error: "invalid_state" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const appOrigin = state.origin || PRIMARY_DOMAIN;
        const callbackUrl = `${appOrigin}/auth/google/callback`;

        // Exchange code for tokens
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
          return new Response(JSON.stringify({ error: "token_exchange_failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get the Gmail account email address
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoRes.json();
        const gmailEmail = userInfo.email;

        if (!gmailEmail) {
          return new Response(JSON.stringify({ error: "no_email" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          return new Response(JSON.stringify({ error: "duplicate", email: gmailEmail }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
            return new Response(JSON.stringify({ error: "provider_create_failed" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          providerId = newProvider.id;
        }

        // Store the inbox with refresh token (server-side only)
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
          return new Response(JSON.stringify({ error: "inbox_create_failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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

        // Return success — tokens never leave the server
        return new Response(JSON.stringify({ success: true, email: gmailEmail }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
