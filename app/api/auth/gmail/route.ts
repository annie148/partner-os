import { NextResponse } from 'next/server'

/**
 * GET /api/auth/gmail
 *
 * Redirects to Google OAuth consent screen. Visit this URL once in your
 * browser to authorize Partner OS to send Gmail on your behalf.
 *
 * After setup, delete this route — it's only needed once.
 */
export async function GET() {
  const clientId = process.env.GMAIL_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'GMAIL_CLIENT_ID not set in environment variables' },
      { status: 500 }
    )
  }

  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose',
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
