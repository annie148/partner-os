import { NextResponse } from 'next/server'
import { getRows, updateRow } from '@/lib/sheets'
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function findAccountForContact(
  contactName: string,
  accounts: Account[]
): Account | null {
  if (!contactName) return null
  const cn = normalize(contactName)

  // 1. Check if contact name appears in account's principal field
  for (const a of accounts) {
    if (a.principal && normalize(a.principal).includes(cn)) return a
    if (a.principal && cn.includes(normalize(a.principal))) return a
  }

  // 2. Check if contact name appears in account notes (CSV import put "Main Contact" there)
  for (const a of accounts) {
    if (a.notes && normalize(a.notes).includes(cn)) return a
  }

  // 3. Check last-name match against principal field
  const lastWord = cn.split(' ').pop() || ''
  if (lastWord.length >= 3) {
    for (const a of accounts) {
      if (a.principal) {
        const principalLast = normalize(a.principal).split(' ').pop() || ''
        if (principalLast === lastWord) return a
      }
    }
  }

  return null
}

export async function POST() {
  try {
    const [contactRows, accountRows] = await Promise.all([
      getRows('Contacts'),
      getRows('Accounts'),
    ])

    const accounts = accountRows.filter((r) => r[0]).map(rowToAccount)
    let linked = 0
    let alreadyLinked = 0
    let unmatched = 0
    const results: { contact: string; account: string | null; status: string }[] = []

    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i]
      if (!row[0]) continue // skip rows without id

      const contactName = row[3] || ''
      const existingAccountId = row[1] || ''

      if (existingAccountId) {
        alreadyLinked++
        results.push({ contact: contactName, account: row[2], status: 'already linked' })
        continue
      }

      const match = findAccountForContact(contactName, accounts)
      if (match) {
        const updatedRow = [...row]
        // Ensure row has at least 8 columns
        while (updatedRow.length < 8) updatedRow.push('')
        updatedRow[1] = match.id
        updatedRow[2] = match.name
        await updateRow('Contacts', i, updatedRow)
        linked++
        results.push({ contact: contactName, account: match.name, status: 'linked' })
      } else {
        unmatched++
        results.push({ contact: contactName, account: null, status: 'no match' })
      }
    }

    return NextResponse.json({
      message: `Linked ${linked} contacts. ${alreadyLinked} already linked. ${unmatched} unmatched.`,
      linked,
      alreadyLinked,
      unmatched,
      results,
    })
  } catch (e) {
    console.error('Auto-link error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
