import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'

// Old free-text/dropdown values → new ContractStatus values (or '' to clear)
const OBC_MAP: Record<string, string> = {
  'Complete': 'Contract Signed',
  'In Progress': 'Contract Sent',
  'Not Started': 'Shared',
  'Discussed': 'Shared',
  'N/A': '',
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
      range: 'Accounts!A:AB', // need cols A (id), B (name), AB (obcStatus, index 27)
    })
    const allRows = res.data.values || []
    const dataRows = allRows.slice(1) // skip header

    const distinctValues: Record<string, number> = {}
    const toUpdate: { sheetRow: number; name: string; oldValue: string; newValue: string }[] = []
    const flagged: { name: string; value: string }[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const name = row[1] || '(unnamed)'
      const value = row[27] || ''

      distinctValues[value] = (distinctValues[value] || 0) + 1

      if (value === '') continue // already blank

      if (value in OBC_MAP) {
        toUpdate.push({ sheetRow: i + 2, name, oldValue: value, newValue: OBC_MAP[value] })
      } else {
        flagged.push({ name, value })
      }
    }

    if (apply && toUpdate.length > 0) {
      // Batch update: only write column AB (obcStatus) for affected rows
      const batchData = toUpdate.map(({ sheetRow, newValue }) => ({
        range: `Accounts!AB${sheetRow}`,
        values: [[newValue]],
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
      distinctValues,
      proposed: toUpdate.map(({ name, oldValue, newValue }) => ({ name, oldValue, newValue })),
      updateCount: toUpdate.length,
      flaggedForReview: flagged,
      flaggedCount: flagged.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
