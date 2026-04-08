import { useState, useCallback } from 'react'

export function useColumnVisibility(pageKey: string, defaultHidden: string[] = []) {
  const storageKey = `partner-os-columns-${pageKey}`

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(defaultHidden)
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return new Set(JSON.parse(stored))
    } catch { /* ignore */ }
    return new Set(defaultHidden)
  })

  const toggle = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const isVisible = useCallback((key: string) => !hiddenKeys.has(key), [hiddenKeys])

  return { hiddenKeys, toggle, isVisible }
}
