import { NextResponse } from 'next/server'

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? ''
  const trimmed = raw.trim()

  // Count actual newline characters
  const newlineCount = (raw.match(/\n/g) || []).length
  const crCount = (raw.match(/\r/g) || []).length

  // Try to parse and report what fields exist
  let parseResult = 'not attempted'
  let fields: string[] = []
  let privateKeyPreview = ''

  try {
    const parsed = JSON.parse(trimmed)
    fields = Object.keys(parsed)
    parseResult = 'success'
    privateKeyPreview = (parsed.private_key ?? '').substring(0, 60)
  } catch (e) {
    parseResult = `failed: ${String(e)}`
    // Try with escaped newlines
    try {
      const escaped = trimmed.replace(/\n/g, '\\n').replace(/\r/g, '')
      const parsed = JSON.parse(escaped)
      fields = Object.keys(parsed)
      parseResult = 'success after escaping newlines'
      privateKeyPreview = (parsed.private_key ?? '').substring(0, 60)
    } catch (e2) {
      parseResult += ` | also failed after escape: ${String(e2)}`
    }
  }

  return NextResponse.json({
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    newlineCount,
    crCount,
    first100: trimmed.substring(0, 100),
    last50: trimmed.substring(trimmed.length - 50),
    parseResult,
    fields,
    privateKeyPreview,
  })
}
