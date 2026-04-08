'use client'

import { useState } from 'react'
import type { Activity, ActivityType } from '@/types'
import NotesDisplay from '@/components/NotesDisplay'
import { Plus } from 'lucide-react'

const ACTIVITY_TYPES: ActivityType[] = ['Call', 'Email', 'Meeting', 'Note', 'Other']

const TYPE_COLORS: Record<ActivityType, string> = {
  Call: 'bg-blue-100 text-blue-700',
  Email: 'bg-purple-100 text-purple-700',
  Meeting: 'bg-green-100 text-green-700',
  Note: 'bg-gray-100 text-gray-600',
  Other: 'bg-yellow-100 text-yellow-700',
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

interface ActivityLogProps {
  activities: Activity[]
  accountId: string
  defaultLoggedBy: string
  onAdd: (activity: Omit<Activity, 'id'>) => Promise<void>
}

export default function ActivityLog({ activities, accountId, defaultLoggedBy, onAdd }: ActivityLogProps) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [type, setType] = useState<ActivityType>('Note')
  const [description, setDescription] = useState('')
  const [loggedBy, setLoggedBy] = useState(defaultLoggedBy)

  const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date))

  async function handleSubmit() {
    if (!description.trim()) return
    setSaving(true)
    try {
      await onAdd({ accountId, date, type, description, loggedBy, sourceId: '' })
      setDescription('')
      setDate(today())
      setType('Note')
      setLoggedBy(defaultLoggedBy)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Activity Log</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={12} /> Add Activity
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as ActivityType)} className={input}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Logged By</label>
              <input type="text" value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} className={input} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} resize-none`}
              rows={3}
              placeholder="What happened?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !description.trim()}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400">No activity recorded yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map((a) => (
            <div key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span className="text-xs text-gray-500 w-20">{formatDate(a.date)}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[a.type] || TYPE_COLORS.Other}`}>
                    {a.type}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <NotesDisplay text={a.description} maxLines={2} />
                    {a.sourceId && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 shrink-0">synced</span>
                    )}
                  </div>
                  {a.loggedBy && <p className="text-xs text-gray-400 mt-0.5">{a.loggedBy}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
