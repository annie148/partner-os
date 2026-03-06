import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
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
  }
}

export async function GET() {
  try {
    const rows = await getRows('Tasks')
    const tasks = rows.filter((r) => r[0]).map(rowToTask)
    return NextResponse.json(tasks)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Task, 'id'> = await req.json()
    const id = crypto.randomUUID()
    await appendRow('Tasks', [
      id,
      body.accountId,
      body.accountName,
      body.title,
      body.assignee,
      body.dueDate,
      body.status,
      body.notes,
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
