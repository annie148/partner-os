import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow, updateRow } from '@/lib/sheets'
import { fetchRecentNotes, getNoteContent } from '@/lib/granola'
import { parseMeetingNote } from '@/lib/ai-parse'
import type { Account } from '@/types'

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
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isManual = req.headers.get('x-manual-trigger') === 'true'

    if (!isCron && !isManual) {
      // Allow from same origin (browser requests won't have cron auth)
      const origin = req.headers.get('origin') || req.headers.get('referer')
      if (!origin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 1. Fetch recent Granola notes
    const notes = await fetchRecentNotes(24)
    if (notes.length === 0) {
      return NextResponse.json({ message: 'No recent notes found', synced: 0 })
    }

    // 2. Get already-processed note IDs
    const processedIds = await getProcessedNoteIds()

    // 3. Get existing accounts for matching
    const accountRows = await getRows('Accounts')
    const accounts = accountRows.filter((r) => r[0]).map(rowToAccount)
    const accountNames = accounts.map((a) => a.name)

    let syncedCount = 0
    const results: { noteId: string; title: string; matched: string | null; tasks: number }[] = []

    for (const note of notes) {
      // Skip already processed
      if (processedIds.has(note.id)) continue

      // 4. Parse with AI
      const content = getNoteContent(note)
      if (!content.trim()) continue

      const parsed = await parseMeetingNote(note.title, content, accountNames)

      // 5. Match to account
      const matchedAccount = findBestMatch(parsed.organization, accounts)

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

          const updatedRow = [...accountRows[idx]]
          updatedRow[6] = today // lastContactDate
          updatedRow[9] = updatedNotes // notes
          await updateRow('Accounts', idx, updatedRow)
        }

        // 7. Create tasks for action items
        for (const item of parsed.actionItems) {
          const assignee = ['Annie', 'Sam', 'Gab'].find(
            (o) => o.toLowerCase() === item.assignee.toLowerCase()
          ) || 'Annie'

          await appendRow('Tasks', [
            crypto.randomUUID(),
            matchedAccount.id,
            matchedAccount.name,
            item.title,
            assignee,
            item.dueDate || '',
            'Not Started',
            `From Granola: ${note.title}`,
          ])
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
        matched: matchedAccount?.name || null,
        tasks: parsed.actionItems.length,
      })
      syncedCount++
    }

    return NextResponse.json({
      message: `Synced ${syncedCount} notes`,
      synced: syncedCount,
      skipped: notes.length - syncedCount,
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
