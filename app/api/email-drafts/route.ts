import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow, deleteRow } from '@/lib/sheets'
import { sendDraft, deleteDraft } from '@/lib/gmail'

/**
 * EmailDrafts sheet columns:
 * A: id (our internal UUID)
 * B: gmailDraftId
 * C: taskTitle
 * D: accountName
 * E: assignee
 * F: recipientEmail
 * G: dueDate
 * H: createdAt
 */

interface EmailDraft {
  id: string
  gmailDraftId: string
  taskTitle: string
  accountName: string
  assignee: string
  recipientEmail: string
  dueDate: string
  createdAt: string
}

function rowToDraft(row: string[]): EmailDraft {
  return {
    id: row[0] || '',
    gmailDraftId: row[1] || '',
    taskTitle: row[2] || '',
    accountName: row[3] || '',
    assignee: row[4] || '',
    recipientEmail: row[5] || '',
    dueDate: row[6] || '',
    createdAt: row[7] || '',
  }
}

/** GET /api/email-drafts — list all pending drafts */
export async function GET() {
  try {
    const rows = await getRows('EmailDrafts')
    const drafts = rows.filter((r) => r[0]).map(rowToDraft)
    return NextResponse.json(drafts)
  } catch {
    // Sheet might not exist yet
    return NextResponse.json([])
  }
}

/** POST /api/email-drafts — send or delete a draft */
export async function POST(req: NextRequest) {
  try {
    const { action, id } = await req.json()
    const rows = await getRows('EmailDrafts')
    const idx = rows.findIndex((r) => r[0] === id)

    if (idx === -1) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const draft = rowToDraft(rows[idx])

    if (action === 'send') {
      await sendDraft(draft.gmailDraftId)
      await deleteRow('EmailDrafts', idx)
      return NextResponse.json({ ok: true, sent: true })
    }

    if (action === 'discard') {
      await deleteDraft(draft.gmailDraftId)
      await deleteRow('EmailDrafts', idx)
      return NextResponse.json({ ok: true, discarded: true })
    }

    return NextResponse.json({ error: 'Invalid action. Use "send" or "discard".' }, { status: 400 })
  } catch (e) {
    console.error('Email draft action error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/** Helper: save a new draft record to the EmailDrafts sheet */
export async function saveDraftRecord(
  gmailDraftId: string,
  taskTitle: string,
  accountName: string,
  assignee: string,
  recipientEmail: string,
  dueDate: string
): Promise<void> {
  await appendRow('EmailDrafts', [
    crypto.randomUUID(),
    gmailDraftId,
    taskTitle,
    accountName,
    assignee,
    recipientEmail,
    dueDate,
    new Date().toISOString(),
  ])
}
