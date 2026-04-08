import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getRows, appendRow } from '@/lib/sheets'
import type { Activity } from '@/types'

const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const sanitized = key.trim().replace(/\n/g, '\\n').replace(/\r/g, '')
  const credentials = JSON.parse(sanitized)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureActivityTab() {
  const s = google.sheets({ version: 'v4', auth: getAuth() })
  const spreadsheet = await s.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = spreadsheet.data.sheets?.some((sh) => sh.properties?.title === 'Activity')
  if (!exists) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Activity' } } }] },
    })
    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Activity!A1:G1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['id', 'accountId', 'date', 'type', 'description', 'loggedBy', 'sourceId']] },
    })
  }
}

function rowToActivity(row: string[]): Activity {
  return {
    id: row[0] || '',
    accountId: row[1] || '',
    date: row[2] || '',
    type: (row[3] || 'Note') as Activity['type'],
    description: row[4] || '',
    loggedBy: row[5] || '',
    sourceId: row[6] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Activity')
    const activities = rows.filter((r) => r[0]).map(rowToActivity)
    return NextResponse.json(activities)
  } catch (e) {
    const msg = String(e)
    // If the Activity tab doesn't exist yet, create it and return empty
    if (msg.includes('Unable to parse range') || msg.includes('not found')) {
      try { await ensureActivityTab() } catch { /* ignore setup errors on GET */ }
      return NextResponse.json([])
    }
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureActivityTab()
    const body: Omit<Activity, 'id'> = await req.json()
    const id = crypto.randomUUID()
    await appendRow('Activity', [
      id,
      body.accountId,
      body.date,
      body.type,
      body.description,
      body.loggedBy,
      body.sourceId || '',
    ])
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
