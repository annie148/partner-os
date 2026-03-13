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
  summary_text?: string
  summary_markdown?: string
  notes?: string
  notes_markdown?: string
  attendees?: { name?: string; email?: string }[]
}

/** Flatten a note into a single content string for AI parsing */
export function getNoteContent(note: GranolaNote): string {
  // Prefer markdown content (preserves action items and structured sections)
  const markdown = note.notes_markdown || note.notes || note.summary_markdown
  if (markdown?.trim()) return markdown
  // Fall back to plain text summary
  if (note.summary_text?.trim()) return note.summary_text
  // Fall back to transcript joined as text
  if (Array.isArray(note.transcript) && note.transcript.length > 0) {
    return note.transcript.map((s) => s.text).join(' ')
  }
  return ''
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
  // Log all top-level keys to discover the actual field names
  console.log(`[granola] Note "${noteId}" keys:`, Object.keys(data))
  console.log(`[granola] Note "${noteId}" sample:`, JSON.stringify(data).slice(0, 500))
  return data
}
