'use client'

import { useState, useRef, useEffect } from 'react'

type FieldType = 'text' | 'select' | 'date' | 'number'

interface EditableCellProps {
  value: string
  fieldType?: FieldType
  options?: string[]
  onSave: (value: string) => Promise<void>
  children: React.ReactNode
}

export default function EditableCell({ value, fieldType = 'text', options, onSave, children }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(value)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, value])

  async function save() {
    if (editValue === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(editValue)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="cursor-pointer min-h-[20px] rounded px-1 -mx-1 hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 transition-colors"
      >
        {children}
      </div>
    )
  }

  const cls = 'w-full border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  if (fieldType === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={editValue}
        onChange={(e) => {
          const newVal = e.target.value
          setEditValue(newVal)
          setSaving(true)
          onSave(newVal).finally(() => { setSaving(false); setEditing(false) })
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className={cls}
      >
        <option value="">— None —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      disabled={saving}
      className={cls}
    />
  )
}
