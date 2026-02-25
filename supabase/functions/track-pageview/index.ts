import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple timezone-to-country mapping for fallback geo
const tzCountryMap: Record<string, string> = {
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE', 'Europe/Dublin': 'IE',
  'Europe/Lisbon': 'PT', 'Europe/Prague': 'CZ', 'Europe/Bucharest': 'RO',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN',
  'Asia/Dubai': 'AE', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH', 'Asia/Taipei': 'TW', 'Asia/Kuala_Lumpur': 'MY',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Bogota': 'CO',
  'America/Santiago': 'CL', 'America/Lima': 'PE', 'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG', 'Africa/Nairobi': 'KE',
  'Asia/Tel_Aviv': 'IL', 'Asia/Riyadh': 'SA',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { path, referrer, session_id, screen_width, screen_height, language, timezone, user_id } = await req.json()

    if (!session_id || !path) {
      return new Response(JSON.stringify({ error: 'session_id and path required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Resolve geo from headers
    const country = req.headers.get('cf-ipcountry') || 
                    req.headers.get('x-vercel-ip-country') || 
                    (timezone ? tzCountryMap[timezone] : null) || 
                    null
    const city = req.headers.get('x-vercel-ip-city') || null

    // Insert page view
    await supabase.from('page_views').insert({
      user_id: user_id || null,
      session_id,
      path,
      referrer: referrer || null,
      user_agent: req.headers.get('user-agent') || null,
      screen_width: screen_width || null,
      screen_height: screen_height || null,
      language: language || null,
      timezone: timezone || null,
      country,
      city,
    })

    // Upsert active session
    await supabase.from('active_sessions').upsert({
      session_id,
      user_id: user_id || null,
      current_path: path,
      user_agent: req.headers.get('user-agent') || null,
      last_seen_at: new Date().toISOString(),
      country,
      city,
    }, { onConflict: 'session_id' })

    // Cleanup stale sessions
    await supabase.rpc('cleanup_stale_sessions')

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders })
  }
})
