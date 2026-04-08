/**
 * Migration script: Update school/district account types in Google Sheets
 *
 * Mapping:
 *   "Prospective School/District" → "Prospective"
 *   "Current School/District"     → "Current Partner"
 *   "Former School/District"      → "Past Partner"
 *   "Declined School/District"    → "Declined Partner"
 *   "Other - Education"           → FLAGGED FOR REVIEW (not auto-mapped)
 *
 * Usage: node scripts/migrate-school-types.mjs
 *   --dry-run   (default) Preview changes without writing
 *   --apply     Actually write changes to the sheet
 */

import { google } from 'googleapis'
import { readFileSync } from 'fs'

const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'
const TYPE_COLUMN_INDEX = 2 // Column C = type

const TYPE_MAP = {
  'Prospective School/District': 'Prospective',
  'Current School/District': 'Current Partner',
  'Former School/District': 'Past Partner',
  'Declined School/District': 'Declined Partner',
}

async function main() {
  const apply = process.argv.includes('--apply')

  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const rawKey = env.match(/GOOGLE_SERVICE_ACCOUNT_KEY=(.+)/)?.[1]
  if (!rawKey) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_KEY in .env.local')
    process.exit(1)
  }

  const credentials = JSON.parse(rawKey)
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Accounts!A:AN',
  })

  const rows = res.data.values || []
  const header = rows[0]
  const dataRows = rows.slice(1)

  console.log(`Found ${dataRows.length} accounts\n`)

  const toUpdate = []
  const flagged = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const name = row[1] || '(unnamed)'
    const type = row[TYPE_COLUMN_INDEX] || ''

    if (type === 'Other - Education') {
      flagged.push({ row: i + 2, name, type })
      continue
    }

    if (TYPE_MAP[type]) {
      toUpdate.push({ row: i + 2, name, oldType: type, newType: TYPE_MAP[type] })
    }
  }

  console.log(`Will update ${toUpdate.length} accounts:`)
  for (const { row, name, oldType, newType } of toUpdate) {
    console.log(`  Row ${row}: "${name}" — "${oldType}" → "${newType}"`)
  }

  if (flagged.length > 0) {
    console.log(`\n⚠️  FLAGGED FOR REVIEW (${flagged.length} accounts with "Other - Education"):`)
    for (const { row, name } of flagged) {
      console.log(`  Row ${row}: "${name}" — keeping "Other - Education" (needs manual review)`)
    }
  }

  if (!apply) {
    console.log('\n--- DRY RUN --- No changes written. Use --apply to execute.')
    return
  }

  console.log('\nApplying changes...')
  let updated = 0
  for (const { row, newType } of toUpdate) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Accounts!C${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newType]] },
    })
    updated++
  }

  console.log(`Done. Updated ${updated} accounts.`)
  if (flagged.length > 0) {
    console.log(`${flagged.length} "Other - Education" accounts were NOT changed — review manually.`)
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
