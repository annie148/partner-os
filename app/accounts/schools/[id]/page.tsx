'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Modal from '@/components/Modal'
import EditableCell from '@/components/EditableCell'
import NotesDisplay from '@/components/NotesDisplay'
import type { Account, Contact, Task, Activity, TaskStatus, Owner, Priority, EngagementType } from '@/types'
import ActivityLog from '@/components/ActivityLog'
import { SCHOOL_TYPES } from '@/types'
import { ArrowLeft, Plus, Pencil, Trash2, Mail, Phone, ExternalLink, Check, ChevronRight, ChevronDown } from 'lucide-react'

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Blocked: 'bg-orange-100 text-orange-700',
  Complete: 'bg-green-100 text-green-700',
}

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

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const OWNERS: Owner[] = ['Annie', 'Genesis', 'Sam', 'Gab', 'Krissy']
const TASK_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Complete']
const ENGAGEMENT_TYPES: EngagementType[] = ['High Level', 'Medium Level', 'Low Level']
const OBC_STATUSES = ['Complete', 'In Progress', 'Not Started', 'N/A']
const DSA_STATUSES = ['Signed', 'Sent', 'In Progress', 'Not Started', 'N/A']
const MOU_STATUSES = ['Signed', 'Sent', 'In Progress', 'Not Started', 'N/A']
const MATH_CURRICULA = ['Eureka Math', 'iReady', 'Illustrative Mathematics', 'enVision', 'HMH Into Math', 'Saxon Math', 'Other']
const ELA_CURRICULA = ['EL Education', 'Amplify', 'CKLA', 'Wonders', 'Bookworms', 'HMH Into Reading', 'Other']

const EMPTY_CONTACT: Omit<Contact, 'id'> = {
  accountId: '',
  accountName: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  notes: '',
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  )
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [account, setAccount] = useState<Account | null>(null)
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<Omit<Contact, 'id'>>(EMPTY_CONTACT)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/activities').then((r) => r.json()),
      fetch('/api/regions').then((r) => r.json()),
    ]).then(([accountData, allContacts, allTasks, allActivities, regionData]) => {
      const accounts: Account[] = Array.isArray(accountData) ? accountData : []
      setAllAccounts(accounts)
      const acc = accounts.find((a) => a.id === id)
      setAccount(acc || null)
      setContacts((Array.isArray(allContacts) ? allContacts : []).filter((c: Contact) => c.accountId === id))
      setTasks((Array.isArray(allTasks) ? allTasks : []).filter((t: Task) => t.accountId === id))
      setActivities((Array.isArray(allActivities) ? allActivities : []).filter((a: Activity) => a.accountId === id))
      setRegions((Array.isArray(regionData) ? regionData : []).map((r: { regionName: string }) => r.regionName).sort())
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_CONTACT, accountId: id, accountName: account?.name || '' })
    setShowForm(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ accountId: c.accountId, accountName: c.accountName, name: c.name, email: c.email, phone: c.phone, role: c.role, notes: c.notes })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/contacts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, id: editing.id }),
        })
      } else {
        await fetch('/api/contacts', {
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
    await fetch(`/api/contacts/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    load()
  }

  async function saveField(field: keyof Account, value: string) {
    if (!account) return
    const prev = account
    const updated = { ...account, [field]: value }
    setAccount(updated)
    fetch(`/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .catch(() => { setAccount(prev); setToast('Failed to save. Please try again.') })
  }

  async function saveAccountField(acc: Account, field: keyof Account, value: string) {
    const prevAccounts = allAccounts
    const updated = { ...acc, [field]: value }
    setAllAccounts(allAccounts.map((a) => a.id === acc.id ? updated : a))
    fetch(`/api/accounts/${acc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .catch(() => { setAllAccounts(prevAccounts); setToast('Failed to save. Please try again.') })
  }

  async function toggleTaskComplete(task: Task) {
    const prevTasks = tasks
    const newStatus: TaskStatus = task.status === 'Complete' ? 'Not Started' : 'Complete'
    const updatedTask = { ...task, status: newStatus }
    setTasks(tasks.map((t) => t.id === task.id ? updatedTask : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      })
      if (!res.ok) { setTasks(prevTasks); setToast('Failed to update task. Please try again.') }
    } catch { setTasks(prevTasks); setToast('Failed to update task. Please try again.') }
  }

  async function saveTaskField(task: Task, field: keyof Task, value: string) {
    const prevTasks = tasks
    const updatedTask = { ...task, [field]: value }
    setTasks(tasks.map((t) => t.id === task.id ? updatedTask : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      })
      if (!res.ok) { setTasks(prevTasks); setToast('Failed to save task. Please try again.') }
    } catch { setTasks(prevTasks); setToast('Failed to save task. Please try again.') }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">School not found.</p>
        <Link href="/accounts/schools" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
          ← Back to Schools
        </Link>
      </div>
    )
  }

  const todayStr = today()

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/accounts/schools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Schools
        </Link>
        <EditableCell value={account.name} onSave={(v) => saveField('name', v)}>
          <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
        </EditableCell>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <EditableCell value={account.type} fieldType="select" options={[...SCHOOL_TYPES]} onSave={(v) => saveField('type', v)}>
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {account.type}
            </span>
          </EditableCell>
          <EditableCell value={account.region} fieldType="select" options={regions} onSave={(v) => saveField('region', v)}>
            <span className="text-sm text-gray-500">{account.region || '— Region —'}</span>
          </EditableCell>
          <EditableCell value={account.priority} fieldType="select" options={PRIORITIES} onSave={(v) => saveField('priority', v)}>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[account.priority] || 'bg-gray-100 text-gray-600'}`}>
              {account.priority ? `${account.priority} Priority` : '— Priority —'}
            </span>
          </EditableCell>
          <span className="text-sm text-gray-500">Owner:</span>
          <EditableCell value={account.owner} fieldType="select" options={OWNERS} onSave={(v) => saveField('owner', v)}>
            <span className="text-sm text-gray-700 font-medium">{account.owner || '—'}</span>
          </EditableCell>
        </div>
      </div>

      {/* Parent District */}
      {(() => {
        const parentDistrict = account.parentDistrictId ? allAccounts.find((a) => a.id === account.parentDistrictId) : null
        const districtOptions = allAccounts.filter((a) => (a.accountLevel === 'District' || a.accountLevel === 'CMO') && a.id !== account.id).sort((a, b) => a.name.localeCompare(b.name))
        return (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <span className="text-gray-500 font-medium">Parent District:</span>
            {parentDistrict && (
              <Link href={`/accounts/schools/${parentDistrict.id}`} className="text-indigo-600 hover:underline font-medium">
                {parentDistrict.name}
              </Link>
            )}
            <select
              value={account.parentDistrictId || ''}
              onChange={(e) => saveField('parentDistrictId', e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— None —</option>
              {districtOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )
      })()}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Contact</p>
          <EditableCell value={account.lastContactDate} fieldType="date" onSave={(v) => saveField('lastContactDate', v)}>
            <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(account.lastContactDate)}</p>
          </EditableCell>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Follow-up</p>
          <EditableCell value={account.nextFollowUpDate} fieldType="date" onSave={(v) => saveField('nextFollowUpDate', v)}>
            <p className={`text-sm font-semibold mt-1 ${account.nextFollowUpDate && account.nextFollowUpDate < todayStr ? 'text-red-600' : 'text-gray-900'}`}>
              {formatDate(account.nextFollowUpDate)}
            </p>
          </EditableCell>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contacts</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{contacts.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open Tasks</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{tasks.filter((t) => t.status !== 'Complete').length}</p>
        </div>
      </div>

      {/* Next Action — always shown, editable */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Next Action</p>
        <EditableCell value={account.nextAction} onSave={(v) => saveField('nextAction', v)}>
          <p className="text-sm text-amber-900 mt-1">{account.nextAction || '—'}</p>
        </EditableCell>
      </div>

      {/* Contacts */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Contacts ({contacts.length})</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={14} /> Add Contact
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        {contacts.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No contacts for this school yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Name', 'Role', 'Email', 'Phone', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.role || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                        <Mail size={12} /> {c.email}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {c.phone ? (
                      <span className="inline-flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Child Schools (if this is a district) */}
      {(() => {
        const childSchools = allAccounts.filter((a) => a.parentDistrictId === account.id)
        if (childSchools.length === 0) return null
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Schools ({childSchools.length})</h2>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Name', 'Type', 'Region', 'Priority', 'Owner'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {childSchools.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/accounts/schools/${s.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">{s.name}</Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <EditableCell value={s.type} fieldType="select" options={[...SCHOOL_TYPES]} onSave={(v) => saveAccountField(s, 'type', v)}>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{s.type || '—'}</span>
                        </EditableCell>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.region || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <EditableCell value={s.priority} fieldType="select" options={PRIORITIES} onSave={(v) => saveAccountField(s, 'priority', v)}>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[s.priority] || 'bg-gray-100 text-gray-600'}`}>{s.priority || '—'}</span>
                        </EditableCell>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <EditableCell value={s.owner} fieldType="select" options={OWNERS} onSave={(v) => saveAccountField(s, 'owner', v)}>
                          <span className="text-gray-600">{s.owner || '—'}</span>
                        </EditableCell>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      })()}

      {/* School Info */}
      <Section title="School Info">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <EField label="Principal">
            <EditableCell value={account.principal} onSave={(v) => saveField('principal', v)}>
              <span className="text-sm text-gray-900">{account.principal || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="Goal">
            <EditableCell value={account.goal} onSave={(v) => saveField('goal', v)}>
              <span className="text-sm text-gray-900">{account.goal || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="District">
            <EditableCell value={account.district} onSave={(v) => saveField('district', v)}>
              <span className="text-sm text-gray-900">{account.district || '—'}</span>
            </EditableCell>
          </EField>
        </div>
      </Section>

      {/* Data Sharing & Assessment */}
      {(() => {
        const parent = account.parentDistrictId ? allAccounts.find((a) => a.id === account.parentDistrictId) : null
        const isDistrict = account.accountLevel === 'District' || account.accountLevel === 'CMO'
        const inheritFields: (keyof Account)[] = ['dsaStatus', 'mouStatus', 'dataReceived', 'matchedStudents', 'districtAssessmentMath', 'districtAssessmentReading', 'testWindow', 'assessmentFollowUpNotes']

        // For schools: show inherited values from parent if own value is empty
        const getVal = (field: keyof Account) => account[field] || ''
        const getDisplayVal = (field: keyof Account) => {
          const own = account[field] || ''
          if (own) return { value: own, inherited: false }
          if (parent && inheritFields.includes(field)) {
            const parentVal = parent[field] || ''
            if (parentVal) return { value: parentVal, inherited: true }
          }
          return { value: '', inherited: false }
        }

        const renderField = (field: keyof Account, label: string, opts?: { textarea?: boolean; fieldType?: 'select' | 'date'; options?: string[] }) => {
          const { value, inherited } = getDisplayVal(field)
          const ft = opts?.textarea ? 'textarea' as const : opts?.fieldType
          return (
            <EField label={label}>
              <EditableCell value={getVal(field)} fieldType={ft} options={opts?.options} onSave={(v) => saveField(field, v)}>
                {opts?.textarea ? (
                  <div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{value || '—'}</p>
                    {inherited && <p className="text-xs text-indigo-500 mt-0.5">(from {parent!.name})</p>}
                  </div>
                ) : (
                  <span className="text-sm text-gray-900">
                    {value ? (opts?.fieldType === 'date' ? formatDate(value) : value) : '—'}
                    {inherited && <span className="text-xs text-indigo-500 ml-1">(from {parent!.name})</span>}
                  </span>
                )}
              </EditableCell>
            </EField>
          )
        }

        // Show section if account is District/CMO, or if it has a parent, or if it has any of these fields set
        const hasData = inheritFields.some((f) => account[f])
        if (!isDistrict && !parent && !hasData) return null

        return (
          <Section title="Data Sharing &amp; Assessment">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {renderField('dsaStatus', 'DSA Status', { fieldType: 'select', options: DSA_STATUSES })}
              {renderField('mouStatus', 'MOU Status', { fieldType: 'select', options: MOU_STATUSES })}
              {renderField('dataReceived', 'Data Received')}
              {renderField('matchedStudents', 'Matched Students')}
              {renderField('testWindow', 'Test Window')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {renderField('districtAssessmentMath', 'District Assessment (Math)', { textarea: true })}
              {renderField('districtAssessmentReading', 'District Assessment (Reading)', { textarea: true })}
            </div>
            <div className="mt-5">
              {renderField('assessmentFollowUpNotes', 'Assessment Follow Up Notes', { textarea: true })}
            </div>
          </Section>
        )
      })()}

      {/* Partnership Details */}
      <Section title="Partnership">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <EField label="Engagement Level">
            <EditableCell value={account.engagementType} fieldType="select" options={ENGAGEMENT_TYPES} onSave={(v) => saveField('engagementType', v)}>
              {account.engagementType ? (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ENGAGEMENT_COLORS[account.engagementType] || 'bg-gray-100 text-gray-600'}`}>
                  {account.engagementType}
                </span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </EditableCell>
          </EField>
          <EField label="OBC Status">
            <EditableCell value={account.obcStatus} fieldType="select" options={OBC_STATUSES} onSave={(v) => saveField('obcStatus', v)}>
              <span className="text-sm text-gray-900">{account.obcStatus || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="Contract Cap">
            <EditableCell value={account.contractCap} onSave={(v) => saveField('contractCap', v)}>
              <span className="text-sm text-gray-900">{account.contractCap || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="Partner Dashboard">
            <EditableCell value={account.partnerDashboardLink} onSave={(v) => saveField('partnerDashboardLink', v)}>
              {account.partnerDashboardLink ? (
                <a href={account.partnerDashboardLink} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </EditableCell>
          </EField>
          <EField label="Partner Enrollment Toolkit">
            <EditableCell value={account.partnerEnrollmentToolkit} onSave={(v) => saveField('partnerEnrollmentToolkit', v)}>
              {account.partnerEnrollmentToolkit ? (
                <a href={account.partnerEnrollmentToolkit} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </EditableCell>
          </EField>
          <EField label="Google Drive">
            <EditableCell value={account.googleDriveFile} onSave={(v) => saveField('googleDriveFile', v)}>
              {account.googleDriveFile ? (
                <a href={account.googleDriveFile} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </EditableCell>
          </EField>
        </div>
      </Section>

      {/* Assessment & Curriculum */}
      <Section title="Assessment & Curriculum">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <EField label="Assessment Name">
            <EditableCell value={account.assessmentName} onSave={(v) => saveField('assessmentName', v)}>
              <span className="text-sm text-gray-900">{account.assessmentName || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="DSA Status">
            <EditableCell value={account.dsaStatus} fieldType="select" options={DSA_STATUSES} onSave={(v) => saveField('dsaStatus', v)}>
              <span className="text-sm text-gray-900">{account.dsaStatus || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="Math Curriculum">
            <EditableCell value={account.mathCurriculum} fieldType="select" options={MATH_CURRICULA} onSave={(v) => saveField('mathCurriculum', v)}>
              <span className="text-sm text-gray-900">{account.mathCurriculum || '—'}</span>
            </EditableCell>
          </EField>
          <EField label="ELA Curriculum">
            <EditableCell value={account.elaCurriculum} fieldType="select" options={ELA_CURRICULA} onSave={(v) => saveField('elaCurriculum', v)}>
              <span className="text-sm text-gray-900">{account.elaCurriculum || '—'}</span>
            </EditableCell>
          </EField>
        </div>
      </Section>

      {/* Data */}
      <Section title="Data">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <EField label="BOY Data">
            <EditableCell value={account.boyData} fieldType="date" onSave={(v) => saveField('boyData', v)}>
              <span className="text-sm text-gray-900">{formatDate(account.boyData)}</span>
            </EditableCell>
          </EField>
          <EField label="MOY Data">
            <EditableCell value={account.moyData} fieldType="date" onSave={(v) => saveField('moyData', v)}>
              <span className="text-sm text-gray-900">{formatDate(account.moyData)}</span>
            </EditableCell>
          </EField>
          <EField label="EOY Data">
            <EditableCell value={account.eoyData} fieldType="date" onSave={(v) => saveField('eoyData', v)}>
              <span className="text-sm text-gray-900">{formatDate(account.eoyData)}</span>
            </EditableCell>
          </EField>
          <EField label="Midpoint Date">
            <EditableCell value={account.midpointDate} fieldType="date" onSave={(v) => saveField('midpointDate', v)}>
              <span className="text-sm text-gray-900">{formatDate(account.midpointDate)}</span>
            </EditableCell>
          </EField>
        </div>
      </Section>

      {/* Tasks */}
      {(() => {
        const openTasks = tasks.filter((t) => t.status !== 'Complete')
        const completedTasks = tasks.filter((t) => t.status === 'Complete')
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Tasks ({openTasks.length})</h2>
              <Link href="/tasks" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                View all tasks
              </Link>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              {openTasks.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No open tasks for this school.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 w-10" />
                      {['Title', 'Assignee', 'Due Date', 'Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {openTasks.map((t) => {
                      const overdue = t.dueDate && t.dueDate < todayStr
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleTaskComplete(t)}
                              className="w-5 h-5 rounded border border-gray-300 hover:border-indigo-400 flex items-center justify-center transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EditableCell value={t.title} onSave={(v) => saveTaskField(t, 'title', v)}>
                              <span className="font-medium text-gray-900">{t.title}</span>
                            </EditableCell>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EditableCell value={t.assignee} fieldType="select" options={OWNERS} onSave={(v) => saveTaskField(t, 'assignee', v)}>
                              <span className="text-gray-600">{t.assignee || '—'}</span>
                            </EditableCell>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EditableCell value={t.dueDate} fieldType="date" onSave={(v) => saveTaskField(t, 'dueDate', v)}>
                              <span className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(t.dueDate)}</span>
                            </EditableCell>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EditableCell value={t.status} fieldType="select" options={TASK_STATUSES} onSave={(v) => saveTaskField(t, 'status', v)}>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                                {t.status}
                              </span>
                            </EditableCell>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3"
                >
                  {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Completed Tasks ({completedTasks.length})
                </button>
                {showCompleted && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden opacity-75">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="px-4 py-3 w-10" />
                          {['Title', 'Assignee', 'Due Date'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/50">
                        {completedTasks.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-100/50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleTaskComplete(t)}
                                className="w-5 h-5 rounded border bg-green-500 border-green-500 text-white flex items-center justify-center transition-colors hover:bg-green-400"
                              >
                                <Check size={12} />
                              </button>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-400 line-through whitespace-nowrap">{t.title}</td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{t.assignee || '—'}</td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(t.dueDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}

      {/* Granola Notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Granola Notes</p>
        <EditableCell value={account.granolaNotesUrl} onSave={(v) => saveField('granolaNotesUrl', v)}>
          {account.granolaNotesUrl ? (
            <a href={account.granolaNotesUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline mt-1 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              View Meeting Notes <ExternalLink size={12} />
            </a>
          ) : (
            <p className="text-sm text-gray-400 mt-1">— Click to add URL —</p>
          )}
        </EditableCell>
      </div>

      {/* Notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</p>
        <EditableCell value={account.notes} fieldType="textarea" onSave={(v) => saveField('notes', v)}>
          {account.notes ? <NotesDisplay text={account.notes} className="mt-1" /> : <p className="text-sm text-gray-400 mt-1">—</p>}
        </EditableCell>
      </div>

      {/* Activity Log */}
      <ActivityLog
        activities={activities}
        accountId={account.id}
        defaultLoggedBy={account.owner}
        onAdd={async (activity) => {
          await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activity),
          })
          load()
        }}
      />

      {/* Add/Edit Contact Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Contact' : 'Add Contact'} size="md">
        <div className="space-y-4">
          <Field label="Name *">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Full name" />
          </Field>
          <Field label="Role">
            <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={input} placeholder="e.g. Program Officer" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} placeholder="email@example.com" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} placeholder="(555) 555-5555" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} rows={3} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Contact" size="sm">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  )
}
