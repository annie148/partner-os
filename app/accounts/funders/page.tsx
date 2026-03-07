'use client'

import { useEffect, useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import EditableCell from '@/components/EditableCell'
import { useColumnResize } from '@/hooks/useColumnResize'
import type { Account, AccountType, Priority, Owner, AskStatus } from '@/types'
import {
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
} from 'lucide-react'

const FUNDER_TYPES: AccountType[] = [
  'Prospective Funder',
  'Current Funder',
  'Former Funder',
  'Declined Funder',
]

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const OWNERS: Owner[] = ['Annie', 'Sam', 'Gab']
const REGIONS = ['Bay Area', 'DC', 'LA', 'National', 'NY']

const ASK_STATUSES: AskStatus[] = [
  'Committed',
  'Submitted/Ask Made',
  'Declined',
  'Need to Qualify',
  'Cultivating',
  'Received',
  'No Ask',
]

const PRIORITY_COLORS: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

const ASK_STATUS_COLORS: Record<string, string> = {
  Committed: 'bg-green-100 text-green-700',
  'Submitted/Ask Made': 'bg-blue-100 text-blue-700',
  Declined: 'bg-red-100 text-red-700',
  'Need to Qualify': 'bg-yellow-100 text-yellow-700',
  Cultivating: 'bg-purple-100 text-purple-700',
  Received: 'bg-emerald-100 text-emerald-700',
  'No Ask': 'bg-gray-100 text-gray-600',
}

function formatCurrency(val: string): string {
  if (!val) return '—'
  const num = parseFloat(val)
  if (isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

type SortKey = keyof Account
type SortDir = 'asc' | 'desc'

export default function FundersPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<Partial<Account>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => {
        const all: Account[] = Array.isArray(data) ? data : []
        setAccounts(all.filter((a) => FUNDER_TYPES.includes(a.type)))
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load funders')
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = accounts
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.region.toLowerCase().includes(q) ||
          a.nextAction.toLowerCase().includes(q)
      )
    }
    if (filterType) list = list.filter((a) => a.type === filterType)
    if (filterPriority) list = list.filter((a) => a.priority === filterPriority)
    if (filterOwner) list = list.filter((a) => a.owner === filterOwner)
    if (filterRegion) list = list.filter((a) => a.region === filterRegion)
    if (filterStatus) list = list.filter((a) => a.askStatus === filterStatus)
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      if (sortKey === 'target' || sortKey === 'committedAmount') {
        const na = parseFloat(String(av)) || 0
        const nb = parseFloat(String(bv)) || 0
        return sortDir === 'asc' ? na - nb : nb - na
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [accounts, search, filterType, filterPriority, filterOwner, filterRegion, filterStatus, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-indigo-500" />
    ) : (
      <ChevronDown size={12} className="text-indigo-500" />
    )
  }

  async function saveField(account: Account, field: keyof Account, value: string) {
    const updated = { ...account, [field]: value }
    await fetch(`/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    load()
  }

  function openEdit(a: Account) {
    setEditing(a)
    const { id, ...rest } = a
    setForm(rest)
    setShowForm(true)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      await fetch(`/api/accounts/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editing, ...form }),
      })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/accounts/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    load()
  }

  function exportCSV() {
    const headers: (keyof Account)[] = ['name', 'type', 'region', 'priority', 'owner', 'lastContactDate', 'nextFollowUpDate', 'nextAction', 'notes', 'askStatus', 'target', 'committedAmount']
    const rows = filtered.map((a) => headers.map((h) => `"${String(a[h] || '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'funders.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const COLUMNS: [SortKey, string][] = [
    ['name', 'Name'],
    ['type', 'Type'],
    ['region', 'Region'],
    ['priority', 'Priority'],
    ['owner', 'Owner'],
    ['askStatus', 'Ask Status'],
    ['target', 'Target'],
    ['committedAmount', 'Committed Amount'],
    ['lastContactDate', 'Last Contact'],
    ['nextFollowUpDate', 'Next Follow-up'],
    ['nextAction', 'Next Action'],
  ]

  const { widths, onMouseDown } = useColumnResize(COLUMNS.length, 130)

  const hasFilters = search || filterType || filterPriority || filterOwner || filterRegion || filterStatus

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} total</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <Download size={14} /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search funders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Types</option>
          {FUNDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          {ASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Owners</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Regions</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterPriority(''); setFilterOwner(''); setFilterRegion(''); setFilterStatus('') }}
            className="text-sm text-gray-400 hover:text-gray-600 px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No funders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {COLUMNS.map(([key, label], i) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      style={{ width: widths[i], minWidth: widths[i] }}
                      className={`relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${
                        i === 0 ? 'sticky left-0 z-10 bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                      }`}
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
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => {
                  const overdue = a.nextFollowUpDate && a.nextFollowUpDate < today()
                  const cells = [
                    <EditableCell value={a.name} onSave={(v) => saveField(a, 'name', v)}>
                      <span className="font-medium text-gray-900">{a.name}</span>
                    </EditableCell>,
                    <EditableCell value={a.type} fieldType="select" options={FUNDER_TYPES} onSave={(v) => saveField(a, 'type', v)}>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{a.type}</span>
                    </EditableCell>,
                    <EditableCell value={a.region} fieldType="select" options={REGIONS} onSave={(v) => saveField(a, 'region', v)}>
                      <span className="text-gray-600">{a.region || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.priority} fieldType="select" options={PRIORITIES} onSave={(v) => saveField(a, 'priority', v)}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>{a.priority}</span>
                    </EditableCell>,
                    <EditableCell value={a.owner} fieldType="select" options={OWNERS} onSave={(v) => saveField(a, 'owner', v)}>
                      <span className="text-gray-600">{a.owner}</span>
                    </EditableCell>,
                    <EditableCell value={a.askStatus} fieldType="select" options={ASK_STATUSES} onSave={(v) => saveField(a, 'askStatus', v)}>
                      {a.askStatus ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ASK_STATUS_COLORS[a.askStatus] || 'bg-gray-100 text-gray-600'}`}>{a.askStatus}</span> : <span>—</span>}
                    </EditableCell>,
                    <EditableCell value={a.target} fieldType="number" onSave={(v) => saveField(a, 'target', v)}>
                      <span className="text-gray-600">{formatCurrency(a.target)}</span>
                    </EditableCell>,
                    <EditableCell value={a.committedAmount} fieldType="number" onSave={(v) => saveField(a, 'committedAmount', v)}>
                      <span className="text-gray-600">{formatCurrency(a.committedAmount)}</span>
                    </EditableCell>,
                    <EditableCell value={a.lastContactDate} fieldType="date" onSave={(v) => saveField(a, 'lastContactDate', v)}>
                      <span className="text-gray-600">{formatDate(a.lastContactDate)}</span>
                    </EditableCell>,
                    <EditableCell value={a.nextFollowUpDate} fieldType="date" onSave={(v) => saveField(a, 'nextFollowUpDate', v)}>
                      <span className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(a.nextFollowUpDate)}</span>
                    </EditableCell>,
                    <EditableCell value={a.nextAction} onSave={(v) => saveField(a, 'nextAction', v)}>
                      <span className="text-gray-600">{a.nextAction || '—'}</span>
                    </EditableCell>,
                  ]
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 group">
                      {cells.map((cell, i) => (
                        <td
                          key={i}
                          style={{ width: widths[i], minWidth: widths[i], maxWidth: widths[i] }}
                          className={`px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap ${
                            i === 0 ? 'sticky left-0 z-10 bg-white group-hover:bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteTarget(a)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
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

      {/* Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={`Edit Funder — ${editing?.name}`} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name">
              <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </Field>
          </div>
          <Field label="Type">
            <select value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })} className={input}>
              {FUNDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Region">
            <select value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className={input}>
              <option value="">— Select region —</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority || ''} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className={input}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select value={form.owner || ''} onChange={(e) => setForm({ ...form, owner: e.target.value as Owner })} className={input}>
              {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Ask Status">
            <select value={form.askStatus || ''} onChange={(e) => setForm({ ...form, askStatus: e.target.value })} className={input}>
              <option value="">— Select —</option>
              {ASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Target ($)">
            <input type="number" value={form.target || ''} onChange={(e) => setForm({ ...form, target: e.target.value })} className={input} placeholder="0" />
          </Field>
          <Field label="Committed Amount ($)">
            <input type="number" value={form.committedAmount || ''} onChange={(e) => setForm({ ...form, committedAmount: e.target.value })} className={input} placeholder="0" />
          </Field>
          <Field label="Last Contact Date">
            <input type="date" value={form.lastContactDate || ''} onChange={(e) => setForm({ ...form, lastContactDate: e.target.value })} className={input} />
          </Field>
          <Field label="Next Follow-up Date">
            <input type="date" value={form.nextFollowUpDate || ''} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} className={input} />
          </Field>
          <div className="col-span-2">
            <Field label="Next Action">
              <input type="text" value={form.nextAction || ''} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className={input} placeholder="What needs to happen next?" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} rows={3} placeholder="Additional notes..." />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Funder" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
