import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow, deleteRow } from '@/lib/sheets'
import type { Opportunity } from '@/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Opportunities')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body: Opportunity = await req.json()
    await updateRow('Opportunities', idx, [
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
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Opportunities')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deleteRow('Opportunities', idx)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
