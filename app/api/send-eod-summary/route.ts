import { NextRequest, NextResponse } from 'next/server'
import { getRows } from '@/lib/sheets'
import { todayPacific, isWeekdayPacific } from '@/lib/date'
import { TEAM_EMAILS, sendEodEmail } from '@/lib/gmail'
import type { EodTask, EodOwnerGroup } from '@/lib/gmail'
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

function toEodTask(t: Task): EodTask {
  return { title: t.title, accountName: t.accountName, dueDate: t.dueDate, status: t.status }
}

/**
 * GET /api/send-eod-summary
 *
 * Sends an end-of-day summary email to all team members.
 * Section 1: Tasks completed today, grouped by owner.
 * Section 2: Outstanding tasks (not complete), grouped by owner.
 * Runs as a Vercel cron at midnight UTC (5pm PT).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
  const isCronToken = cronSecret && req.headers.get('x-vercel-cron-auth-token') === cronSecret
  const origin = req.headers.get('origin') || req.headers.get('referer')

  if (!isVercelCron && !isCronToken && !origin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isWeekdayPacific()) {
    return NextResponse.json({ skipped: true, reason: 'weekend' })
  }

  try {
    const rows = await getRows('Tasks')
    const tasks = rows.filter((r) => r[0]).map(rowToTask)

    const todayStr = todayPacific()
    const now = new Date()
    const dateLabel = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    // Tasks completed today
    const completedToday = tasks.filter(
      (t) => t.status === 'Complete' && t.completedDate === todayStr
    )

    // Outstanding tasks (not complete, with an assignee)
    const outstanding = tasks.filter(
      (t) => t.status !== 'Complete' && t.assignee
    )

    // Group by owner
    function groupByOwner(taskList: Task[]): EodOwnerGroup[] {
      const map = new Map<string, Task[]>()
      for (const t of taskList) {
        const owner = t.assignee || 'Unassigned'
        const existing = map.get(owner) || []
        existing.push(t)
        map.set(owner, existing)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([owner, ownerTasks]) => ({
          owner,
          tasks: ownerTasks.map(toEodTask),
        }))
    }

    const completedByOwner = groupByOwner(completedToday)
    const outstandingByOwner = groupByOwner(outstanding)

    let sent = 0
    let skipped = 0
    const results: { recipient: string; status: string }[] = []

    for (const [name, email] of Object.entries(TEAM_EMAILS)) {
      try {
        await sendEodEmail(email, {
          recipient: name,
          dateLabel,
          completedByOwner,
          outstandingByOwner,
        })
        results.push({ recipient: name, status: `sent to ${email}` })
        sent++
      } catch (e) {
        results.push({ recipient: name, status: `error: ${String(e)}` })
      }
    }

    return NextResponse.json({
      date: todayStr,
      dateLabel,
      completedToday: completedToday.length,
      outstanding: outstanding.length,
      sent,
      skipped,
      results,
    })
  } catch (e) {
    console.error('EOD summary error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
