import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'

const TYPE_MAP: Record<string, string> = {
  'Prospective School/District': 'Prospective',
  'Current School/District': 'Current Partner',
  'Former School/District': 'Past Partner',
  'Declined School/District': 'Declined Partner',
}

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

// GET = dry run, POST = apply
export async function GET() {
  return run(false)
}

export async function POST() {
  return run(true)
}

async function run(apply: boolean) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Accounts!A:AN',
    })
    const allRows = res.data.values || []
    const dataRows = allRows.slice(1) // skip header

    const toUpdate: { sheetRow: number; name: string; oldType: string; newType: string }[] = []
    const flagged: { name: string }[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const name = row[1] || '(unnamed)'
      const type = row[2] || ''

      if (type === 'Other - Education') {
        flagged.push({ name })
        continue
      }

      if (TYPE_MAP[type]) {
        toUpdate.push({ sheetRow: i + 2, name, oldType: type, newType: TYPE_MAP[type] })
      }
    }

    if (apply && toUpdate.length > 0) {
      // Batch update: only write column C for each affected row
      const batchData = toUpdate.map(({ sheetRow, newType }) => ({
        range: `Accounts!C${sheetRow}`,
        values: [[newType]],
      }))
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: batchData,
        },
      })
    }

    return NextResponse.json({
      mode: apply ? 'applied' : 'dry-run',
      updated: toUpdate.map(({ name, oldType, newType }) => ({ name, oldType, newType })),
      updateCount: toUpdate.length,
      flaggedForReview: flagged.map(({ name }) => ({ name, type: 'Other - Education' })),
      flaggedCount: flagged.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
