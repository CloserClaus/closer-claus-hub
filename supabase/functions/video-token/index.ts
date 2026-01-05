import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_name, identity } = await req.json();
    
    if (!room_name || !identity) {
      return new Response(
        JSON.stringify({ error: 'room_name and identity are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate JWT for Twilio Video
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // Create the JWT header
    const header = {
      alg: 'HS256',
      typ: 'JWT',
      cty: 'twilio-fpa;v=1'
    };

    // Create the JWT payload with video grant
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      nbf: now,
      exp: expiry,
      grants: {
        identity: identity,
        video: {
          room: room_name
        }
      }
    };

    // Encode header and payload
    const encoder = new TextEncoder();
    
    const base64UrlEncode = (str: string) => {
      const bytes = encoder.encode(str);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(apiKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureInput)
    );

    const signatureArray = new Uint8Array(signature);
    let signatureBinary = '';
    for (let i = 0; i < signatureArray.length; i++) {
      signatureBinary += String.fromCharCode(signatureArray[i]);
    }
    const encodedSignature = btoa(signatureBinary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const token = `${signatureInput}.${encodedSignature}`;

    console.log(`Generated video token for identity: ${identity}, room: ${room_name}`);

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Video token generation error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
