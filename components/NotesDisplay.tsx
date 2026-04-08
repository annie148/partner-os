'use client'

import { useState, useMemo } from 'react'

interface NotesDisplayProps {
  text: string
  className?: string
  /** Max lines to show before collapsing (default 3) */
  maxLines?: number
}

/** Shorten a URL for display: show hostname + first path segment */
function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname.split('/').slice(0, 3).join('/')
    const display = u.hostname.replace(/^www\./, '') + (path.length > 30 ? path.slice(0, 30) + '...' : path)
    return display
  } catch {
    return url.length > 50 ? url.slice(0, 50) + '...' : url
  }
}

/** Convert markdown-ish text to HTML */
function renderMarkdown(text: string): string {
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_ (but not inside URLs or already-processed bold)
  html = html.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '<em>$1</em>')
  html = html.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<em>$1</em>')

  // Markdown links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 underline">$1</a>'
  )

  // Auto-link bare URLs (not already in an href)
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<)]+)/g,
    (url) => {
      const display = shortenUrl(url)
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 underline">${display}</a>`
    }
  )

  // Bullet lists: lines starting with - or *
  html = html.replace(/^([*-]) (.+)$/gm, '<li class="ml-4 list-disc">$2</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>')

  // Paragraphs: convert double newlines to paragraph breaks
  html = html.replace(/\n\n/g, '</p><p>')
  // Single newlines to <br>
  html = html.replace(/\n/g, '<br/>')

  return html
}

export default function NotesDisplay({ text, className = '', maxLines = 3 }: NotesDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  const html = useMemo(() => renderMarkdown(text), [text])

  const lines = text.split('\n')
  const isLong = lines.length > maxLines

  const previewHtml = useMemo(() => {
    if (!isLong) return html
    return renderMarkdown(lines.slice(0, maxLines).join('\n'))
  }, [html, isLong, lines, maxLines])

  return (
    <div className={className}>
      <div
        className="text-sm text-gray-700 prose-sm [&_ul]:list-disc [&_ul]:pl-4 [&_li]:pl-0 [&_strong]:font-semibold [&_a]:text-indigo-600 [&_a:hover]:text-indigo-800"
        dangerouslySetInnerHTML={{ __html: expanded || !isLong ? html : previewHtml }}
      />
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
