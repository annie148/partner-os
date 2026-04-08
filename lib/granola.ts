const GRANOLA_API_BASE = 'https://public-api.granola.ai'

interface TranscriptSegment {
  text: string
  start_time?: string
  end_time?: string
  speaker?: { source?: string }
}

export interface GranolaNote {
  id: string
  title: string
  created_at: string
  updated_at: string
  transcript?: TranscriptSegment[]
  summary?: string
  summary_text?: string
  summary_markdown?: string
  notes?: string
  notes_markdown?: string
  panels?: { type?: string; title?: string; content?: string; markdown?: string }[]
  attendees?: { name?: string; email?: string }[]
  // Catch-all for unknown fields from the API
  [key: string]: unknown
}

/** Flatten a note into a single content string for AI parsing */
export function getNoteContent(note: GranolaNote): string {
  // Prefer markdown content (preserves action items and structured sections)
  const markdown = note.notes_markdown || note.notes || note.summary_markdown || note.summary
  if (markdown?.trim()) return markdown
  // Fall back to plain text summary
  if (note.summary_text?.trim()) return note.summary_text
  // Check panels for structured content (some API versions use this)
  if (Array.isArray(note.panels) && note.panels.length > 0) {
    const panelText = note.panels
      .map((p) => {
        const heading = p.title || p.type || ''
        const body = p.markdown || p.content || ''
        return heading ? `### ${heading}\n${body}` : body
      })
      .filter(Boolean)
      .join('\n\n')
    if (panelText.trim()) return panelText
  }
  // Fall back to transcript joined as text
  if (Array.isArray(note.transcript) && note.transcript.length > 0) {
    return note.transcript.map((s) => s.text).join(' ')
  }
  return ''
}

/** Extract the Next Steps / Action Items section from note content */
export function extractNextSteps(note: GranolaNote): string {
  // Check panels for a dedicated next_steps / action_items panel
  if (Array.isArray(note.panels)) {
    const stepsPanels = note.panels.filter((p) => {
      const t = (p.type || p.title || '').toLowerCase()
      return t.includes('next') || t.includes('action') || t.includes('follow')
    })
    if (stepsPanels.length > 0) {
      return stepsPanels
        .map((p) => p.markdown || p.content || '')
        .filter(Boolean)
        .join('\n')
    }
  }

  // Extract from markdown content using section headers
  const content = getNoteContent(note)
  if (!content) return ''

  const nextStepsMatch = content.match(
    /###?\s*(?:Next\s*Steps|Action\s*Items|Follow[\s-]*up(?:\s*Actions)?|Immediate\s*Actions|Key\s*(?:Action|Next)\s*(?:Items|Steps))[^\n]*\n([\s\S]*?)(?=\n###?\s|\n##\s|$)/i
  )
  return nextStepsMatch ? nextStepsMatch[0].trim() : ''
}

function getApiKey(): string {
  const key = process.env.GRANOLA_API_KEY
  if (!key) throw new Error('GRANOLA_API_KEY not set')
  return key
}

export async function fetchRecentNotes(hoursAgo = 24): Promise<GranolaNote[]> {
  const apiKey = getApiKey()
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
  const notes: GranolaNote[] = []
  let cursor: string | undefined

  // Paginate through all recent notes (list endpoint, no include=transcript)
  do {
    const params = new URLSearchParams({
      created_after: since,
      page_size: '30',
    })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${GRANOLA_API_BASE}/v1/notes?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Granola API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const items: GranolaNote[] = data.notes || []
    notes.push(...items)
    cursor = data.hasMore ? data.cursor : undefined
  } while (cursor)

  // Fetch full details (with transcript) for each note
  const detailed: GranolaNote[] = []
  for (const note of notes) {
    try {
      const full = await fetchNoteById(note.id)
      detailed.push(full)
    } catch {
      // If detail fetch fails, use the summary from list
      detailed.push(note)
    }
  }

  return detailed
}

export async function fetchNoteById(noteId: string): Promise<GranolaNote> {
  const apiKey = getApiKey()
  const res = await fetch(
    `${GRANOLA_API_BASE}/v1/notes/${noteId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Granola API error ${res.status}: ${text}`)
  }
  const data = await res.json()
  // Handle potential response wrapping (e.g. { note: { ... } })
  const note: GranolaNote = data.note ?? data
  console.log(`[granola] Note "${noteId}" keys:`, Object.keys(data))
  console.log(`[granola] Note "${noteId}" note keys:`, Object.keys(note))
  console.log(`[granola] Note "${noteId}" content fields:`, {
    summary: !!note.summary,
    summary_text: !!note.summary_text,
    summary_markdown: !!note.summary_markdown,
    notes: !!note.notes,
    notes_markdown: !!note.notes_markdown,
    panels: Array.isArray(note.panels) ? note.panels.length : 0,
    transcript: Array.isArray(note.transcript) ? note.transcript.length : 0,
  })
  return note
}
