import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getRows, appendRow } from '@/lib/sheets'
import type { Opportunity, Confidence } from '@/types'

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

async function ensureOpportunitiesTab() {
  const s = google.sheets({ version: 'v4', auth: getAuth() })
  const spreadsheet = await s.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = spreadsheet.data.sheets?.some((sh) => sh.properties?.title === 'Opportunities')
  if (!exists) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Opportunities' } } }] },
    })
    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Opportunities!A1:I1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          'id',
          'accountId',
          'name',
          'projectedAmount',
          'confidence',
          'stage',
          'contractType',
          'closedWonExpected',
          'notes',
        ]],
      },
    })
  }
}

function rowToOpportunity(row: string[]): Opportunity {
  return {
    id: row[0] || '',
    accountId: row[1] || '',
    name: row[2] || '',
    projectedAmount: row[3] || '',
    confidence: Number(row[4]) as Confidence,
    stage: (row[5] || '') as Opportunity['stage'],
    contractType: (row[6] || '') as Opportunity['contractType'],
    closedWonExpected: row[7] || '',
    notes: row[8] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Opportunities')
    const opportunities = rows.filter((r) => r[0]).map(rowToOpportunity)
    return NextResponse.json(opportunities)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('Unable to parse range') || msg.includes('not found')) {
      try { await ensureOpportunitiesTab() } catch { /* ignore setup errors on GET */ }
      return NextResponse.json([])
    }
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureOpportunitiesTab()
    const body: Omit<Opportunity, 'id'> = await req.json()
    const id = crypto.randomUUID()
    await appendRow('Opportunities', [
      id,
      body.accountId,
      body.name,
      body.projectedAmount,
      String(body.confidence),
      body.stage,
      body.contractType,
      body.closedWonExpected,
      body.notes,
    ])
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
