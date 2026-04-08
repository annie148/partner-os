import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow, deleteRow } from '@/lib/sheets'
import type { Region } from '@/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const regionName = decodeURIComponent(name)
    const rows = await getRows('Regions')
    const idx = rows.findIndex((r) => r[0] === regionName)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body: Region = await req.json()
    await updateRow('Regions', idx, [
      body.regionName,
      body.regionGoalSY26 || '',
      body.regionGoalSY27 || '',
      body.currentStatus || '',
      body.openQuestions || '',
      body.nextMoves || '',
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const regionName = decodeURIComponent(name)
    const rows = await getRows('Regions')
    const idx = rows.findIndex((r) => r[0] === regionName)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deleteRow('Regions', idx)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
