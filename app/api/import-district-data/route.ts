import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow } from '@/lib/sheets'

// CSV name → account name mapping for known mismatches
const NAME_ALIASES: Record<string, string> = {
  'EL Haynes': 'E.L. Haynes PCS - MS',
  'EW Stokes': 'Elsie Whitlow Stokes Community Freedom PCS - East End',
  'SFUSD schools': 'SFUSD',
  'Capitol City': 'Capitol City (DC)',
  'Mary McLeod Bethune': 'Mary McLeod Bethune Day Academy PCS',
  'Union School District': 'Union Elementary School District',
  'Distinctive': 'Distinctive Schools',
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = []
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0])
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = splitCsvLine(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, j) => { obj[h.trim()] = (vals[j] || '').trim() })
    rows.push(obj)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else current += ch
  }
  result.push(current)
  return result
}

// POST with { csv, preview: true } = dry run; { csv, preview: false } = write
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText: string = body.csv
    const preview: boolean = body.preview !== false

    if (!csvText) {
      return NextResponse.json({ error: 'Missing csv field in request body' }, { status: 400 })
    }

    const csvRows = parseCsv(csvText)
    const accountRows = await getRows('Accounts')

    // Build name lookup
    const nameLookup = new Map<string, { idx: number; name: string; id: string; dsaStatus: string }>()
    for (let i = 0; i < accountRows.length; i++) {
      const row = accountRows[i]
      if (row[0]) {
        nameLookup.set(row[1]?.toLowerCase() || '', { idx: i, name: row[1], id: row[0], dsaStatus: row[29] || '' })
      }
    }

    const matched: { csvName: string; accountName: string; id: string; dsaWillUpdate: boolean; fieldsToUpdate: string[] }[] = []
    const unmatched: string[] = []

    for (const csvRow of csvRows) {
      const csvName = csvRow['District Name'] || ''
      if (!csvName) continue

      const alias = NAME_ALIASES[csvName]
      const lookupName = (alias || csvName).toLowerCase()
      const match = nameLookup.get(lookupName)

      if (!match) {
        unmatched.push(csvName)
        continue
      }

      const row = accountRows[match.idx]
      const updatedRow = Array.from({ length: 40 }, (_, j) => row[j] || '')
      const fieldsToUpdate: string[] = []

      // DSA status: only if existing is empty
      if (!updatedRow[29] && csvRow['DSA status']) {
        updatedRow[29] = csvRow['DSA status']
        fieldsToUpdate.push('dsaStatus')
      }

      const fieldMap: [string, number][] = [
        ['mouStatus', 33],
        ['dataReceived', 34],
        ['districtAssessmentMath', 35],
        ['districtAssessmentReading', 36],
        ['testWindow', 37],
        ['matchedStudents', 38],
        ['assessmentFollowUpNotes', 39],
      ]

      for (const [csvKey, colIdx] of fieldMap) {
        const val = csvRow[csvKey] || ''
        if (val) {
          updatedRow[colIdx] = val
          fieldsToUpdate.push(csvKey)
        }
      }

      matched.push({
        csvName,
        accountName: match.name,
        id: match.id,
        dsaWillUpdate: !match.dsaStatus && !!csvRow['DSA status'],
        fieldsToUpdate,
      })

      if (!preview && fieldsToUpdate.length > 0) {
        await updateRow('Accounts', match.idx, updatedRow)
      }
    }

    return NextResponse.json({
      ok: true,
      preview,
      csvRowCount: csvRows.length,
      matched,
      matchedCount: matched.length,
      unmatched,
      unmatchedCount: unmatched.length,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
