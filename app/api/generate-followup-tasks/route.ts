import { NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
import { todayPacific } from '@/lib/date'
import type { Task } from '@/types'

function rowToTask(row: string[]): Task {
  return {
    id: row[0] || '',
    accountId: row[1] || '',
    accountName: row[2] || '',
    title: row[3] || '',
    assignee: (row[4] || '') as Task['assignee'],
    dueDate: row[5] || '',
    status: (row[6] || 'Not Started') as Task['status'],
    notes: row[7] || '',
    region: row[8] || '',
    completedDate: row[9] || '',
    type: (row[10] || 'Other') as Task['type'],
  }
}

/**
 * POST /api/generate-followup-tasks
 * Auto-generates Follow-up tasks for accounts with overdue nextFollowUpDate
 * that don't already have an open Follow-up task.
 */
export async function POST() {
  try {
    const [accountRows, taskRows] = await Promise.all([
      getRows('Accounts'),
      getRows('Tasks'),
    ])

    const todayStr = todayPacific()
    const tasks = taskRows.filter((r) => r[0]).map(rowToTask)

    // Find accounts with overdue follow-up dates
    const overdueAccounts = accountRows
      .filter((r) => r[0] && r[7] && r[7] < todayStr) // r[7] = nextFollowUpDate
      .map((r) => ({
        id: r[0],
        name: r[1] || '',
        owner: r[5] || '',
        region: r[3] || '',
        nextFollowUpDate: r[7] || '',
        nextAction: r[8] || '',
      }))

    let created = 0
    for (const acct of overdueAccounts) {
      // Check if there's already a Follow-up task for this account —
      // either still open, or completed with the same due date (to avoid
      // re-creating a task the user just checked off)
      const hasExistingFollowUp = tasks.some(
        (t) =>
          t.accountId === acct.id &&
          t.type === 'Follow-up' &&
          (t.status !== 'Complete' || t.dueDate === acct.nextFollowUpDate)
      )
      if (hasExistingFollowUp) continue

      const title = acct.nextAction
        ? `Follow up: ${acct.nextAction}`
        : `Follow up with ${acct.name}`

      await appendRow('Tasks', [
        crypto.randomUUID(),
        acct.id,
        acct.name,
        title,
        acct.owner,
        acct.nextFollowUpDate,
        'Not Started',
        `Auto-generated from overdue follow-up date (${acct.nextFollowUpDate})`,
        acct.region,
        '',
        'Follow-up',
      ])
      created++
    }

    return NextResponse.json({ ok: true, created })
  } catch (e) {
    console.error('Generate follow-up tasks error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
