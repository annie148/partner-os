import { NextResponse } from 'next/server'
import { google } from 'googleapis'

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

export async function POST() {
  try {
    const s = google.sheets({ version: 'v4', auth: getAuth() })

    // Check if Regions tab exists
    const spreadsheet = await s.spreadsheets.get({ spreadsheetId: SHEET_ID })
    const exists = spreadsheet.data.sheets?.some((sh) => sh.properties?.title === 'Regions')

    if (!exists) {
      // Create the tab
      await s.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Regions' } } }],
        },
      })

      // Add header row
      await s.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: 'Regions!A1:F1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['regionName', 'regionGoalSY26', 'regionGoalSY27', 'currentStatus', 'openQuestions', 'nextMoves']],
        },
      })
    }

    // Add region rows
    const regions = ['LA', 'DC', 'Nashville', 'Bay Area', 'National', 'NY', 'AZ']
    const existing = await s.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Regions!A:A',
    })
    const existingNames = new Set((existing.data.values || []).flat())

    const toAdd = regions.filter((r) => !existingNames.has(r))
    if (toAdd.length > 0) {
      await s.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Regions!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: toAdd.map((name) => [name, '', '', '', '', '']),
        },
      })
    }

    return NextResponse.json({ ok: true, created: toAdd, alreadyExisted: regions.filter((r) => existingNames.has(r)) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
