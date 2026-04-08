'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import EditableCell from '@/components/EditableCell'
import NotesDisplay from '@/components/NotesDisplay'
import ColumnToggle from '@/components/ColumnToggle'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { useColumnResize } from '@/hooks/useColumnResize'
import type { Region, Account, Task, TaskStatus, Activity } from '@/types'
import { SCHOOL_TYPES } from '@/types'
import ActivityLog from '@/components/ActivityLog'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  'High Level': 'bg-red-100 text-red-700',
  'Medium Level': 'bg-yellow-100 text-yellow-700',
  'Low Level': 'bg-green-100 text-green-700',
}

const LEVEL_COLORS: Record<string, string> = {
  District: 'bg-blue-100 text-blue-700',
  CMO: 'bg-orange-100 text-orange-700',
  School: 'bg-gray-100 text-gray-600',
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

const FUNDER_TYPES = ['Prospective Funder', 'Current Funder', 'Former Funder', 'Declined Funder', 'Other - Funder']

const FUNDER_COLUMNS: [string, string][] = [
  ['name', 'Name'],
  ['type', 'Type'],
  ['priority', 'Priority'],
  ['owner', 'Owner'],
  ['lastContactDate', 'Last Contact'],
  ['askStatus', 'Ask Status'],
  ['target', 'Target'],
  ['committedAmount', 'Committed'],
  ['nextFollowUpDate', 'Next Follow-up'],
  ['nextAction', 'Next Action'],
]

const SCHOOL_COLUMNS: [string, string][] = [
  ['name', 'Name'],
  ['accountLevel', 'Level'],
  ['type', 'Type'],
  ['priority', 'Priority'],
  ['owner', 'Owner'],
  ['engagementType', 'Engagement'],
  ['principal', 'Principal'],
  ['lastContactDate', 'Last Contact'],
  ['nextFollowUpDate', 'Next Follow-up'],
  ['nextAction', 'Next Action'],
]

const FUNDER_DEFAULT_HIDDEN = ['askStatus', 'target', 'committedAmount', 'nextFollowUpDate', 'nextAction']
const SCHOOL_DEFAULT_HIDDEN = ['principal', 'lastContactDate', 'nextFollowUpDate', 'nextAction']

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function formatCurrency(val: string) {
  if (!val) return '—'
  const num = parseFloat(val)
  if (isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function useCollapse(key: string) {
  const storageKey = `partner-os-collapse-${key}`
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
  })
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(storageKey, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])
  return { collapsed, toggle }
}

function renderFunderCell(a: Account, key: string) {
  switch (key) {
    case 'name': return <Link href={`/accounts/funders/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.name}</Link>
    case 'type': return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{a.type}</span>
    case 'priority': return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>{a.priority}</span>
    case 'owner': return <span className="text-gray-600">{a.owner}</span>
    case 'lastContactDate': return <span className="text-gray-600">{formatDate(a.lastContactDate)}</span>
    case 'askStatus': return a.askStatus ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ASK_STATUS_COLORS[a.askStatus] || 'bg-gray-100 text-gray-600'}`}>{a.askStatus}</span> : <span className="text-gray-400">—</span>
    case 'target': return <span className="text-gray-600">{formatCurrency(a.target)}</span>
    case 'committedAmount': return <span className="text-gray-600">{formatCurrency(a.committedAmount)}</span>
    case 'nextFollowUpDate': return <span className="text-gray-600">{formatDate(a.nextFollowUpDate)}</span>
    case 'nextAction': return <span className="text-gray-600">{a.nextAction || '—'}</span>
    default: return <span className="text-gray-400">—</span>
  }
}

function renderSchoolCell(a: Account, key: string) {
  switch (key) {
    case 'name': return <Link href={`/accounts/schools/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.name}</Link>
    case 'accountLevel': return a.accountLevel ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[a.accountLevel] || 'bg-gray-100 text-gray-600'}`}>{a.accountLevel}</span> : <span className="text-gray-400">—</span>
    case 'type': return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{a.type}</span>
    case 'priority': return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[a.priority] || ''}`}>{a.priority}</span>
    case 'owner': return <span className="text-gray-600">{a.owner}</span>
    case 'engagementType': return a.engagementType ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ENGAGEMENT_COLORS[a.engagementType] || 'bg-gray-100 text-gray-600'}`}>{a.engagementType}</span> : <span className="text-gray-400">—</span>
    case 'principal': return <span className="text-gray-600">{a.principal || '—'}</span>
    case 'lastContactDate': return <span className="text-gray-600">{formatDate(a.lastContactDate)}</span>
    case 'nextFollowUpDate': return <span className="text-gray-600">{formatDate(a.nextFollowUpDate)}</span>
    case 'nextAction': return <span className="text-gray-600">{a.nextAction || '—'}</span>
    default: return <span className="text-gray-400">—</span>
  }
}

export default function RegionDetailPage() {
  const { name } = useParams<{ name: string }>()
  const regionName = decodeURIComponent(name)
  const [region, setRegion] = useState<Region | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const funderVis = useColumnVisibility('region-funders', FUNDER_DEFAULT_HIDDEN)
  const schoolVis = useColumnVisibility('region-schools', SCHOOL_DEFAULT_HIDDEN)
  const funderResize = useColumnResize(FUNDER_COLUMNS.length, 130)
  const schoolResize = useColumnResize(SCHOOL_COLUMNS.length, 130)

  const funderCollapse = useCollapse(`region-${regionName}-funders`)
  const schoolCollapse = useCollapse(`region-${regionName}-schools`)
  const taskCollapse = useCollapse(`region-${regionName}-tasks`)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/regions').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/activities').then((r) => r.json()),
    ]).then(([regions, accs, tsks, acts]) => {
      const reg = (Array.isArray(regions) ? regions : []).find((r: Region) => r.regionName === regionName)
      setRegion(reg || { regionName, regionGoalSY26: '', regionGoalSY27: '', currentStatus: '', openQuestions: '', nextMoves: '' })
      setAccounts(Array.isArray(accs) ? accs : [])
      setTasks(Array.isArray(tsks) ? tsks : [])
      setActivities((Array.isArray(acts) ? acts : []).filter((a: Activity) => a.accountId === regionName))
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [regionName])

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function saveField(field: keyof Region, value: string) {
    if (!region) return
    const prev = region
    const updated = { ...region, [field]: value }
    setRegion(updated)
    fetch(`/api/regions/${encodeURIComponent(regionName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {
      setRegion(prev)
      setToast('Failed to save. Please try again.')
    })
  }

  const regionAccounts = useMemo(() => accounts.filter((a) => a.region === regionName), [accounts, regionName])
  const funders = useMemo(() => regionAccounts.filter((a) => FUNDER_TYPES.includes(a.type)), [regionAccounts])
  const schools = useMemo(() => regionAccounts.filter((a) => SCHOOL_TYPES.includes(a.type)), [regionAccounts])

  const accountIds = useMemo(() => new Set(regionAccounts.map((a) => a.id)), [regionAccounts])
  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {}
    regionAccounts.forEach((a) => { map[a.id] = a.name })
    return map
  }, [regionAccounts])
  const regionTasks = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== 'Complete')
    return openTasks
      .filter((t) => t.region === regionName || accountIds.has(t.accountId))
      .map((t) => {
        const direct = t.region === regionName
        const viaAccount = accountIds.has(t.accountId)
        let source: string
        if (direct && viaAccount) source = 'direct'
        else if (direct) source = 'direct'
        else source = `via ${accountNameById[t.accountId] || t.accountName}`
        return { ...t, source }
      })
  }, [tasks, accountIds, accountNameById, regionName])

  async function completeTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const prevTasks = tasks
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'Complete' as TaskStatus } : t))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: 'Complete' }),
      })
      if (!res.ok) { setTasks(prevTasks); setToast('Failed to complete task. Please try again.') }
    } catch { setTasks(prevTasks); setToast('Failed to complete task. Please try again.') }
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>

  const todayStr = today()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/regions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Regions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{regionName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {regionAccounts.length} accounts · {funders.length} funders · {schools.length} schools
        </p>
      </div>

      {/* Region Info — full width */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Region Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Goal SY26</p>
            <EditableCell value={region?.regionGoalSY26 || ''} fieldType="textarea" onSave={(v) => saveField('regionGoalSY26', v)}>
              {region?.regionGoalSY26 ? <NotesDisplay text={region.regionGoalSY26} /> : <p className="text-sm text-gray-400">—</p>}
            </EditableCell>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Goal SY27</p>
            <EditableCell value={region?.regionGoalSY27 || ''} fieldType="textarea" onSave={(v) => saveField('regionGoalSY27', v)}>
              {region?.regionGoalSY27 ? <NotesDisplay text={region.regionGoalSY27} /> : <p className="text-sm text-gray-400">—</p>}
            </EditableCell>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current Status</p>
            <EditableCell value={region?.currentStatus || ''} fieldType="textarea" onSave={(v) => saveField('currentStatus', v)}>
              {region?.currentStatus ? <NotesDisplay text={region.currentStatus} /> : <p className="text-sm text-gray-400">—</p>}
            </EditableCell>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Open Questions</p>
            <EditableCell value={region?.openQuestions || ''} fieldType="textarea" onSave={(v) => saveField('openQuestions', v)}>
              {region?.openQuestions ? <NotesDisplay text={region.openQuestions} /> : <p className="text-sm text-gray-400">—</p>}
            </EditableCell>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Next Moves</p>
            <EditableCell value={region?.nextMoves || ''} fieldType="textarea" onSave={(v) => saveField('nextMoves', v)}>
              {region?.nextMoves ? <NotesDisplay text={region.nextMoves} /> : <p className="text-sm text-gray-400">—</p>}
            </EditableCell>
          </div>
        </div>
      </div>

      {/* Funders + Schools side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funders */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <button onClick={funderCollapse.toggle} className="flex items-center gap-1.5">
              {funderCollapse.collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              <h2 className="font-semibold text-gray-900 text-sm">Funders ({funders.length})</h2>
            </button>
            {!funderCollapse.collapsed && (
              <ColumnToggle
                columns={FUNDER_COLUMNS.map(([key, label]) => ({ key, label }))}
                hiddenKeys={funderVis.hiddenKeys}
                onToggle={funderVis.toggle}
                alwaysVisible={['name']}
              />
            )}
          </div>
          {!funderCollapse.collapsed && (
            funders.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No funders in this region.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {FUNDER_COLUMNS.map(([key, label], i) => funderVis.isVisible(key) && (
                        <th
                          key={key}
                          style={{ width: funderResize.widths[i], minWidth: funderResize.widths[i] }}
                          className="relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {label}
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); funderResize.onMouseDown(i, e) }}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {funders.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        {FUNDER_COLUMNS.map(([key], i) => funderVis.isVisible(key) && (
                          <td
                            key={key}
                            style={{ width: funderResize.widths[i], minWidth: funderResize.widths[i], maxWidth: funderResize.widths[i] }}
                            className="px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            {renderFunderCell(a, key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Schools/Districts */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <button onClick={schoolCollapse.toggle} className="flex items-center gap-1.5">
              {schoolCollapse.collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              <h2 className="font-semibold text-gray-900 text-sm">Schools / Districts ({schools.length})</h2>
            </button>
            {!schoolCollapse.collapsed && (
              <ColumnToggle
                columns={SCHOOL_COLUMNS.map(([key, label]) => ({ key, label }))}
                hiddenKeys={schoolVis.hiddenKeys}
                onToggle={schoolVis.toggle}
                alwaysVisible={['name']}
              />
            )}
          </div>
          {!schoolCollapse.collapsed && (
            schools.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No schools in this region.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {SCHOOL_COLUMNS.map(([key, label], i) => schoolVis.isVisible(key) && (
                        <th
                          key={key}
                          style={{ width: schoolResize.widths[i], minWidth: schoolResize.widths[i] }}
                          className="relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {label}
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); schoolResize.onMouseDown(i, e) }}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schools.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        {SCHOOL_COLUMNS.map(([key], i) => schoolVis.isVisible(key) && (
                          <td
                            key={key}
                            style={{ width: schoolResize.widths[i], minWidth: schoolResize.widths[i], maxWidth: schoolResize.widths[i] }}
                            className="px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            {renderSchoolCell(a, key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Tasks — full width below */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <button onClick={taskCollapse.toggle} className="flex items-center gap-1.5">
            {taskCollapse.collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            <h2 className="font-semibold text-gray-900 text-sm">Open Tasks ({regionTasks.length})</h2>
          </button>
        </div>
        {!taskCollapse.collapsed && (
          regionTasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No open tasks in this region.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {regionTasks.map((t) => {
                const overdue = t.dueDate && t.dueDate < todayStr
                return (
                  <div key={t.id} className="px-5 py-3 flex items-start gap-2">
                    <button
                      onClick={() => completeTask(t.id)}
                      className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-green-400 hover:bg-green-50 flex items-center justify-center shrink-0 transition-colors"
                      title="Mark complete"
                    />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/tasks/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline truncate block">{t.title}</Link>
                        <p className="text-xs text-gray-500">
                          {t.assignee} · {t.accountName}
                          {' · '}
                          <span className={t.source === 'direct' ? 'text-indigo-500' : 'text-gray-400'}>
                            {t.source}
                          </span>
                        </p>
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap shrink-0 ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatDate(t.dueDate)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Activity Log */}
      <ActivityLog
        activities={activities}
        accountId={regionName}
        defaultLoggedBy=""
        onAdd={async (activity) => {
          await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activity),
          })
          load()
        }}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  )
}
