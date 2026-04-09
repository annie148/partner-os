import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
import type { Account } from '@/types'

function rowToAccount(row: string[]): Account {
  return {
    id: row[0] || '',
    name: row[1] || '',
    type: (row[2] || '') as Account['type'],
    region: row[3] || '',
    priority: (row[4] || '') as Account['priority'],
    owner: (row[5] || '') as Account['owner'],
    lastContactDate: row[6] || '',
    nextFollowUpDate: row[7] || '',
    nextAction: row[8] || '',
    notes: row[9] || '',
    askStatus: row[10] || '',
    target: row[11] || '',
    committedAmount: row[12] || '',
    goal: row[13] || '',
    principal: row[14] || '',
    engagementType: row[15] || '',
    partnerDashboardLink: row[16] || '',
    partnerEnrollmentToolkit: row[17] || '',
    googleDriveFile: row[18] || '',
    midpointDate: row[19] || '',
    boyData: row[20] || '',
    moyData: row[21] || '',
    eoyData: row[22] || '',
    assessmentName: row[23] || '',
    mathCurriculum: row[24] || '',
    elaCurriculum: row[25] || '',
    granolaNotesUrl: row[26] || '',
    obcStatus: row[27] || '',
    contractCap: row[28] || '',
    dsaStatus: row[29] || '',
    district: row[30] || '',
    parentDistrictId: row[31] || '',
    accountLevel: (row[32] || '') as Account['accountLevel'],
    mouStatus: row[33] || '',
    dataReceived: row[34] || '',
    districtAssessmentMath: row[35] || '',
    districtAssessmentReading: row[36] || '',
    testWindow: row[37] || '',
    matchedStudents: row[38] || '',
    assessmentFollowUpNotes: row[39] || '',
    contractSigned: row[40] || '',
  }
}

function accountToRow(account: Omit<Account, 'id'>, id: string): string[] {
  return [
    id,
    account.name,
    account.type,
    account.region,
    account.priority,
    account.owner,
    account.lastContactDate,
    account.nextFollowUpDate,
    account.nextAction,
    account.notes,
    account.askStatus || '',
    account.target || '',
    account.committedAmount || '',
    account.goal || '',
    account.principal || '',
    account.engagementType || '',
    account.partnerDashboardLink || '',
    account.partnerEnrollmentToolkit || '',
    account.googleDriveFile || '',
    account.midpointDate || '',
    account.boyData || '',
    account.moyData || '',
    account.eoyData || '',
    account.assessmentName || '',
    account.mathCurriculum || '',
    account.elaCurriculum || '',
    account.granolaNotesUrl || '',
    account.obcStatus || '',
    account.contractCap || '',
    account.dsaStatus || '',
    account.district || '',
    account.parentDistrictId || '',
    account.accountLevel || '',
    account.mouStatus || '',
    account.dataReceived || '',
    account.districtAssessmentMath || '',
    account.districtAssessmentReading || '',
    account.testWindow || '',
    account.matchedStudents || '',
    account.assessmentFollowUpNotes || '',
    account.contractSigned || '',
  ]
}

export async function GET() {
  try {
    const rows = await getRows('Accounts')
    const accounts = rows.filter((r) => r[0]).map(rowToAccount)
    return NextResponse.json(accounts)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Account, 'id'> | Omit<Account, 'id'>[] = await req.json()
    const items = Array.isArray(body) ? body : [body]
    const ids: string[] = []
    for (const item of items) {
      const id = crypto.randomUUID()
      ids.push(id)
      await appendRow('Accounts', accountToRow(item, id))
    }
    return NextResponse.json({ ok: true, id: ids[0], ids })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
