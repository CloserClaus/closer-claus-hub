import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppRole = 'platform_admin' | 'agency_owner' | 'sdr';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to get current user
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.log('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestedRole } = await req.json();

    // Validate requested role
    const validRoles: AppRole[] = ['agency_owner', 'sdr'];
    if (!requestedRole || !validRoles.includes(requestedRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role requested' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a role
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRole) {
      console.log('User already has role:', { userId: user.id, existingRole: existingRole.role });
      return new Response(
        JSON.stringify({ error: 'User already has a role assigned', existingRole: existingRole.role }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is the first user (should become platform_admin)
    const { data: isFirst } = await supabaseAdmin.rpc('is_first_user');
    
    if (isFirst === true) {
      // First user becomes platform admin automatically
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'platform_admin' as AppRole,
        });

      if (insertError) {
        console.error('Error assigning platform_admin role:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to assign role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Auto-verify admin's email
      await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', user.id);

      console.log('First user assigned as platform_admin:', user.id);
      return new Response(
        JSON.stringify({ success: true, role: 'platform_admin', isFirstUser: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role from user metadata matches requested role (additional security)
    const signupRole = user.user_metadata?.signup_role;
    if (signupRole && signupRole !== requestedRole) {
      console.log('Role mismatch:', { signupRole, requestedRole, userId: user.id });
      // Use the signup role from metadata as the source of truth
      // This prevents manipulation of the requestedRole parameter
    }

    // Use signup_role from metadata if available, otherwise use requestedRole
    const roleToAssign = signupRole || requestedRole;

    // Validate the final role to assign
    if (!validRoles.includes(roleToAssign)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign the role using service role (bypasses RLS)
    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: roleToAssign as AppRole,
      });

    if (insertError) {
      // Handle duplicate key error gracefully
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ success: true, role: roleToAssign, message: 'Role already assigned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Error assigning role:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Role assigned successfully:', { userId: user.id, role: roleToAssign });
    return new Response(
      JSON.stringify({ success: true, role: roleToAssign }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in assign-role:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});