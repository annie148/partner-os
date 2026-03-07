import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow, deleteRow } from '@/lib/sheets'
import type { Account } from '@/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Accounts')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body: Account = await req.json()
    await updateRow('Accounts', idx, [
      id,
      body.name,
      body.type,
      body.region,
      body.priority,
      body.owner,
      body.lastContactDate,
      body.nextFollowUpDate,
      body.nextAction,
      body.notes,
      body.askStatus || '',
      body.target || '',
      body.committedAmount || '',
      body.goal || '',
      body.principal || '',
      body.engagementType || '',
      body.partnerDashboardLink || '',
      body.partnerEnrollmentToolkit || '',
      body.googleDriveFile || '',
      body.midpointDate || '',
      body.boyData || '',
      body.moyData || '',
      body.eoyData || '',
      body.assessmentName || '',
      body.mathCurriculum || '',
      body.elaCurriculum || '',
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
    const rows = await getRows('Accounts')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deleteRow('Accounts', idx)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
