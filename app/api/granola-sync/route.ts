import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow, updateRow } from '@/lib/sheets'
import { fetchRecentNotes, getNoteContent, extractNextSteps } from '@/lib/granola'
import { parseMeetingNote } from '@/lib/ai-parse'
// Email drafts feature disabled — can re-enable later
// import { getAssigneeEmail, createTaskDraft } from '@/lib/gmail'
// import { saveDraftRecord } from '@/app/api/email-drafts/route'
import type { Account, Contact } from '@/types'

function rowToContact(row: string[]): Contact {
  return {
    id: row[0] || '',
    accountId: row[1] || '',
    accountName: row[2] || '',
    name: row[3] || '',
    email: row[4] || '',
    phone: row[5] || '',
    role: row[6] || '',
    notes: row[7] || '',
  }
}

/** Match a meeting to an account via linked contacts — check attendees and meeting title/content */
function matchViaContacts(
  note: { title: string; attendees?: { name?: string; email?: string }[] },
  content: string,
  contacts: Contact[],
  accounts: Account[]
): Account | null {
  // Only consider contacts that are linked to an account
  const linkedContacts = contacts.filter((c) => c.accountId)

  for (const contact of linkedContacts) {
    const contactName = contact.name.toLowerCase().trim()
    if (!contactName) continue

    // Check attendees
    const attendeeMatch = note.attendees?.some((a) => {
      if (a.email && contact.email && a.email.toLowerCase() === contact.email.toLowerCase()) return true
      if (a.name && a.name.toLowerCase().trim() === contactName) return true
      // Partial name match (first + last)
      if (a.name) {
        const aName = a.name.toLowerCase().trim()
        return aName.includes(contactName) || contactName.includes(aName)
      }
      return false
    })

    // Check meeting title and content for contact name
    const titleMatch = note.title.toLowerCase().includes(contactName)
    const contentMatch = content.toLowerCase().includes(contactName)

    if (attendeeMatch || titleMatch || contentMatch) {
      const account = accounts.find((a) => a.id === contact.accountId)
      if (account) return account
    }
  }
  return null
}

// Fuzzy match: find the best matching account name
function findBestMatch(
  orgName: string,
  accounts: Account[]
): Account | null {
  if (!orgName) return null
  const lower = orgName.toLowerCase().trim()

  // Exact match first
  const exact = accounts.find(
    (a) => a.name.toLowerCase().trim() === lower
  )
  if (exact) return exact

  // Contains match
  const contains = accounts.find(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      lower.includes(a.name.toLowerCase())
  )
  if (contains) return contains

  // Word overlap match — score by shared words
  const orgWords = lower.split(/\s+/).filter((w) => w.length > 2)
  let bestScore = 0
  let bestAccount: Account | null = null

  for (const account of accounts) {
    const accWords = account.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
    const overlap = orgWords.filter((w) => accWords.includes(w)).length
    const score = overlap / Math.max(orgWords.length, accWords.length)
    if (score > bestScore && score >= 0.4) {
      bestScore = score
      bestAccount = account
    }
  }

  return bestAccount
}

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

async function getProcessedNoteIds(): Promise<Set<string>> {
  try {
    const rows = await getRows('GranolaSync')
    return new Set(rows.map((r) => r[0]).filter(Boolean))
  } catch {
    // Sheet might not exist yet
    return new Set()
  }
}

async function markNoteProcessed(noteId: string, title: string, matchedAccount: string): Promise<void> {
  await appendRow('GranolaSync', [
    noteId,
    title,
    matchedAccount,
    new Date().toISOString(),
  ])
}

export async function POST(req: NextRequest) {
  try {
    // Verify this is a manual trigger or cron
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
    const isCronToken = cronSecret && req.headers.get('x-vercel-cron-auth-token') === cronSecret
    const isManual = req.headers.get('x-manual-trigger') === 'true'

    if (!isVercelCron && !isCronToken && !isManual) {
      const origin = req.headers.get('origin') || req.headers.get('referer')
      if (!origin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 1. Fetch recent Granola notes
    const notes = await fetchRecentNotes(168)
    if (notes.length === 0) {
      return NextResponse.json({ message: 'No recent notes found', synced: 0 })
    }

    // 2. Get already-processed note IDs
    const processedIds = await getProcessedNoteIds()

    // 3. Get existing accounts and contacts for matching
    const accountRows = await getRows('Accounts')
    const accounts = accountRows.filter((r) => r[0]).map(rowToAccount)
    const accountNames = accounts.map((a) => a.name)

    const contactRows = await getRows('Contacts')
    const allContacts = contactRows.filter((r) => r[0]).map(rowToContact)

    // Load existing activity sourceIds for deduplication
    let existingSourceIds: Set<string>
    try {
      const activityRows = await getRows('Activity')
      existingSourceIds = new Set(activityRows.map((r) => r[6]).filter(Boolean))
    } catch {
      existingSourceIds = new Set()
    }

    let syncedCount = 0
    const results: {
      noteId: string
      title: string
      status: string
      matched: string | null
      tasks: number
      summary: string
      contentFields: Record<string, boolean>
      contentLength: number
      nextStepsLength?: number
      actionItems?: string[]
      rawKeys?: string[]
    }[] = []

    for (const note of notes) {
      // Skip already processed
      if (processedIds.has(note.id)) {
        results.push({
          noteId: note.id,
          title: note.title,
          status: 'skipped-already-processed',
          matched: null,
          tasks: 0,
          summary: '',
          contentFields: {},
          contentLength: 0,
        })
        continue
      }

      // 4. Parse with AI
      const content = getNoteContent(note)
      const rawKeys = Object.keys(note)
      const contentFields = {
        has_summary: !!note.summary,
        has_notes: !!note.notes,
        has_notes_markdown: !!note.notes_markdown,
        has_summary_markdown: !!note.summary_markdown,
        has_summary_text: !!note.summary_text,
        has_panels: Array.isArray(note.panels) && note.panels.length > 0,
        has_transcript: Array.isArray(note.transcript) && note.transcript.length > 0,
      }

      if (!content.trim()) {
        results.push({
          noteId: note.id,
          title: note.title,
          status: 'skipped-no-content',
          matched: null,
          tasks: 0,
          summary: '',
          contentFields,
          contentLength: 0,
          rawKeys,
        })
        continue
      }

      const nextSteps = extractNextSteps(note)
      const parsed = await parseMeetingNote(note.title, content, accountNames, nextSteps || undefined)

      // 5. Match to account — first by org name, then by linked contacts
      const matchedAccount =
        findBestMatch(parsed.organization, accounts) ||
        matchViaContacts(note, content, allContacts, accounts)

      const today = new Date().toISOString().split('T')[0]

      if (matchedAccount) {
        // 6. Update account: lastContactDate + append summary to notes
        const idx = accountRows.findIndex((r) => r[0] === matchedAccount.id)
        if (idx !== -1) {
          const existingNotes = matchedAccount.notes || ''
          const summaryLine = `[${today} - Granola] ${parsed.summary}`
          const updatedNotes = existingNotes
            ? `${existingNotes}\n${summaryLine}`
            : summaryLine

          // Pad row to at least 40 columns (A-AN) so sparse rows don't lose data
          const updatedRow = Array.from({ length: 40 }, (_, i) => accountRows[idx][i] || '')
          updatedRow[6] = today // lastContactDate
          updatedRow[9] = updatedNotes // notes
          await updateRow('Accounts', idx, updatedRow)
        }

        // 6b. Auto-log Granola meeting as activity (deduplicate by sourceId)
        if (!existingSourceIds.has(note.id)) {
          const meetingDate = note.created_at
            ? new Date(note.created_at).toISOString().split('T')[0]
            : today
          try {
            await appendRow('Activity', [
              crypto.randomUUID(),
              matchedAccount.id,
              meetingDate,
              'Meeting',
              `[Granola] ${note.title}`,
              matchedAccount.owner || 'Granola Sync',
              note.id,
            ])
            existingSourceIds.add(note.id)
          } catch (e) {
            console.error('Failed to log Granola activity:', e)
          }
        }

        // 7. Create tasks for action items
        for (const item of parsed.actionItems) {
          const assignee = ['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy'].find(
            (o) => o.toLowerCase() === item.assignee.toLowerCase()
          ) || ''

          await appendRow('Tasks', [
            crypto.randomUUID(),
            matchedAccount.id,
            matchedAccount.name,
            item.title,
            assignee,
            item.dueDate || '',
            'Not Started',
            `From Granola: ${note.title}`,
            '',
            '',
            'Other',
          ])

          // Email drafts feature disabled — can re-enable later
          // if (assignee) {
          //   const email = getAssigneeEmail(assignee)
          //   if (email) {
          //     try {
          //       const draftId = await createTaskDraft(email, {
          //         taskTitle: item.title,
          //         taskNotes: `From Granola: ${note.title}`,
          //         accountName: matchedAccount.name,
          //         assignee,
          //         dueDate: item.dueDate || '',
          //       })
          //       await saveDraftRecord(
          //         draftId,
          //         item.title,
          //         matchedAccount.name,
          //         assignee,
          //         email,
          //         item.dueDate || ''
          //       )
          //     } catch (e) {
          //       console.error('Failed to create email draft:', e)
          //     }
          //   }
          // }
        }
      }

      // 8. Mark as processed
      await markNoteProcessed(
        note.id,
        note.title,
        matchedAccount?.name || parsed.organization
      )

      results.push({
        noteId: note.id,
        title: note.title,
        status: matchedAccount ? 'synced' : 'no-account-match',
        matched: matchedAccount?.name || null,
        tasks: parsed.actionItems.length,
        summary: parsed.summary,
        contentFields,
        contentLength: content.length,
        nextStepsLength: nextSteps.length,
        actionItems: parsed.actionItems.map((a) => a.title),
      })
      syncedCount++
    }

    const alreadyProcessed = results.filter((r) => r.status === 'skipped-already-processed').length
    const noContent = results.filter((r) => r.status === 'skipped-no-content').length
    const noMatch = results.filter((r) => r.status === 'no-account-match').length

    return NextResponse.json({
      message: `Synced ${syncedCount} notes`,
      synced: syncedCount,
      skipped: alreadyProcessed,
      noContent,
      noMatch,
      totalNotes: notes.length,
      results,
    })
  } catch (e) {
    console.error('Granola sync error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET handler for Vercel cron
export async function GET(req: NextRequest) {
  // Vercel cron calls GET — forward to POST logic
  return POST(req)
}
