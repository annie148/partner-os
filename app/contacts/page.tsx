'use client'

import { useEffect, useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import type { Contact, Account } from '@/types'
import Link from 'next/link'
import { Plus, Search, Pencil, Trash2, Link2, UserPlus } from 'lucide-react'

const EMPTY: Omit<Contact, 'id'> = {
  accountId: '',
  accountName: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  notes: '',
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterAccount, setFilterAccount] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<Omit<Contact, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [linking, setLinking] = useState(false)
  const [linkResult, setLinkResult] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ]).then(([c, a]) => {
      setContacts(Array.isArray(c) ? c : [])
      setAccounts(Array.isArray(a) ? a : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = contacts
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.accountName.toLowerCase().includes(q)
      )
    }
    if (filterAccount) list = list.filter((c) => c.accountId === filterAccount)
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [contacts, search, filterAccount])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ accountId: c.accountId, accountName: c.accountName, name: c.name, email: c.email, phone: c.phone, role: c.role, notes: c.notes })
    setShowForm(true)
  }

  function handleAccountChange(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    setForm({ ...form, accountId, accountName: acc?.name || '' })
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

  async function handleSeedFromAccounts() {
    setSeeding(true)
    setLinkResult(null)
    try {
      const res = await fetch('/api/contacts/seed-from-accounts', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setLinkResult(`Created ${data.created} contacts from account principals. ${data.skipped} already existed.`)
        load()
      } else {
        setLinkResult(`Error: ${data.error}`)
      }
    } catch (e) {
      setLinkResult(`Failed: ${String(e)}`)
    } finally {
      setSeeding(false)
    }
  }

  async function handleAutoLink() {
    setLinking(true)
    setLinkResult(null)
    try {
      const res = await fetch('/api/contacts/auto-link', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setLinkResult(`${data.linked} linked, ${data.alreadyLinked} already linked, ${data.unmatched} unmatched`)
        load()
      } else {
        setLinkResult(`Error: ${data.error}`)
      }
    } catch (e) {
      setLinkResult(`Failed: ${String(e)}`)
    } finally {
      setLinking(false)
    }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedFromAccounts}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            <UserPlus size={14} />
            {seeding ? 'Creating…' : 'Seed from Accounts'}
          </button>
          <button
            onClick={handleAutoLink}
            disabled={linking}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            <Link2 size={14} />
            {linking ? 'Linking…' : 'Auto-link to Accounts'}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {linkResult && (
        <p className={`text-xs mb-2 ${linkResult.startsWith('Error') || linkResult.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
          {linkResult}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(search || filterAccount) && (
          <button onClick={() => { setSearch(''); setFilterAccount('') }} className="text-sm text-gray-400 hover:text-gray-600 px-2">
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No contacts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Name', 'Account', 'Role', 'Email', 'Phone', 'Notes'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.accountId ? (
                        <Link href={`/accounts/${c.accountId}`} className="text-indigo-600 hover:underline">{c.accountName}</Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.role || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="text-indigo-600 hover:underline">{c.email}</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.phone || '—'}</td>
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
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Contact' : 'Add Contact'} size="md">
        <div className="space-y-4">
          <Field label="Name *">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Full name" autoFocus />
          </Field>
          <Field label="Account">
            <select value={form.accountId} onChange={(e) => handleAccountChange(e.target.value)} className={input}>
              <option value="">— No account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
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
