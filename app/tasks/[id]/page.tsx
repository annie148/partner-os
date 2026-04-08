'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import EditableCell from '@/components/EditableCell'
import NotesDisplay from '@/components/NotesDisplay'
import type { Task, TaskStatus, TaskType, Owner, Account } from '@/types'
import { ArrowLeft } from 'lucide-react'

const OWNERS: Owner[] = ['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy']
const STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Complete']
const TASK_TYPES: TaskType[] = ['Follow-up', 'Outreach', 'Internal', 'Other']

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Blocked: 'bg-orange-100 text-orange-700',
  Complete: 'bg-green-100 text-green-700',
}

const TYPE_COLORS: Record<string, string> = {
  'Follow-up': 'bg-purple-50 text-purple-700',
  Outreach: 'bg-sky-50 text-sky-700',
  Internal: 'bg-gray-100 text-gray-600',
  Other: 'bg-gray-50 text-gray-500',
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<Task | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/tasks/${id}`).then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ]).then(([t, a]) => {
      setTask(t.error ? null : t)
      setAccounts(Array.isArray(a) ? a : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function saveField(field: keyof Task, value: string) {
    if (!task) return
    const prev = task
    const updated = { ...task, [field]: value } as Task
    setTask(updated)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        setTask(prev)
        setToast('Failed to save. Please try again.')
      }
    } catch {
      setTask(prev)
      setToast('Failed to save. Please try again.')
    }
  }

  async function saveAccount(accountName: string) {
    if (!task) return
    const prev = task
    const acc = accounts.find((a) => a.name === accountName)
    const updated = { ...task, accountId: acc?.id || '', accountName: acc?.name || '' } as Task
    setTask(updated)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        setTask(prev)
        setToast('Failed to save. Please try again.')
      }
    } catch {
      setTask(prev)
      setToast('Failed to save. Please try again.')
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
  }

  if (!task) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Task not found.</p>
        <Link href="/tasks" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
          &larr; Back to Tasks
        </Link>
      </div>
    )
  }

  const todayStr = today()
  const overdue = task.dueDate && task.dueDate < todayStr && task.status !== 'Complete'

  // Build account detail link
  const account = accounts.find((a) => a.id === task.accountId)
  const accountHref = account
    ? account.type.includes('Funder')
      ? `/accounts/funders/${account.id}`
      : `/accounts/schools/${account.id}`
    : null

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Tasks
        </Link>
        <EditableCell value={task.title} onSave={(v) => saveField('title', v)}>
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
        </EditableCell>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <EditableCell value={task.status} fieldType="select" options={STATUSES} onSave={(v) => saveField('status', v)}>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
              {task.status}
            </span>
          </EditableCell>
          <EditableCell value={task.type || 'Other'} fieldType="select" options={TASK_TYPES} onSave={(v) => saveField('type', v)}>
            <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[task.type] || TYPE_COLORS.Other}`}>
              {task.type || 'Other'}
            </span>
          </EditableCell>
          {overdue && (
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Assignee</p>
          <EditableCell value={task.assignee} fieldType="select" options={OWNERS} onSave={(v) => saveField('assignee', v)}>
            <p className="text-sm font-semibold text-gray-900 mt-1">{task.assignee || '—'}</p>
          </EditableCell>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</p>
          <EditableCell value={task.dueDate} fieldType="date" onSave={(v) => saveField('dueDate', v)}>
            <p className={`text-sm font-semibold mt-1 ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
              {formatDate(task.dueDate)}
            </p>
          </EditableCell>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account</p>
          <EditableCell value={task.accountName} fieldType="select" options={accounts.map((a) => a.name).sort()} onSave={saveAccount}>
            {accountHref ? (
              <Link href={accountHref} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-indigo-600 hover:underline mt-1 block">
                {task.accountName}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-gray-900 mt-1">{task.accountName || '—'}</p>
            )}
          </EditableCell>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
        <EditableCell value={task.notes} fieldType="textarea" onSave={(v) => saveField('notes', v)}>
          {task.notes ? <NotesDisplay text={task.notes} /> : <p className="text-sm text-gray-400">—</p>}
        </EditableCell>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  )
}
