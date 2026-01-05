import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateConversationBody = {
  workspace_id: string;
  member_ids: string[];
  name?: string | null;
  is_group?: boolean;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const body = (await req.json()) as CreateConversationBody;

    const workspaceId = body.workspace_id;
    const memberIds = Array.isArray(body.member_ids) ? body.member_ids : [];
    const isGroup = Boolean(body.is_group && memberIds.length > 1);
    const name = isGroup ? (body.name ?? null) : null;

    if (!workspaceId || memberIds.length === 0) {
      return new Response(JSON.stringify({ error: "Missing workspace_id or member_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify requester can access this workspace
    const [{ data: workspace }, { data: membership }, { data: adminRole }] = await Promise.all([
      supabase.from("workspaces").select("id, owner_id").eq("id", workspaceId).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .is("removed_at", null)
        .maybeSingle(),
      supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "platform_admin").maybeSingle(),
    ]);

    const canAccessWorkspace = Boolean(adminRole?.id || workspace?.owner_id === user.id || membership?.id);

    if (!canAccessWorkspace) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate all selected members belong to the same workspace (owner or active members)
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .is("removed_at", null)
      .in("user_id", memberIds);

    const validIds = new Set<string>();
    if (workspace?.owner_id) validIds.add(workspace.owner_id);
    (members || []).forEach((m) => validIds.add(m.user_id));

    const invalid = memberIds.filter((id) => !validIds.has(id));
    if (invalid.length) {
      return new Response(
        JSON.stringify({ error: "One or more selected users are not in this workspace", invalid }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ workspace_id: workspaceId, name, is_group: isGroup })
      .select("*")
      .single();

    if (convError) {
      console.error("create-conversation: insert conversation error", convError);
      return new Response(JSON.stringify({ error: convError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participantRows = [user.id, ...memberIds].map((uid) => ({
      conversation_id: conv.id,
      user_id: uid,
    }));

    const { error: partError } = await supabase.from("conversation_participants").insert(participantRows);
    if (partError) {
      console.error("create-conversation: insert participants error", partError);
      return new Response(JSON.stringify({ error: partError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ conversation: conv }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("create-conversation function error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
