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
    // Validate date range: end must be >= start
    if (body.boyDataEnd && body.boyData && body.boyDataEnd < body.boyData) {
      return NextResponse.json({ error: 'BOY Data Window end date must be on or after start date' }, { status: 400 })
    }
    if (body.moyDataEnd && body.moyData && body.moyDataEnd < body.moyData) {
      return NextResponse.json({ error: 'MOY Data Window end date must be on or after start date' }, { status: 400 })
    }
    if (body.eoyDataEnd && body.eoyData && body.eoyDataEnd < body.eoyData) {
      return NextResponse.json({ error: 'EOY Data Window end date must be on or after start date' }, { status: 400 })
    }
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
      body.granolaNotesUrl || '',
      body.obcStatus || '',
      body.contractCap || '',
      body.dsaStatus || '',
      body.district || '',
      body.parentDistrictId || '',
      body.accountLevel || '',
      body.mouStatus || '',
      body.dataReceived || '',
      body.districtAssessmentMath || '',
      body.districtAssessmentReading || '',
      body.testWindow || '',
      body.matchedStudents || '',
      body.assessmentFollowUpNotes || '',
      body.contractSigned || '',
      body.boyDataEnd || '',
      body.moyDataEnd || '',
      body.eoyDataEnd || '',
      body.eoyMeeting || '',
      body.contractType || '',
      body.moyDataShared || '',
      body.eoyDataShared || '',
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
