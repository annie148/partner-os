'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Modal from '@/components/Modal'
import type { Account, Contact } from '@/types'
import { ArrowLeft, Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react'

const EMPTY_CONTACT: Omit<Contact, 'id'> = {
  accountId: '',
  accountName: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  notes: '',
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<Omit<Contact, 'id'>>(EMPTY_CONTACT)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/accounts`).then((r) => r.json()),
      fetch('/api/contacts').then((r) => r.json()),
    ]).then(([accounts, allC]) => {
      const acc = (Array.isArray(accounts) ? accounts : []).find((a: Account) => a.id === id)
      setAccount(acc || null)
      const contactList = Array.isArray(allC) ? allC : []
      setAllContacts(contactList)
      setContacts(contactList.filter((c: Contact) => c.accountId === id))
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

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Account not found.</p>
        <Link href="/accounts" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">← Back to Accounts</Link>
      </div>
    )
  }

  function formatDate(d: string) {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${m}/${day}/${y}`
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Accounts
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{account.type}</span>
              {account.region && <span className="text-sm text-gray-500">{account.region}</span>}
              <span className="text-sm text-gray-500">Owner: {account.owner}</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/accounts')}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Pencil size={14} className="inline mr-1.5" />
            Edit Account
          </button>
        </div>
      </div>

      {/* Account Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{account.priority}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Contact</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(account.lastContactDate)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Follow-up</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(account.nextFollowUpDate)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contacts</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{contacts.length}</p>
        </div>
      </div>

      {account.nextAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Next Action</p>
          <p className="text-sm text-amber-900 mt-1">{account.nextAction}</p>
        </div>
      )}

      {account.notes && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</p>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{account.notes}</p>
        </div>
      )}

      {/* Contacts Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Contacts ({contacts.length})</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={14} /> Add Contact
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No contacts for this account yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Name', 'Role', 'Email', 'Phone', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
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
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} /> {c.phone}
                      </span>
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

      {/* Add/Edit Contact Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Contact' : 'Add Contact'} size="md">
        <div className="space-y-4">
          <Field label="Name *">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Full name" autoFocus />
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
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Contact'}
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
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
