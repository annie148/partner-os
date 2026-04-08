'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import Modal from '@/components/Modal'
import type { Task, TaskStatus, TaskType, Owner, Account, Region } from '@/types'
import EditableCell from '@/components/EditableCell'
import SearchableSelect from '@/components/SearchableSelect'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import ColumnToggle from '@/components/ColumnToggle'
import { Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

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

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const EMPTY: Omit<Task, 'id'> = {
  accountId: '',
  accountName: '',
  title: '',
  assignee: '' as Owner,
  dueDate: '',
  status: 'Not Started',
  notes: '',
  region: '',
  completedDate: '',
  type: 'Other',
}

type SortKey = keyof Task
type SortDir = 'asc' | 'desc'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterStatuses, setFilterStatuses] = useState<Set<TaskStatus>>(new Set(['Not Started', 'In Progress', 'Blocked']))
  const [filterAccount, setFilterAccount] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<Omit<Task, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Email drafts feature disabled — can re-enable later
  // interface EmailDraft {
  //   id: string
  //   gmailDraftId: string
  //   taskTitle: string
  //   accountName: string
  //   assignee: string
  //   recipientEmail: string
  //   dueDate: string
  //   createdAt: string
  // }

  // const [drafts, setDrafts] = useState<EmailDraft[]>([])
  // const [draftAction, setDraftAction] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/regions').then((r) => r.json()),
    ]).then(([t, a, reg]) => {
      setTasks(Array.isArray(t) ? t : [])
      setAccounts(Array.isArray(a) ? a : [])
      setRegions(Array.isArray(reg) ? reg : [])
      setLoading(false)
    })
  }

  // Email drafts feature disabled — can re-enable later
  // async function handleDraftAction(id: string, action: 'send' | 'discard') {
  //   setDraftAction(id)
  //   try {
  //     await fetch('/api/email-drafts', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ id, action }),
  //     })
  //     load()
  //   } finally {
  //     setDraftAction(null)
  //   }
  // }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const filtered = useMemo(() => {
    let list = tasks
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.accountName.toLowerCase().includes(q)
      )
    }
    if (filterAssignee) list = list.filter((t) => t.assignee === filterAssignee)
    if (filterStatuses.size > 0 && filterStatuses.size < STATUSES.length) list = list.filter((t) => filterStatuses.has(t.status))
    if (filterAccount) list = list.filter((t) => t.accountId === filterAccount)
    if (filterRegion) list = list.filter((t) => t.region === filterRegion)
    return [...list].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      // For dueDate sort, push empty dates to the bottom regardless of direction
      if (sortKey === 'dueDate') {
        if (!av && !bv) return 0
        if (!av) return 1
        if (!bv) return -1
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [tasks, search, filterAssignee, filterStatuses, filterAccount, filterRegion, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-indigo-500" /> : <ChevronDown size={12} className="text-indigo-500" />
  }

  async function saveField(task: Task, field: keyof Task, value: string) {
    const updated = { ...task, [field]: value }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, [field]: value } as Task : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
        setToast('Failed to save. Please try again.')
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
      setToast('Failed to save. Please try again.')
    }
  }

  async function saveAccount(task: Task, accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    const updated = { ...task, accountId, accountName: acc?.name || '' }
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated as Task : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
        setToast('Failed to save. Please try again.')
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
      setToast('Failed to save. Please try again.')
    }
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(t: Task) {
    setEditing(t)
    setForm({ accountId: t.accountId, accountName: t.accountName, title: t.title, assignee: t.assignee, dueDate: t.dueDate, status: t.status, notes: t.notes, region: t.region, completedDate: t.completedDate, type: t.type || 'Other' })
    setShowForm(true)
  }

  function handleAccountChange(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    setForm({ ...form, accountId, accountName: acc?.name || '' })
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/tasks/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, id: editing.id }),
        })
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/tasks/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    load()
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  const TASK_COLUMNS: [SortKey, string][] = [
    ['title', 'Title'],
    ['accountName', 'Account'],
    ['region', 'Region'],
    ['assignee', 'Assignee'],
    ['dueDate', 'Due Date'],
    ['status', 'Status'],
    ['type', 'Type'],
  ]
  // +2 for Notes and Actions columns
  // Title column gets more space since it has the longest content
  const { widths, onMouseDown } = useColumnResize(TASK_COLUMNS.length + 2, [260, 140, 100, 100, 110, 110, 90, 140, 80])
  const { hiddenKeys, toggle: toggleColumn, isVisible } = useColumnVisibility('tasks')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tasks.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <div className="relative" ref={statusDropdownRef}>
          <button
            onClick={() => setStatusDropdownOpen((o) => !o)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex items-center gap-1"
          >
            {filterStatuses.size === STATUSES.length || filterStatuses.size === 0
              ? 'All Statuses'
              : `Status: ${[...filterStatuses].join(', ')}`}
            <ChevronDown size={14} className="text-gray-400 ml-1" />
          </button>
          {statusDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 min-w-[180px]">
              {STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={filterStatuses.has(s)}
                    onChange={() => {
                      setFilterStatuses((prev) => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s)
                        else next.add(s)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {s}
                </label>
              ))}
            </div>
          )}
        </div>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Assignees</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <SearchableSelect
          value={filterAccount}
          onChange={setFilterAccount}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="All Accounts"
          className="w-56"
        />
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Regions</option>
          {regions.map((r) => <option key={r.regionName} value={r.regionName}>{r.regionName}</option>)}
        </select>
        {(search || filterStatuses.size < STATUSES.length || filterAssignee || filterAccount || filterRegion) && (
          <button
            onClick={() => { setSearch(''); setFilterStatuses(new Set(STATUSES)); setFilterAssignee(''); setFilterAccount(''); setFilterRegion('') }}
            className="text-sm text-gray-400 hover:text-gray-600 px-2"
          >
            Clear filters
          </button>
        )}
        <ColumnToggle
          columns={[...TASK_COLUMNS.map(([key, label]) => ({ key, label })), { key: 'notes', label: 'Notes' }]}
          hiddenKeys={hiddenKeys}
          onToggle={toggleColumn}
          alwaysVisible={['title']}
        />
      </div>

      {/* Pending Email Drafts — feature disabled, can re-enable later */}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No tasks found.</div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="text-sm" style={{ minWidth: '100%' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  {TASK_COLUMNS.map(([key, label], i) => isVisible(key) && (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      style={{ width: widths[i], minWidth: widths[i] }}
                      className="relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); onMouseDown(i, e) }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                      />
                    </th>
                  ))}
                  {isVisible('notes') && (
                    <th
                      style={{ width: widths[TASK_COLUMNS.length], minWidth: widths[TASK_COLUMNS.length] }}
                      className="relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      Notes
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); onMouseDown(TASK_COLUMNS.length, e) }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                      />
                    </th>
                  )}
                  <th style={{ width: widths[TASK_COLUMNS.length + 1], minWidth: widths[TASK_COLUMNS.length + 1] }} className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const overdue = t.dueDate && t.dueDate < today() && t.status !== 'Complete'
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 group">
                      {isVisible('title') && (
                        <td style={{ width: widths[0], minWidth: widths[0], maxWidth: widths[0] }} className="px-4 py-3 font-medium text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" title={t.title}>
                          <EditableCell value={t.title} onSave={(v) => saveField(t, 'title', v)}>
                            <Link href={`/tasks/${t.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-600 hover:underline">{t.title}</Link>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('accountName') && (
                        <td style={{ width: widths[1], minWidth: widths[1], maxWidth: widths[1] }} className="px-4 py-3 text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                          <EditableCell value={t.accountName} fieldType="select" options={accounts.map((a) => a.name).sort()} onSave={(v) => {
                            const acc = accounts.find((a) => a.name === v)
                            return saveAccount(t, acc?.id || '')
                          }}>
                            <span className="text-gray-600">{t.accountName || '—'}</span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('region') && (
                        <td style={{ width: widths[2], minWidth: widths[2], maxWidth: widths[2] }} className="px-4 py-3 text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                          <EditableCell value={t.region} fieldType="select" options={regions.map((r) => r.regionName)} onSave={(v) => saveField(t, 'region', v)}>
                            <span className="text-gray-600">{t.region || '—'}</span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('assignee') && (
                        <td style={{ width: widths[3], minWidth: widths[3], maxWidth: widths[3] }} className="px-4 py-3 text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                          <EditableCell value={t.assignee} fieldType="select" options={OWNERS} onSave={(v) => saveField(t, 'assignee', v)}>
                            <span className="text-gray-600">{t.assignee || '—'}</span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('dueDate') && (
                        <td style={{ width: widths[4], minWidth: widths[4], maxWidth: widths[4] }} className="px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap">
                          <EditableCell value={t.dueDate} fieldType="date" onSave={(v) => saveField(t, 'dueDate', v)}>
                            <span className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(t.dueDate)}</span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('status') && (
                        <td style={{ width: widths[5], minWidth: widths[5], maxWidth: widths[5] }} className="px-4 py-3 whitespace-nowrap">
                          <EditableCell value={t.status} fieldType="select" options={STATUSES} onSave={(v) => saveField(t, 'status', v)}>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                              {t.status}
                            </span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('type') && (
                        <td style={{ width: widths[6], minWidth: widths[6], maxWidth: widths[6] }} className="px-4 py-3 whitespace-nowrap">
                          <EditableCell value={t.type || 'Other'} fieldType="select" options={TASK_TYPES} onSave={(v) => saveField(t, 'type', v)}>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.type] || TYPE_COLORS.Other}`}>
                              {t.type || 'Other'}
                            </span>
                          </EditableCell>
                        </td>
                      )}
                      {isVisible('notes') && (
                        <td style={{ width: widths[7], minWidth: widths[7], maxWidth: widths[7] }} className="px-4 py-3 text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                          <EditableCell value={t.notes} onSave={(v) => saveField(t, 'notes', v)}>
                            <span className="text-gray-500">{t.notes || '—'}</span>
                          </EditableCell>
                        </td>
                      )}
                      <td style={{ width: widths[8], minWidth: widths[8] }} className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Task' : 'Add Task'} size="md">
        <div className="space-y-4">
          <Field label="Title *">
            <textarea value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${input} resize-none`} rows={2} placeholder="Task title" />
          </Field>
          <Field label="Account">
            <SearchableSelect
              value={form.accountId}
              onChange={handleAccountChange}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="— No account —"
            />
          </Field>
          <Field label="Region">
            <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={input}>
              <option value="">— No region —</option>
              {regions.map((r) => <option key={r.regionName} value={r.regionName}>{r.regionName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assignee">
              <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value as Owner })} className={input}>
                <option value="">— Unassigned —</option>
                {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Due Date">
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={input} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.type || 'Other'} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })} className={input}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} rows={3} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task" size="sm">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 animate-fade-in">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  )
}
