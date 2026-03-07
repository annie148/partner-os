import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const key = env.match(/GOOGLE_SERVICE_ACCOUNT_KEY=(.+)/)?.[1]
const credentials = JSON.parse(key)
if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')

const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
const sheets = google.sheets({ version: 'v4', auth })
const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'

// ── Type mapping ─────────────────────────────────────────────────────────────
function mapType(notes = '') {
  const n = notes.toLowerCase()
  if (n.includes('committed-written'))        return 'Current Funder'
  if (n.includes('received'))                 return 'Current Funder'
  if (n.includes('submitted') || n.includes('ask made')) return 'Prospective Funder'
  if (n.includes('pending submission') || n.includes('pending')) return 'Prospective Funder'
  if (n.includes('cultivating'))              return 'Prospective Funder'
  if (n.includes('need to qualify'))          return 'Prospective Funder'
  if (n.includes('declined'))                 return 'Declined Funder'
  return 'Prospective Funder'
}

// ── Date conversion: "01. March" or "1. May" → "2025-03-01" ─────────────────
const MONTHS = {
  january:'01', february:'02', march:'03', april:'04',
  may:'05', june:'06', july:'07', august:'08',
  september:'09', october:'10', november:'11', december:'12',
}

function convertDate(raw = '') {
  if (!raw || raw.trim() === '' || raw.trim().toLowerCase() === 'n/a') return ''
  const match = raw.match(/\d+\.\s*([A-Za-z]+)/)
  if (match) {
    const month = MONTHS[match[1].toLowerCase()]
    if (month) return `2025-${month}-01`
  }
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  // MM/DD/YYYY
  const mdy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return ''
}

// ── Read current data ────────────────────────────────────────────────────────
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Accounts!A1:Z200',
})
const rows = res.data.values || []
const [header, ...dataRows] = rows

console.log(`Found ${dataRows.length} data rows to transform.\n`)

// Current columns (0-indexed):
//   0: name   1: type(Foundation)   2: region   3: priority   4: owner
//   5: date("01. March")   6-8: empty   9: notes/status

// Target columns for the app:
//   A(0): id   B(1): name   C(2): type   D(3): region   E(4): priority
//   F(5): owner   G(6): lastContactDate   H(7): nextFollowUpDate
//   I(8): nextAction   J(9): notes

const newHeader = ['id','name','type','region','priority','owner','lastContactDate','nextFollowUpDate','nextAction','notes']

const newRows = dataRows.map((row, i) => {
  const name       = row[0] || ''
  const region     = row[2] || ''
  const priority   = row[3] || ''
  const owner      = row[4] || ''
  const rawDate    = row[5] || ''  // "01. March" style — will become nextFollowUpDate
  const notes      = row[9] || ''

  const id              = randomUUID()
  const type            = mapType(notes)
  const nextFollowUpDate = convertDate(rawDate)

  const transformed = [id, name, type, region, priority, owner, '', nextFollowUpDate, '', notes]
  console.log(`  [${i+1}] ${name.substring(0,40).padEnd(40)} → type: ${type}, date: ${nextFollowUpDate || '(none)'}`)
  return transformed
})

console.log('\nWriting transformed data back to sheet…')

await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: 'Accounts!A1',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [newHeader, ...newRows] },
})

console.log('Done! ✓')
