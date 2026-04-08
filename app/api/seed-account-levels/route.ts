import { NextResponse } from 'next/server'
import { getRows, updateRow } from '@/lib/sheets'

const DISTRICT_NAMES = new Set([
  'LAUSD',
  'Glendale Unified',
  'Berryessa Union School District',
  'Compton Unified',
  'Santa Clara Unified',
  'Tempe Elementary',
  'Cambrian',
  'Riverside Unified',
  'SFUSD',
  'Capitol City (DC)',
  'Union Elementary School District',
  'OSSE',
])

const CMO_NAMES = new Set([
  'Rocketship',
  'DaVinci Schools',
  'KIPP',
  'Value Schools',
])

const SCHOOL_TYPES = [
  'Prospective',
  'Current Partner',
  'Indirect Partner',
  'Declined Partner',
  'Past Partner',
  'Other - Education',
]

export async function POST() {
  try {
    const rows = await getRows('Accounts')
    const log: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const id = row[0]
      const name = row[1]
      const type = row[2]
      const existingLevel = row[32] || ''

      // Only process school/district-type accounts
      if (!id || !SCHOOL_TYPES.includes(type)) continue

      // Skip if already set
      if (existingLevel) {
        log.push(`SKIP (already set): ${name} = ${existingLevel}`)
        continue
      }

      let level = 'School'
      if (DISTRICT_NAMES.has(name)) level = 'District'
      else if (CMO_NAMES.has(name)) level = 'CMO'

      const updatedRow = Array.from({ length: 33 }, (_, j) => row[j] || '')
      updatedRow[32] = level
      await updateRow('Accounts', i, updatedRow)
      log.push(`SET: ${name} → ${level}`)
    }

    return NextResponse.json({ ok: true, log, count: log.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
