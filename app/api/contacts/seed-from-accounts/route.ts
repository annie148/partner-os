import { NextResponse } from 'next/server'
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
  }
}

export async function POST() {
  try {
    const [accountRows, contactRows] = await Promise.all([
      getRows('Accounts'),
      getRows('Contacts'),
    ])

    const accounts = accountRows.filter((r) => r[0]).map(rowToAccount)
    const existingContactNames = new Set(
      contactRows.map((r) => (r[3] || '').toLowerCase().trim()).filter(Boolean)
    )

    let created = 0
    let skipped = 0
    const results: { account: string; contact: string; status: string }[] = []

    for (const account of accounts) {
      if (!account.principal || !account.principal.trim()) {
        continue
      }

      const principalName = account.principal.trim()

      // Skip if a contact with this name already exists
      if (existingContactNames.has(principalName.toLowerCase())) {
        skipped++
        results.push({ account: account.name, contact: principalName, status: 'already exists' })
        continue
      }

      // Create contact from principal field
      await appendRow('Contacts', [
        crypto.randomUUID(),
        account.id,
        account.name,
        principalName,
        '', // email
        '', // phone
        'Principal', // role
        `Auto-created from account: ${account.name}`,
      ])

      existingContactNames.add(principalName.toLowerCase())
      created++
      results.push({ account: account.name, contact: principalName, status: 'created' })
    }

    return NextResponse.json({
      message: `Created ${created} contacts from account principals. ${skipped} already existed.`,
      created,
      skipped,
      results,
    })
  } catch (e) {
    console.error('Seed contacts error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
