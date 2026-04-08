'use client'

import { useState, useRef, useEffect } from 'react'

type FieldType = 'text' | 'select' | 'date' | 'number' | 'textarea'

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
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(value)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, value])

  function flashSaved() {
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  async function save() {
    if (editValue === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(editValue)
      flashSaved()
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
        className="cursor-pointer min-h-[28px] rounded px-1.5 -mx-1.5 hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-300 transition-colors relative flex items-center gap-1 group"
      >
        {children}
        {justSaved ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium animate-fade-out whitespace-nowrap">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Saved
          </span>
        ) : (
          <svg className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        )}
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
          onSave(newVal).then(() => flashSaved()).finally(() => { setSaving(false); setEditing(false) })
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

  if (fieldType === 'textarea') {
    function autoResize(el: HTMLTextAreaElement) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
    return (
      <textarea
        ref={(el) => {
          (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
          if (el) requestAnimationFrame(() => autoResize(el))
        }}
        value={editValue}
        onChange={(e) => { setEditValue(e.target.value); autoResize(e.target) }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
        disabled={saving}
        rows={3}
        className={cls + ' resize-none overflow-hidden'}
      />
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
