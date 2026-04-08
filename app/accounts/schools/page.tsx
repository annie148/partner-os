'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Modal from '@/components/Modal'
import EditableCell from '@/components/EditableCell'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import ColumnToggle from '@/components/ColumnToggle'
import type { Account, AccountType, Priority, Owner, EngagementType, Contact } from '@/types'
import { SCHOOL_TYPES } from '@/types'
import Link from 'next/link'
import {
  Plus,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const OWNERS: Owner[] = ['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy']
// Regions loaded dynamically
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
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

export default function SchoolsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}>
      <SchoolsPage />
    </Suspense>
  )
}

function SchoolsPage() {
  const searchParams = useSearchParams()
  const levelParam = searchParams.get('level') // 'School' | 'District' | null (all)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [regions, setRegions] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<Partial<Account>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/regions').then((r) => r.json()),
    ])
      .then(([accountData, contactData, regionData]) => {
        const all: Account[] = Array.isArray(accountData) ? accountData : []
        setAllAccounts(all)
        let schoolAccounts = all.filter((a) => SCHOOL_TYPES.includes(a.type))
        if (levelParam) {
          schoolAccounts = schoolAccounts.filter((a) =>
            levelParam === 'District'
              ? a.accountLevel === 'District' || a.accountLevel === 'CMO'
              : a.accountLevel === levelParam
          )
        }
        setAccounts(schoolAccounts)
        setContacts(Array.isArray(contactData) ? contactData : [])
        setRegions((Array.isArray(regionData) ? regionData : []).map((r: { regionName: string }) => r.regionName).sort())
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load schools')
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [levelParam])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

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
    if (filterLevel) list = list.filter((a) => a.accountLevel === filterLevel)
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [accounts, search, filterType, filterPriority, filterOwner, filterRegion, filterLevel, sortKey, sortDir])

  const primaryContactMap = useMemo(() => {
    const map: Record<string, Contact> = {}
    for (const c of contacts) {
      if (c.accountId && !map[c.accountId]) {
        map[c.accountId] = c
      }
    }
    return map
  }, [contacts])

  // Map account ID → account for district lookups and inheritance
  const accountById = useMemo(() => {
    const map: Record<string, Account> = {}
    for (const a of allAccounts) { map[a.id] = a }
    return map
  }, [allAccounts])

  const districtNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of allAccounts) { map[a.id] = a.name }
    return map
  }, [allAccounts])

  // Districts available as parents: accounts with accountLevel District or CMO
  const districtOptions = useMemo(() => {
    return allAccounts
      .filter((a) => a.accountLevel === 'District' || a.accountLevel === 'CMO')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allAccounts])

  function toggleSort(key: string) {
    if (key.startsWith('_')) return
    const k = key as SortKey
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-indigo-500" />
    ) : (
      <ChevronDown size={12} className="text-indigo-500" />
    )
  }

  async function saveLevel(account: Account, newLevel: string) {
    const oldLevel = account.accountLevel
    const isDowngrade = (oldLevel === 'District' || oldLevel === 'CMO') && newLevel === 'School'
    if (isDowngrade) {
      const children = allAccounts.filter((a) => a.parentDistrictId === account.id)
      if (children.length > 0) {
        const names = children.slice(0, 5).map((c) => c.name).join(', ')
        const suffix = children.length > 5 ? `, and ${children.length - 5} more` : ''
        const ok = window.confirm(
          `${account.name} is the parent district for ${children.length} school(s): ${names}${suffix}.\n\nChanging to School will clear these parent links. Continue?`
        )
        if (!ok) return
        // Clear parentDistrictId on all children
        for (const child of children) {
          await fetch(`/api/accounts/${child.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...child, parentDistrictId: '' }),
          })
        }
      }
    }
    await saveField(account, 'accountLevel', newLevel)
  }

  async function saveField(account: Account, field: keyof Account, value: string) {
    const prev = accounts
    const updated = { ...account, [field]: value }
    setAccounts((cur) => cur.map((a) => (a.id === account.id ? updated : a)))
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      setAccounts(prev)
      setToast('Failed to save — reverted')
    }
  }

  function openAdd() {
    setEditing(null)
    setForm({ type: 'Prospective' as AccountType, priority: 'Medium', owner: 'Annie', ...(levelParam ? { accountLevel: levelParam as Account['accountLevel'] } : {}) })
    setShowForm(true)
  }

  function openEdit(a: Account) {
    setEditing(a)
    const { id, ...rest } = a
    setForm(rest)
    setShowForm(true)
  }

  async function handleSave() {
    if (!editing && !form.name?.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/accounts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editing, ...form }),
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

  const COLUMNS: [SortKey | '_contactName' | '_contactEmail' | '_district', string][] = [
    ['name', 'Name'],
    ['accountLevel', 'Level'],
    ['_district', 'District'],
    ['type', 'Type'],
    ['_contactName', 'Contact Name'],
    ['_contactEmail', 'Contact Email'],
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
    ['dsaStatus', 'DSA Status'],
    ['mouStatus', 'MOU Status'],
    ['dataReceived', 'Data Received'],
    ['matchedStudents', 'Matched Students'],
    ['districtAssessmentMath', 'Assessment (Math)'],
    ['districtAssessmentReading', 'Assessment (Reading)'],
  ]

  // +1 for the Links column
  const { widths, onMouseDown } = useColumnResize(COLUMNS.length + 1, 120)
  const { hiddenKeys, toggle: toggleColumn, isVisible } = useColumnVisibility('schools', [
    'dsaStatus', 'mouStatus', 'dataReceived', 'matchedStudents', 'districtAssessmentMath', 'districtAssessmentReading',
  ])

  const hasFilters = search || filterType || filterPriority || filterOwner || filterRegion || filterLevel

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {levelParam === 'School' ? 'Schools' : levelParam === 'District' ? 'Districts' : 'Schools / Districts'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
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
            <Plus size={14} /> Add School/District
          </button>
        </div>
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
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Levels</option>
          <option value="District">District</option>
          <option value="CMO">CMO</option>
          <option value="School">School</option>
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
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterPriority(''); setFilterOwner(''); setFilterRegion(''); setFilterLevel('') }}
            className="text-sm text-gray-400 hover:text-gray-600 px-2"
          >
            Clear filters
          </button>
        )}
        <ColumnToggle
          columns={[...COLUMNS.map(([key, label]) => ({ key, label })), { key: '_links', label: 'Links' }]}
          hiddenKeys={hiddenKeys}
          onToggle={toggleColumn}
          alwaysVisible={['name']}
        />
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
            <table className="text-sm" style={{ minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {COLUMNS.map(([key, label], i) => isVisible(key) && (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      style={{ width: widths[i], minWidth: widths[i] }}
                      className={`relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${
                        key === 'name' ? 'sticky left-0 z-10 bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
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
                  {isVisible('_links') && (
                    <th
                      style={{ width: widths[COLUMNS.length], minWidth: widths[COLUMNS.length] }}
                      className="relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      Links
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); onMouseDown(COLUMNS.length, e) }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => {
                  const overdue = a.nextFollowUpDate && a.nextFollowUpDate < today()
                  const pc = primaryContactMap[a.id]
                  const parentName = a.parentDistrictId ? districtNameMap[a.parentDistrictId] : ''
                  const levelColors: Record<string, string> = {
                    District: 'bg-blue-100 text-blue-700',
                    CMO: 'bg-orange-100 text-orange-700',
                    School: 'bg-gray-100 text-gray-600',
                  }
                  const cells = [
                    <Link href={`/accounts/schools/${a.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                      {a.name}
                    </Link>,
                    <EditableCell value={a.accountLevel || ''} fieldType="select" options={['District', 'CMO', 'School']} onSave={(v) => saveLevel(a, v)}>
                      {a.accountLevel ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[a.accountLevel] || 'bg-gray-100 text-gray-600'}`}>{a.accountLevel}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </EditableCell>,
                    parentName ? (
                      <Link href={`/accounts/schools/${a.parentDistrictId}`} className="text-indigo-600 hover:underline text-xs">{parentName}</Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    ),
                    <EditableCell value={a.type} fieldType="select" options={SCHOOL_TYPES} onSave={(v) => saveField(a, 'type', v)}>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{a.type}</span>
                    </EditableCell>,
                    <span className="text-gray-600">{pc?.name || '—'}</span>,
                    pc?.email ? (
                      <a href={`mailto:${pc.email}`} className="text-indigo-600 hover:underline">{pc.email}</a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    ),
                    <EditableCell value={a.region} fieldType="select" options={regions} onSave={(v) => saveField(a, 'region', v)}>
                      <span className="text-gray-600">{a.region || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.priority} fieldType="select" options={PRIORITIES} onSave={(v) => saveField(a, 'priority', v)}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>{a.priority}</span>
                    </EditableCell>,
                    <EditableCell value={a.owner} fieldType="select" options={OWNERS} onSave={(v) => saveField(a, 'owner', v)}>
                      <span className="text-gray-600">{a.owner}</span>
                    </EditableCell>,
                    <EditableCell value={a.goal} onSave={(v) => saveField(a, 'goal', v)}>
                      <span className="text-gray-600">{a.goal || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.principal} onSave={(v) => saveField(a, 'principal', v)}>
                      <span className="text-gray-600">{a.principal || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.engagementType} fieldType="select" options={ENGAGEMENT_TYPES} onSave={(v) => saveField(a, 'engagementType', v)}>
                      {a.engagementType ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ENGAGEMENT_COLORS[a.engagementType] || 'bg-gray-100 text-gray-600'}`}>{a.engagementType}</span> : <span>—</span>}
                    </EditableCell>,
                    <EditableCell value={a.midpointDate} fieldType="date" onSave={(v) => saveField(a, 'midpointDate', v)}>
                      <span className="text-gray-600">{formatDate(a.midpointDate)}</span>
                    </EditableCell>,
                    <EditableCell value={a.boyData} fieldType="number" onSave={(v) => saveField(a, 'boyData', v)}>
                      <span className="text-gray-600">{a.boyData || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.moyData} fieldType="number" onSave={(v) => saveField(a, 'moyData', v)}>
                      <span className="text-gray-600">{a.moyData || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.eoyData} fieldType="number" onSave={(v) => saveField(a, 'eoyData', v)}>
                      <span className="text-gray-600">{a.eoyData || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.assessmentName} onSave={(v) => saveField(a, 'assessmentName', v)}>
                      <span className="text-gray-600">{a.assessmentName || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.mathCurriculum} onSave={(v) => saveField(a, 'mathCurriculum', v)}>
                      <span className="text-gray-600">{a.mathCurriculum || '—'}</span>
                    </EditableCell>,
                    <EditableCell value={a.elaCurriculum} onSave={(v) => saveField(a, 'elaCurriculum', v)}>
                      <span className="text-gray-600">{a.elaCurriculum || '—'}</span>
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
                    ...(() => {
                      const parent = a.parentDistrictId ? accountById[a.parentDistrictId] : null
                      const inherit = (field: keyof Account) => a[field] || (parent ? parent[field] : '') || ''
                      return [
                        <span className="text-gray-600">{inherit('dsaStatus') || '—'}</span>,
                        <span className="text-gray-600">{inherit('mouStatus') || '—'}</span>,
                        <span className="text-gray-600">{inherit('dataReceived') || '—'}</span>,
                        <span className="text-gray-600">{inherit('matchedStudents') || '—'}</span>,
                        <span className="text-gray-600 text-xs">{inherit('districtAssessmentMath') || '—'}</span>,
                        <span className="text-gray-600 text-xs">{inherit('districtAssessmentReading') || '—'}</span>,
                      ]
                    })(),
                  ]
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 group">
                      {cells.map((cell, i) => isVisible(COLUMNS[i][0]) && (
                        <td
                          key={i}
                          style={{ width: widths[i], minWidth: widths[i], maxWidth: widths[i] }}
                          className={`px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap ${
                            COLUMNS[i][0] === 'name' ? 'sticky left-0 z-10 bg-white group-hover:bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                      {isVisible('_links') && (
                        <td
                          style={{ width: widths[COLUMNS.length], minWidth: widths[COLUMNS.length], maxWidth: widths[COLUMNS.length] }}
                          className="px-4 py-3 overflow-hidden whitespace-nowrap"
                        >
                          <div className="flex items-center gap-3">
                            <LinkCell url={a.partnerDashboardLink} label="Dashboard" />
                            <LinkCell url={a.partnerEnrollmentToolkit} label="Toolkit" />
                            <LinkCell url={a.googleDriveFile} label="Drive" />
                          </div>
                        </td>
                      )}
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit School/District — ${editing.name}` : 'Add School/District'} size="xl">
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
          <Field label="Level">
            <select value={form.accountLevel || ''} onChange={(e) => setForm({ ...form, accountLevel: e.target.value as Account['accountLevel'] })} className={input}>
              <option value="">— Select —</option>
              <option value="District">District</option>
              <option value="CMO">CMO</option>
              <option value="School">School</option>
            </select>
          </Field>
          <Field label="Region">
            <select value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className={input}>
              <option value="">— Select region —</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
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
          <Field label="Parent District">
            <select value={form.parentDistrictId || ''} onChange={(e) => setForm({ ...form, parentDistrictId: e.target.value })} className={input}>
              <option value="">— None —</option>
              {districtOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
          <button onClick={handleSave} disabled={saving || !form.name?.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add School/District'}
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

      {toast && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
