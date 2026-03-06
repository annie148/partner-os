'use client'

import { useEffect, useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import type { Account, AccountType, Priority, Owner } from '@/types'
import {
  Plus,
  Download,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
} from 'lucide-react'

const ACCOUNT_TYPES: AccountType[] = [
  'Prospective Funder',
  'Current Funder',
  'Former Funder',
  'Declined Funder',
  'Prospective School/District',
  'Current School/District',
  'Former School/District',
  'Declined School/District',
]
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const OWNERS: Owner[] = ['Annie', 'Sam', 'Gab']

const PRIORITY_COLORS: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

const TYPE_COLORS: Record<string, string> = {
  Funder: 'bg-blue-100 text-blue-700',
  'School/District': 'bg-purple-100 text-purple-700',
}

function typeColor(type: string) {
  if (type.includes('Funder')) return TYPE_COLORS['Funder']
  return TYPE_COLORS['School/District']
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

const EMPTY: Omit<Account, 'id'> = {
  name: '',
  type: 'Prospective Funder',
  region: '',
  priority: 'Medium',
  owner: 'Annie',
  lastContactDate: '',
  nextFollowUpDate: '',
  nextAction: '',
  notes: '',
}

type SortKey = keyof Account
type SortDir = 'asc' | 'desc'

// Parse TSV/CSV text into rows of objects
function parsePaste(text: string): Partial<Account>[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
  const fieldMap: Record<string, keyof Account> = {
    name: 'name',
    type: 'type',
    region: 'region',
    priority: 'priority',
    owner: 'owner',
    lastcontactdate: 'lastContactDate',
    nextfollowupdate: 'nextFollowUpDate',
    nextaction: 'nextAction',
    notes: 'notes',
  }
  return lines.slice(1).map((line) => {
    const vals = line.split(sep)
    const obj: Partial<Account> = {}
    headers.forEach((h, i) => {
      const field = fieldMap[h]
      if (field) (obj as Record<string, string>)[field] = vals[i]?.trim() || ''
    })
    return obj
  })
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters & sort
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<Omit<Account, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<Partial<Account>[]>([])
  const [importing, setImporting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load accounts')
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
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [accounts, search, filterType, filterPriority, filterOwner, sortKey, sortDir])

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

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(a: Account) {
    setEditing(a)
    setForm({ name: a.name, type: a.type, region: a.region, priority: a.priority, owner: a.owner, lastContactDate: a.lastContactDate, nextFollowUpDate: a.nextFollowUpDate, nextAction: a.nextAction, notes: a.notes })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/accounts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, id: editing.id }),
        })
      } else {
        await fetch('/api/accounts', {
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
    await fetch(`/api/accounts/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    load()
  }

  function exportCSV() {
    const headers = ['name', 'type', 'region', 'priority', 'owner', 'lastContactDate', 'nextFollowUpDate', 'nextAction', 'notes']
    const rows = filtered.map((a) => headers.map((h) => `"${(a[h as keyof Account] || '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'accounts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportParse() {
    setImportPreview(parsePaste(importText))
  }

  async function handleImportConfirm() {
    if (importPreview.length === 0) return
    setImporting(true)
    const items = importPreview.map((p) => ({ ...EMPTY, ...p }))
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    setShowImport(false)
    setImportText('')
    setImportPreview([])
    setImporting(false)
    load()
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const select = input

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Owners</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {(search || filterType || filterPriority || filterOwner) && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterPriority(''); setFilterOwner('') }}
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
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {(
                    [
                      ['name', 'Name'],
                      ['type', 'Type'],
                      ['region', 'Region'],
                      ['priority', 'Priority'],
                      ['owner', 'Owner'],
                      ['lastContactDate', 'Last Contact'],
                      ['nextFollowUpDate', 'Next Follow-up'],
                      ['nextAction', 'Next Action'],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => {
                  const overdue =
                    a.nextFollowUpDate && a.nextFollowUpDate < today()
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {a.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(a.type)}`}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.region || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>
                          {a.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.owner}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(a.lastContactDate)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                        {formatDate(a.nextFollowUpDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {a.nextAction || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          >
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
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Account' : 'Add Account'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={input}
                placeholder="Organization name"
                autoFocus
              />
            </Field>
          </div>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })} className={select}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Region">
            <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={input} placeholder="e.g. Northeast" />
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className={select}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value as Owner })} className={select}>
              {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Last Contact Date">
            <input type="date" value={form.lastContactDate} onChange={(e) => setForm({ ...form, lastContactDate: e.target.value })} className={input} />
          </Field>
          <Field label="Next Follow-up Date">
            <input type="date" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} className={input} />
          </Field>
          <div className="col-span-2">
            <Field label="Next Action">
              <input type="text" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className={input} placeholder="What needs to happen next?" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} rows={3} placeholder="Additional notes…" />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={showImport} onClose={() => { setShowImport(false); setImportText(''); setImportPreview([]) }} title="Import Accounts" size="xl">
        <p className="text-sm text-gray-500 mb-3">
          Paste CSV or TSV data below. First row must be headers:{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">name, type, region, priority, owner, lastContactDate, nextFollowUpDate, nextAction, notes</code>
        </p>
        <textarea
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportPreview([]) }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={6}
          placeholder="name&#9;type&#9;region&#9;priority&#9;owner&#10;Acme Foundation&#9;Current Funder&#9;Northeast&#9;High&#9;Annie"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleImportParse}
            disabled={!importText.trim()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            Preview
          </button>
        </div>
        {importPreview.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">{importPreview.length} rows found</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-48">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {['name', 'type', 'region', 'priority', 'owner'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importPreview.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.region}</td>
                      <td className="px-3 py-2">{row.priority}</td>
                      <td className="px-3 py-2">{row.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => { setShowImport(false); setImportText(''); setImportPreview([]) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleImportConfirm}
            disabled={importing || importPreview.length === 0}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {importing ? 'Importing…' : `Import ${importPreview.length} Accounts`}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Account" size="sm">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
