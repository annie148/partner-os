'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Modal from '@/components/Modal'
import type { Region, Account, Task } from '@/types'
import { SCHOOL_TYPES } from '@/types'
import { MapPin, Plus } from 'lucide-react'
const FUNDER_TYPES = ['Prospective Funder', 'Current Funder', 'Former Funder', 'Declined Funder', 'Other - Funder']

function today() { return new Date().toISOString().split('T')[0] }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const EMPTY: Omit<Region, 'regionName'> & { regionName: string } = {
  regionName: '',
  regionGoalSY26: '',
  regionGoalSY27: '',
  currentStatus: '',
  openQuestions: '',
  nextMoves: '',
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Region>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/regions').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
    ]).then(([regs, accs, tsks]) => {
      setRegions(Array.isArray(regs) ? regs : [])
      setAccounts(Array.isArray(accs) ? accs : [])
      setTasks(Array.isArray(tsks) ? tsks : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!form.regionName.trim()) return
    setSaving(true)
    try {
      await fetch('/api/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setForm({ ...EMPTY })
      load()
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => {
    const todayStr = today()
    const map: Record<string, { funders: number; schools: number; openTasks: number; overdueTasks: number }> = {}
    for (const r of regions) {
      map[r.regionName] = { funders: 0, schools: 0, openTasks: 0, overdueTasks: 0 }
    }
    for (const a of accounts) {
      if (!a.region || !map[a.region]) continue
      if (FUNDER_TYPES.includes(a.type)) map[a.region].funders++
      else if (SCHOOL_TYPES.includes(a.type)) map[a.region].schools++
    }
    const accountRegion: Record<string, string> = {}
    for (const a of accounts) { accountRegion[a.id] = a.region || '' }
    for (const t of tasks) {
      const region = accountRegion[t.accountId] || ''
      if (!region || !map[region] || t.status === 'Complete') continue
      map[region].openTasks++
      if (t.dueDate && t.dueDate < todayStr) map[region].overdueTasks++
    }
    return map
  }, [regions, accounts, tasks])

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{regions.length} regions</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={14} /> Add Region
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map((r) => {
          const s = stats[r.regionName] || { funders: 0, schools: 0, openTasks: 0, overdueTasks: 0 }
          return (
            <Link
              key={r.regionName}
              href={`/regions/${encodeURIComponent(r.regionName)}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-indigo-500" />
                <h2 className="font-semibold text-gray-900">{r.regionName}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                <span>{s.funders} funders</span>
                <span>{s.schools} schools</span>
                <span>{s.openTasks} open tasks</span>
                {s.overdueTasks > 0 && <span className="text-red-600">{s.overdueTasks} overdue</span>}
              </div>
              {r.currentStatus && (
                <p className="text-xs text-gray-600 line-clamp-2">{r.currentStatus}</p>
              )}
            </Link>
          )
        })}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Region" size="lg">
        <div className="space-y-4">
          <Field label="Region Name *">
            <input type="text" value={form.regionName} onChange={(e) => setForm({ ...form, regionName: e.target.value })} className={input} placeholder="e.g. Pacific Northwest" />
          </Field>
          <Field label="Goal SY26">
            <textarea value={form.regionGoalSY26} onChange={(e) => setForm({ ...form, regionGoalSY26: e.target.value })} className={`${input} resize-none`} rows={2} />
          </Field>
          <Field label="Goal SY27">
            <textarea value={form.regionGoalSY27} onChange={(e) => setForm({ ...form, regionGoalSY27: e.target.value })} className={`${input} resize-none`} rows={2} />
          </Field>
          <Field label="Current Status">
            <textarea value={form.currentStatus} onChange={(e) => setForm({ ...form, currentStatus: e.target.value })} className={`${input} resize-none`} rows={2} />
          </Field>
          <Field label="Open Questions">
            <textarea value={form.openQuestions} onChange={(e) => setForm({ ...form, openQuestions: e.target.value })} className={`${input} resize-none`} rows={2} />
          </Field>
          <Field label="Next Moves">
            <textarea value={form.nextMoves} onChange={(e) => setForm({ ...form, nextMoves: e.target.value })} className={`${input} resize-none`} rows={2} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.regionName.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Region'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
