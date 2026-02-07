import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Google Calendar OAuth callback handler.
 *
 * Flow:
 *  1. Frontend redirects user to Google OAuth consent URL with state = JWT
 *  2. Google redirects here with ?code=...&state=JWT
 *  3. We exchange the code for tokens
 *  4. We upsert the tokens into user_google_tokens
 *  5. We redirect the user back to the calendar page
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // JWT access token
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return redirectToApp('?gcal_error=' + encodeURIComponent(error));
    }

    if (!code || !state) {
      return new Response('Missing code or state', { status: 400 });
    }

    // Validate the JWT to get the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(state);
    if (userErr || !userData?.user) {
      console.error('Invalid JWT in state:', userErr);
      return redirectToApp('?gcal_error=invalid_token');
    }

    const userId = userData.user.id;

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const redirectUri = `${supabaseUrl}/functions/v1/gcal-oauth-callback`;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error('Token exchange failed:', errText);
      return redirectToApp('?gcal_error=token_exchange_failed');
    }

    const tokens = await tokenResp.json();

    if (!tokens.refresh_token) {
      console.error('No refresh_token returned. User may need to re-authorize with prompt=consent.');
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    // Upsert tokens
    const { error: upsertErr } = await supabaseAdmin
      .from('user_google_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? '',
          token_expires_at: expiresAt,
        },
        { onConflict: 'user_id' },
      );

    if (upsertErr) {
      console.error('Failed to store tokens:', upsertErr);
      return redirectToApp('?gcal_error=storage_failed');
    }

    return redirectToApp('?gcal_connected=true');
  } catch (err) {
    console.error('Unexpected error:', err);
    return redirectToApp('?gcal_error=unexpected');
  }
});

function redirectToApp(query: string) {
  // Redirect to the frontend calendar page
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:8080';
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appUrl}/calendar${query}`,
      ...corsHeaders,
    },
  });
}
