'use client'

import { useState, useRef, useEffect } from 'react'
import { Columns3 } from 'lucide-react'

interface Props {
  columns: { key: string; label: string }[]
  hiddenKeys: Set<string>
  onToggle: (key: string) => void
  alwaysVisible?: string[]
}

export default function ColumnToggle({ columns, hiddenKeys, onToggle, alwaysVisible = [] }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <Columns3 size={14} /> Columns
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {columns.map(({ key, label }) => {
            const locked = alwaysVisible.includes(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${locked ? 'text-gray-400' : 'hover:bg-gray-50 cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={!hiddenKeys.has(key)}
                  disabled={locked}
                  onChange={() => onToggle(key)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
