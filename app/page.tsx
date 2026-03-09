'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Account, Task } from '@/types'
import { AlertCircle, Clock, CalendarDays, Users, RefreshCw } from 'lucide-react'

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

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
    ]).then(([accs, tsks]) => {
      setAccounts(Array.isArray(accs) ? accs : [])
      setTasks(Array.isArray(tsks) ? tsks : [])
      setLoading(false)
    })
  }, [])

  const todayStr = today()
  const weekEnd = endOfWeek()

  const overdueFollowUps = accounts.filter(
    (a) => a.nextFollowUpDate && a.nextFollowUpDate < todayStr
  )
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'Complete'
  )
  const dueThisWeek = tasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate >= todayStr &&
      t.dueDate <= weekEnd &&
      t.status !== 'Complete'
  )

  const workload = (['Annie', 'Sam', 'Gab'] as const).map((name) => ({
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
        setSyncResult(`Synced ${data.synced} notes, ${data.skipped} skipped`)
        // Reload dashboard data
        Promise.all([
          fetch('/api/accounts').then((r) => r.json()),
          fetch('/api/tasks').then((r) => r.json()),
        ]).then(([accs, tsks]) => {
          setAccounts(Array.isArray(accs) ? accs : [])
          setTasks(Array.isArray(tsks) ? tsks : [])
        })
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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
        <p className={`text-xs mb-2 ${syncResult.startsWith('Error') || syncResult.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
          {syncResult}
        </p>
      )}
      <p className="text-sm text-gray-500 mb-8">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<AlertCircle size={20} className="text-red-600" />}
          label="Overdue Follow-ups"
          count={overdueFollowUps.length}
          color="bg-red-50"
        />
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
          count={accounts.length}
          color="bg-indigo-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Follow-ups */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Overdue Follow-ups</h2>
            <Link href="/accounts" className="text-xs text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {overdueFollowUps.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">All caught up!</p>
            )}
            {overdueFollowUps.slice(0, 8).map((a) => (
              <div key={a.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.owner} · {a.region || 'No region'}
                    </p>
                  </div>
                  <span className="text-xs text-red-600 font-medium whitespace-nowrap shrink-0">
                    {formatDate(a.nextFollowUpDate)}
                  </span>
                </div>
                {a.nextAction && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{a.nextAction}</p>
                )}
              </div>
            ))}
          </div>
        </div>

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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">
                      {t.assignee} · {t.accountName}
                    </p>
                  </div>
                  <span className="text-xs text-red-600 font-medium whitespace-nowrap shrink-0">
                    {formatDate(t.dueDate)}
                  </span>
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
                <div
                  key={t.id}
                  className="px-5 py-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">
                      {t.assignee} · {t.accountName}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium whitespace-nowrap shrink-0">
                    {formatDate(t.dueDate)}
                  </span>
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
