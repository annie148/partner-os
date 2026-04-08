'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Account, Task } from '@/types'
import type { Owner } from '@/types'
import { Clock, CalendarDays, Users, RefreshCw, Check } from 'lucide-react'

const OWNERS: Owner[] = ['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy']

function today() {
  return new Date().toISOString().split('T')[0]
}

function endOfWeek() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function StatCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

const TYPE_BADGE: Record<string, string> = {
  'Follow-up': 'bg-purple-50 text-purple-700',
  Outreach: 'bg-sky-50 text-sky-700',
  Internal: 'bg-gray-100 text-gray-600',
  Other: 'bg-gray-50 text-gray-500',
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [filterOwner, setFilterOwner] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [regionNames, setRegionNames] = useState<string[]>([])

  function load() {
    // Fire follow-up task generation in the background
    fetch('/api/generate-followup-tasks', { method: 'POST' }).catch(() => {})

    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/regions').then((r) => r.json()),
    ]).then(([accs, tsks, regs]) => {
      setAccounts(Array.isArray(accs) ? accs : [])
      setTasks(Array.isArray(tsks) ? tsks : [])
      setRegionNames((Array.isArray(regs) ? regs : []).map((r: { regionName: string }) => r.regionName).sort())
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  async function completeTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: 'Complete' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Failed to complete task:', taskId, res.status, data)
        // Revert optimistic removal on failure
        setTasks((prev) => [...prev, task])
      }
    } catch (e) {
      console.error('Failed to complete task:', taskId, e)
      setTasks((prev) => [...prev, task])
    }
  }

  const todayStr = today()
  const weekEnd = endOfWeek()

  // Map account ID → region for task filtering
  const accountRegionMap: Record<string, string> = {}
  for (const a of accounts) { accountRegionMap[a.id] = a.region || '' }

  const matchesFilters = (owner: string, region: string) =>
    (!filterOwner || owner === filterOwner) && (!filterRegion || region === filterRegion)

  const taskRegion = (t: Task) => t.region || accountRegionMap[t.accountId] || ''

  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'Complete' && matchesFilters(t.assignee, taskRegion(t))
  )
  const dueThisWeek = tasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate >= todayStr &&
      t.dueDate <= weekEnd &&
      t.status !== 'Complete' &&
      matchesFilters(t.assignee, taskRegion(t))
  )

  const workload = (['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy'] as const).map((name) => ({
    name,
    total: tasks.filter((t) => t.assignee === name && t.status !== 'Complete').length,
    overdue: tasks.filter(
      (t) =>
        t.assignee === name && t.status !== 'Complete' && t.dueDate < todayStr
    ).length,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  async function handleGranolaSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/granola-sync', {
        method: 'POST',
        headers: { 'x-manual-trigger': 'true' },
      })
      const data = await res.json()
      if (res.ok) {
        const details = (data.results || [])
          .map((r: { title: string; status: string; matched: string | null; tasks: number; rawKeys?: string[] }) =>
            `• ${r.title}: ${r.status}${r.matched ? ` → ${r.matched}` : ''}${r.tasks ? ` (${r.tasks} tasks)` : ''}${r.rawKeys ? ` [keys: ${r.rawKeys.join(', ')}]` : ''}`
          )
          .join('\n')
        setSyncResult(
          `${data.totalNotes} notes found | ${data.synced} synced | ${data.skipped} already processed | ${data.noContent || 0} no content | ${data.noMatch || 0} no match` +
          (details ? '\n' + details : '')
        )
        load()
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
    } catch (e) {
      setSyncResult(`Failed: ${String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Owners</option>
            {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Regions</option>
            {regionNames.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          onClick={handleGranolaSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Granola'}
        </button>
      </div>
      {syncResult && (
        <pre className={`text-xs mb-2 whitespace-pre-wrap font-sans ${syncResult.startsWith('Error') || syncResult.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
          {syncResult}
        </pre>
      )}
      <p className="text-sm text-gray-500 mb-8">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Clock size={20} className="text-orange-600" />}
          label="Overdue Tasks"
          count={overdueTasks.length}
          color="bg-orange-50"
        />
        <StatCard
          icon={<CalendarDays size={20} className="text-blue-600" />}
          label="Due This Week"
          count={dueThisWeek.length}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Users size={20} className="text-indigo-600" />}
          label="Total Accounts"
          count={accounts.filter((a) => (!filterOwner || a.owner === filterOwner) && (!filterRegion || a.region === filterRegion)).length}
          color="bg-indigo-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Tasks */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Overdue Tasks</h2>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {overdueTasks.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">No overdue tasks!</p>
            )}
            {overdueTasks.slice(0, 8).map((t) => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => completeTask(t.id)}
                    className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-green-400 hover:bg-green-50 flex items-center justify-center shrink-0 transition-colors"
                    title="Mark complete"
                  />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                        {t.type && t.type !== 'Other' && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TYPE_BADGE[t.type] || TYPE_BADGE.Other}`}>
                            {t.type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {t.assignee} · {t.accountName}
                      </p>
                    </div>
                    <span className="text-xs text-red-600 font-medium whitespace-nowrap shrink-0">
                      {formatDate(t.dueDate)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Due This Week + Team Workload */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Due This Week</h2>
              <Link href="/tasks" className="text-xs text-indigo-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {dueThisWeek.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400">Nothing due this week.</p>
              )}
              {dueThisWeek.slice(0, 5).map((t) => (
                <div key={t.id} className="px-5 py-3 flex items-start gap-2">
                  <button
                    onClick={() => completeTask(t.id)}
                    className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-green-400 hover:bg-green-50 flex items-center justify-center shrink-0 transition-colors"
                    title="Mark complete"
                  />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                        {t.type && t.type !== 'Other' && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TYPE_BADGE[t.type] || TYPE_BADGE.Other}`}>
                            {t.type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {t.assignee} · {t.accountName}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium whitespace-nowrap shrink-0">
                      {formatDate(t.dueDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Team Workload</h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {workload.map(({ name, total, overdue }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{name}</span>
                    <span className="text-xs text-gray-500">
                      {total} open{overdue > 0 && `, ${overdue} overdue`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (total / Math.max(...workload.map((w) => w.total), 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
