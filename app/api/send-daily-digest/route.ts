import { NextRequest, NextResponse } from 'next/server'
import { getRows } from '@/lib/sheets'
import { todayPacific, offsetDaysPacific, isWeekdayPacific } from '@/lib/date'
import { getAssigneeEmail, sendDigestEmail } from '@/lib/gmail'
import type { DigestTask, TeamMemberDigest } from '@/lib/gmail'
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

function toDigestTask(t: Task): DigestTask {
  return { title: t.title, accountName: t.accountName, dueDate: t.dueDate }
}

/**
 * GET /api/send-daily-digest
 *
 * Sends a daily digest email to each assignee with their overdue,
 * due today, and due this week tasks. Runs as a Vercel cron at 14:00 UTC (6am PT).
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

    // Date boundaries in Pacific time (users are on the West Coast)
    const now = new Date()
    const todayStr = todayPacific()
    const sevenDaysAgoStr = offsetDaysPacific(-7)
    const sevenDaysAheadStr = offsetDaysPacific(7)

    // Filter to open tasks with a due date and assignee
    const openTasks = tasks.filter(
      (t) => t.status !== 'Complete' && t.dueDate && t.assignee
    )

    // Group by assignee
    const byAssignee = new Map<string, Task[]>()
    for (const task of openTasks) {
      const existing = byAssignee.get(task.assignee) || []
      existing.push(task)
      byAssignee.set(task.assignee, existing)
    }

    // Pre-categorize tasks for each assignee
    function categorize(assigneeTasks: Task[]) {
      return {
        overdue: assigneeTasks.filter((t) => t.dueDate >= sevenDaysAgoStr && t.dueDate < todayStr),
        dueToday: assigneeTasks.filter((t) => t.dueDate === todayStr),
        dueThisWeek: assigneeTasks.filter((t) => t.dueDate > todayStr && t.dueDate <= sevenDaysAheadStr),
      }
    }

    const categorized = new Map<string, { overdue: Task[]; dueToday: Task[]; dueThisWeek: Task[] }>()
    for (const [assignee, assigneeTasks] of byAssignee) {
      categorized.set(assignee, categorize(assigneeTasks))
    }

    // Format today's date for subject line
    const dateLabel = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    let sent = 0
    let skipped = 0
    const results: { assignee: string; status: string; overdue: number; today: number; week: number }[] = []

    for (const [assignee] of byAssignee) {
      const email = getAssigneeEmail(assignee)
      if (!email) {
        results.push({ assignee, status: 'skipped-no-email', overdue: 0, today: 0, week: 0 })
        skipped++
        continue
      }

      const own = categorized.get(assignee)!

      // Only send if there are qualifying tasks across the whole team
      const hasOwnTasks = own.overdue.length > 0 || own.dueToday.length > 0 || own.dueThisWeek.length > 0
      const teamMembers: TeamMemberDigest[] = []
      for (const [otherAssignee] of byAssignee) {
        if (otherAssignee === assignee) continue
        const other = categorized.get(otherAssignee)!
        if (other.overdue.length > 0 || other.dueToday.length > 0 || other.dueThisWeek.length > 0) {
          teamMembers.push({
            assignee: otherAssignee,
            overdue: other.overdue.map(toDigestTask),
            dueToday: other.dueToday.map(toDigestTask),
            dueThisWeek: other.dueThisWeek.map(toDigestTask),
          })
        }
      }

      if (!hasOwnTasks && teamMembers.length === 0) {
        results.push({ assignee, status: 'skipped-no-qualifying-tasks', overdue: 0, today: 0, week: 0 })
        skipped++
        continue
      }

      try {
        await sendDigestEmail(email, {
          assignee,
          dateLabel,
          overdue: own.overdue.map(toDigestTask),
          dueToday: own.dueToday.map(toDigestTask),
          dueThisWeek: own.dueThisWeek.map(toDigestTask),
          teamMembers,
        })
        results.push({
          assignee,
          status: `sent to ${email}`,
          overdue: own.overdue.length,
          today: own.dueToday.length,
          week: own.dueThisWeek.length,
        })
        sent++
      } catch (e) {
        results.push({ assignee, status: `error: ${String(e)}`, overdue: 0, today: 0, week: 0 })
      }
    }

    return NextResponse.json({
      date: todayStr,
      dateLabel,
      totalOpenTasks: openTasks.length,
      assignees: byAssignee.size,
      sent,
      skipped,
      results,
    })
  } catch (e) {
    console.error('Daily digest error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
