import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow, deleteRow } from '@/lib/sheets'
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Tasks')
    const row = rows.find((r) => r[0] === id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rowToTask(row))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Tasks')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body: Task = await req.json()
    const prevStatus = (rows[idx][6] || 'Not Started') as Task['status']
    const completedDate = body.status === 'Complete' && prevStatus !== 'Complete'
      ? todayPacific()
      : body.status === 'Complete'
        ? body.completedDate || rows[idx][9] || ''
        : ''
    await updateRow('Tasks', idx, [
      id,
      body.accountId,
      body.accountName,
      body.title,
      body.assignee,
      body.dueDate,
      body.status,
      body.notes,
      body.region || '',
      completedDate,
      body.type || 'Other',
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await getRows('Tasks')
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deleteRow('Tasks', idx)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
