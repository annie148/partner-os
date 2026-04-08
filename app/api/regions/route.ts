import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
import type { Region } from '@/types'

function rowToRegion(row: string[]): Region {
  return {
    regionName: row[0] || '',
    regionGoalSY26: row[1] || '',
    regionGoalSY27: row[2] || '',
    currentStatus: row[3] || '',
    openQuestions: row[4] || '',
    nextMoves: row[5] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Regions')
    const regions = rows.filter((r) => r[0]).map(rowToRegion)
    return NextResponse.json(regions)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Partial<Region> = await req.json()
    if (!body.regionName?.trim()) {
      return NextResponse.json({ error: 'regionName is required' }, { status: 400 })
    }
    const rows = await getRows('Regions')
    const existing = new Set(rows.map((r) => r[0]).filter(Boolean))
    if (existing.has(body.regionName)) {
      return NextResponse.json({ error: 'Region already exists' }, { status: 409 })
    }
    await appendRow('Regions', [
      body.regionName,
      body.regionGoalSY26 || '',
      body.regionGoalSY27 || '',
      body.currentStatus || '',
      body.openQuestions || '',
      body.nextMoves || '',
    ])
    return NextResponse.json({ ok: true, regionName: body.regionName })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
