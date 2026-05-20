import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { SCHOOL_TYPES } from '@/types'

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
      range: 'Accounts!A:AV',
    })
    const allRows = res.data.values || []
    const dataRows = allRows.slice(1) // skip header

    const toBackfill: { sheetRow: number; name: string; type: string; moy: boolean; eoy: boolean }[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const name = row[1] || '(unnamed)'
      const type = row[2] || ''
      if (!SCHOOL_TYPES.includes(type as (typeof SCHOOL_TYPES)[number])) continue

      const moyEmpty = !row[46]
      const eoyEmpty = !row[47]
      if (moyEmpty || eoyEmpty) {
        toBackfill.push({ sheetRow: i + 2, name, type, moy: moyEmpty, eoy: eoyEmpty })
      }
    }

    let gridExpanded = false
    if (apply) {
      // Ensure the Accounts grid is wide enough to fit columns AU (47) and AV (48).
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
      const accountsSheet = meta.data.sheets?.find(
        (sh) => sh.properties?.title === 'Accounts'
      )
      const sheetId = accountsSheet?.properties?.sheetId
      const currentColumnCount = accountsSheet?.properties?.gridProperties?.columnCount ?? 0
      const NEEDED_COLUMNS = 48 // through AV
      if (sheetId !== undefined && currentColumnCount < NEEDED_COLUMNS) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                appendDimension: {
                  sheetId,
                  dimension: 'COLUMNS',
                  length: NEEDED_COLUMNS - currentColumnCount,
                },
              },
            ],
          },
        })
        gridExpanded = true
      }

      const batchData: { range: string; values: string[][] }[] = [
        { range: 'Accounts!AU1', values: [['MOY Data Shared']] },
        { range: 'Accounts!AV1', values: [['EOY Data Shared']] },
      ]
      for (const { sheetRow, moy, eoy } of toBackfill) {
        if (moy) batchData.push({ range: `Accounts!AU${sheetRow}`, values: [['N/A']] })
        if (eoy) batchData.push({ range: `Accounts!AV${sheetRow}`, values: [['N/A']] })
      }
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
      gridExpanded,
      headersWritten: apply ? ['MOY Data Shared (AU1)', 'EOY Data Shared (AV1)'] : [],
      backfillCount: toBackfill.length,
      backfilled: toBackfill.map(({ name, type, moy, eoy }) => ({
        name,
        type,
        fields: [moy && 'moyDataShared', eoy && 'eoyDataShared'].filter(Boolean),
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
