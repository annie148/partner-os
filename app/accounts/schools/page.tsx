'use client'

import { useEffect, useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import type { Account, AccountType, Priority, Owner, EngagementType } from '@/types'
import {
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'

const SCHOOL_TYPES: AccountType[] = [
  'Prospective School/District',
  'Current School/District',
  'Former School/District',
  'Declined School/District',
]

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const OWNERS: Owner[] = ['Annie', 'Sam', 'Gab']
const REGIONS = ['Bay Area', 'DC', 'LA', 'National', 'NY']
const ENGAGEMENT_TYPES: EngagementType[] = ['High Level', 'Medium Level', 'Low Level']

const PRIORITY_COLORS: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  'High Level': 'bg-red-100 text-red-700',
  'Medium Level': 'bg-yellow-100 text-yellow-700',
  'Low Level': 'bg-green-100 text-green-700',
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function LinkCell({ url, label }: { url: string; label: string }) {
  if (!url) return <span className="text-gray-400">—</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs">
      {label} <ExternalLink size={10} />
    </a>
  )
}

type SortKey = keyof Account
type SortDir = 'asc' | 'desc'

export default function SchoolsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterEngagement, setFilterEngagement] = useState('')
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
        setAccounts(all.filter((a) => SCHOOL_TYPES.includes(a.type)))
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load schools')
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
          a.principal.toLowerCase().includes(q) ||
          a.goal.toLowerCase().includes(q) ||
          a.region.toLowerCase().includes(q)
      )
    }
    if (filterType) list = list.filter((a) => a.type === filterType)
    if (filterPriority) list = list.filter((a) => a.priority === filterPriority)
    if (filterOwner) list = list.filter((a) => a.owner === filterOwner)
    if (filterRegion) list = list.filter((a) => a.region === filterRegion)
    if (filterEngagement) list = list.filter((a) => a.engagementType === filterEngagement)
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [accounts, search, filterType, filterPriority, filterOwner, filterRegion, filterEngagement, sortKey, sortDir])

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
    const headers: (keyof Account)[] = ['name', 'type', 'region', 'priority', 'owner', 'goal', 'principal', 'engagementType', 'partnerDashboardLink', 'partnerEnrollmentToolkit', 'googleDriveFile', 'midpointDate', 'boyData', 'moyData', 'eoyData', 'assessmentName', 'mathCurriculum', 'elaCurriculum', 'lastContactDate', 'nextFollowUpDate', 'nextAction', 'notes']
    const rows = filtered.map((a) => headers.map((h) => `"${String(a[h] || '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'schools.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = search || filterType || filterPriority || filterOwner || filterRegion || filterEngagement

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
          <h1 className="text-2xl font-bold text-gray-900">Schools / Districts</h1>
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
            placeholder="Search schools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Types</option>
          {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterEngagement} onChange={(e) => setFilterEngagement(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Engagement Levels</option>
          {ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
            onClick={() => { setSearch(''); setFilterType(''); setFilterPriority(''); setFilterOwner(''); setFilterRegion(''); setFilterEngagement('') }}
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
          <div className="p-8 text-center text-sm text-gray-400">No schools found.</div>
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
                      ['goal', 'Goal'],
                      ['principal', 'Principal'],
                      ['engagementType', 'Engagement'],
                      ['midpointDate', 'Midpoint Date'],
                      ['boyData', 'BOY'],
                      ['moyData', 'MOY'],
                      ['eoyData', 'EOY'],
                      ['assessmentName', 'Assessment'],
                      ['mathCurriculum', 'Math Curriculum'],
                      ['elaCurriculum', 'ELA Curriculum'],
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Links</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => {
                  const overdue = a.nextFollowUpDate && a.nextFollowUpDate < today()
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{a.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{a.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.region || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>{a.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.owner}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{a.goal || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.principal || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {a.engagementType ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ENGAGEMENT_COLORS[a.engagementType] || 'bg-gray-100 text-gray-600'}`}>{a.engagementType}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(a.midpointDate)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.boyData || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.moyData || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.eoyData || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.assessmentName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.mathCurriculum || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.elaCurriculum || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(a.lastContactDate)}</td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(a.nextFollowUpDate)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{a.nextAction || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <LinkCell url={a.partnerDashboardLink} label="Dashboard" />
                          <LinkCell url={a.partnerEnrollmentToolkit} label="Toolkit" />
                          <LinkCell url={a.googleDriveFile} label="Drive" />
                        </div>
                      </td>
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={`Edit School/District — ${editing?.name}`} size="xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name">
              <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </Field>
          </div>
          <Field label="Type">
            <select value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })} className={input}>
              {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
          <Field label="Goal">
            <input type="text" value={form.goal || ''} onChange={(e) => setForm({ ...form, goal: e.target.value })} className={input} placeholder="Goal" />
          </Field>
          <Field label="Principal">
            <input type="text" value={form.principal || ''} onChange={(e) => setForm({ ...form, principal: e.target.value })} className={input} placeholder="Principal name" />
          </Field>
          <Field label="Type of Engagement">
            <select value={form.engagementType || ''} onChange={(e) => setForm({ ...form, engagementType: e.target.value })} className={input}>
              <option value="">— Select —</option>
              {ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Midpoint Date">
            <input type="date" value={form.midpointDate || ''} onChange={(e) => setForm({ ...form, midpointDate: e.target.value })} className={input} />
          </Field>
          <Field label="Partner Dashboard Link">
            <input type="url" value={form.partnerDashboardLink || ''} onChange={(e) => setForm({ ...form, partnerDashboardLink: e.target.value })} className={input} placeholder="https://..." />
          </Field>
          <Field label="Partner Enrollment Toolkit">
            <input type="url" value={form.partnerEnrollmentToolkit || ''} onChange={(e) => setForm({ ...form, partnerEnrollmentToolkit: e.target.value })} className={input} placeholder="https://..." />
          </Field>
          <Field label="Google Drive File">
            <input type="url" value={form.googleDriveFile || ''} onChange={(e) => setForm({ ...form, googleDriveFile: e.target.value })} className={input} placeholder="https://..." />
          </Field>
          <Field label="Assessment Name">
            <input type="text" value={form.assessmentName || ''} onChange={(e) => setForm({ ...form, assessmentName: e.target.value })} className={input} placeholder="Assessment name" />
          </Field>
          <Field label="BOY Data">
            <input type="number" value={form.boyData || ''} onChange={(e) => setForm({ ...form, boyData: e.target.value })} className={input} placeholder="0" />
          </Field>
          <Field label="MOY Data">
            <input type="number" value={form.moyData || ''} onChange={(e) => setForm({ ...form, moyData: e.target.value })} className={input} placeholder="0" />
          </Field>
          <Field label="EOY Data">
            <input type="number" value={form.eoyData || ''} onChange={(e) => setForm({ ...form, eoyData: e.target.value })} className={input} placeholder="0" />
          </Field>
          <Field label="Math Curriculum">
            <input type="text" value={form.mathCurriculum || ''} onChange={(e) => setForm({ ...form, mathCurriculum: e.target.value })} className={input} placeholder="Math curriculum" />
          </Field>
          <Field label="ELA Curriculum">
            <input type="text" value={form.elaCurriculum || ''} onChange={(e) => setForm({ ...form, elaCurriculum: e.target.value })} className={input} placeholder="ELA curriculum" />
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
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete School/District" size="sm">
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
