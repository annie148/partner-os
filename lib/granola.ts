const GRANOLA_API_BASE = 'https://api.granola.ai'

interface GranolaNoteListItem {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface GranolaNote {
  id: string
  title: string
  created_at: string
  updated_at: string
  transcript?: string
  summary?: string
  attendees?: { name?: string; email?: string }[]
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

  // Paginate through all recent notes
  do {
    const params = new URLSearchParams({
      created_after: since,
      include: 'transcript',
    })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${GRANOLA_API_BASE}/v0/notes?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Granola API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const items: GranolaNote[] = data.notes || data.results || data.data || []
    notes.push(...items)
    cursor = data.cursor || data.next_cursor
  } while (cursor)

  return notes
}

export async function fetchNoteById(noteId: string): Promise<GranolaNote> {
  const apiKey = getApiKey()
  const res = await fetch(
    `${GRANOLA_API_BASE}/v0/notes/${noteId}?include=transcript`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Granola API error ${res.status}: ${text}`)
  }
  return res.json()
}
