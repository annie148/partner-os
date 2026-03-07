import { useState, useCallback, useRef, useEffect } from 'react'

export function useColumnResize(columnCount: number, defaultWidth = 120) {
  const [widths, setWidths] = useState<number[]>(() =>
    Array(columnCount).fill(defaultWidth)
  )
  const dragging = useRef<{ index: number; startX: number; startWidth: number } | null>(null)

  const onMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = { index, startX: e.clientX, startWidth: widths[index] }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const diff = ev.clientX - dragging.current.startX
        const newWidth = Math.max(60, dragging.current.startWidth + diff)
        setWidths((prev) => {
          const next = [...prev]
          next[dragging.current!.index] = newWidth
          return next
        })
      }

      const onMouseUp = () => {
        dragging.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [widths]
  )

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
