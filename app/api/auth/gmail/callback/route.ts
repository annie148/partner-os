import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/gmail/callback
 *
 * Google redirects here after consent. Exchanges the authorization code
 * for tokens and displays the refresh token on screen.
 *
 * Copy the refresh token, add it to your env vars as GMAIL_REFRESH_TOKEN,
 * then delete these auth routes — they're only needed once.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px">
        <h2 style="color:#dc2626">Authorization failed</h2>
        <p>Error: ${error}</p>
        <p><a href="/api/auth/gmail">Try again</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px">
        <h2 style="color:#dc2626">No authorization code received</h2>
        <p><a href="/api/auth/gmail">Start over</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback'

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px">
        <h2 style="color:#dc2626">Missing env vars</h2>
        <p>Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px">
        <h2 style="color:#dc2626">Token exchange failed</h2>
        <p>${tokens.error}: ${tokens.error_description || ''}</p>
        <p><a href="/api/auth/gmail">Try again</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const refreshToken = tokens.refresh_token

  return new NextResponse(
    `<html><body style="font-family:system-ui;padding:40px;max-width:700px">
      <h2 style="color:#16a34a">Gmail authorized successfully!</h2>

      ${refreshToken ? `
        <h3>Your refresh token:</h3>
        <pre style="background:#f1f5f9;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;border:1px solid #e2e8f0;user-select:all">${refreshToken}</pre>

        <h3>Next steps:</h3>
        <ol style="line-height:1.8">
          <li>Copy the refresh token above</li>
          <li>Add to <code>.env.local</code>:<br>
            <pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;border:1px solid #e2e8f0">GMAIL_REFRESH_TOKEN=${refreshToken}</pre>
          </li>
          <li>Add the same value in <strong>Vercel &gt; Settings &gt; Environment Variables</strong> as <code>GMAIL_REFRESH_TOKEN</code></li>
          <li>Delete the auth routes (they are only needed once):<br>
            <code>app/api/auth/gmail/route.ts</code> and <code>app/api/auth/gmail/callback/route.ts</code></li>
        </ol>
      ` : `
        <p style="color:#d97706"><strong>Warning:</strong> No refresh token was returned. This usually means you've already authorized this app before.</p>
        <p>To force a new refresh token:</p>
        <ol style="line-height:1.8">
          <li>Go to <a href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
          <li>Find "Partner OS" and click <strong>Remove Access</strong></li>
          <li><a href="/api/auth/gmail">Authorize again</a></li>
        </ol>
      `}

      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
      <details style="font-size:13px;color:#6b7280">
        <summary>Full token response (for debugging)</summary>
        <pre style="background:#f1f5f9;padding:12px;border-radius:8px;margin-top:8px;overflow-x:auto">${JSON.stringify(tokens, null, 2)}</pre>
      </details>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
