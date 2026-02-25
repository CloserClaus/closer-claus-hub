import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Country code to centroid lat/lng mapping
const countrycentroids: Record<string, [number, number]> = {
  US: [39.8, -98.5], CA: [56.1, -106.3], MX: [23.6, -102.5],
  BR: [-14.2, -51.9], AR: [-38.4, -63.6], CO: [4.6, -74.1],
  CL: [-35.7, -71.5], PE: [-9.2, -75.0],
  GB: [55.4, -3.4], FR: [46.2, 2.2], DE: [51.2, 10.4],
  ES: [40.5, -3.7], IT: [41.9, 12.6], NL: [52.1, 5.3],
  SE: [60.1, 18.6], NO: [60.5, 8.5], DK: [56.3, 9.5],
  FI: [61.9, 25.7], PL: [51.9, 19.1], CH: [46.8, 8.2],
  AT: [47.5, 14.6], BE: [50.5, 4.5], IE: [53.1, -7.7],
  PT: [39.4, -8.2], CZ: [49.8, 15.5], RO: [45.9, 25.0],
  GR: [39.1, 21.8], TR: [38.9, 35.2], RU: [61.5, 105.3],
  UA: [48.4, 31.2], HU: [47.2, 19.5],
  JP: [36.2, 138.3], KR: [35.9, 127.8], CN: [35.9, 104.2],
  HK: [22.4, 114.1], SG: [1.4, 103.8], IN: [20.6, 79.0],
  AE: [23.4, 53.8], TH: [15.9, 100.9], ID: [-0.8, 113.9],
  PH: [12.9, 121.8], TW: [23.7, 121.0], MY: [4.2, 101.9],
  VN: [14.1, 108.3], PK: [30.4, 69.3], BD: [23.7, 90.4],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9],
  ZA: [-30.6, 22.9], NG: [9.1, 8.7], EG: [26.8, 30.8],
  KE: [-0.0, 37.9], GH: [7.9, -1.0], ET: [9.1, 40.5],
  IL: [31.0, 34.9], SA: [23.9, 45.1], QA: [25.4, 51.2],
  KW: [29.3, 47.5], BH: [26.0, 50.6],
}

// Timezone to country fallback
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

    // Resolve lat/lng from country centroid
    const centroid = country ? countrycentroids[country] : null
    const latitude = centroid ? centroid[0] : null
    const longitude = centroid ? centroid[1] : null

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
      latitude,
      longitude,
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
      latitude,
      longitude,
    }, { onConflict: 'session_id' })

    // Cleanup stale sessions
    await supabase.rpc('cleanup_stale_sessions')

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders })
  }
})
