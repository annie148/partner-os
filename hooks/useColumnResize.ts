import { useState, useCallback, useRef, useEffect } from 'react'

export function useColumnResize(columnCount: number, defaultWidth: number | number[] = 120) {
  const [widths, setWidths] = useState<number[]>(() =>
    Array.isArray(defaultWidth)
      ? defaultWidth.slice(0, columnCount)
      : Array(columnCount).fill(defaultWidth)
  )
  const dragging = useRef<{ index: number; startX: number; startWidth: number } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const onMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault()
      // Clean up any lingering drag session
      cleanupRef.current?.()

      dragging.current = { index, startX: e.clientX, startWidth: widths[index] }

      const onMouseMove = (ev: MouseEvent) => {
        const drag = dragging.current
        if (!drag) return
        const diff = ev.clientX - drag.startX
        const newWidth = Math.max(60, drag.startWidth + diff)
        const dragIndex = drag.index
        setWidths((prev) => {
          const next = [...prev]
          next[dragIndex] = newWidth
          return next
        })
      }

      const cleanup = () => {
        dragging.current = null
        cleanupRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      const onMouseUp = () => {
        cleanup()
      }

      cleanupRef.current = cleanup
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [widths]
  )

  // Clean up listeners on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  // Sync if column count changes
  useEffect(() => {
    setWidths((prev) => {
      if (prev.length === columnCount) return prev
      const next = Array(columnCount).fill(defaultWidth)
      prev.forEach((w, i) => { if (i < columnCount) next[i] = w })
      return next
    })
  }, [columnCount, defaultWidth])

  return { widths, onMouseDown }
}
