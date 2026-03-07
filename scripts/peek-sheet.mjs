import { google } from 'googleapis'
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const key = env.match(/GOOGLE_SERVICE_ACCOUNT_KEY=(.+)/)?.[1]
const credentials = JSON.parse(key)
if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')

const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
const sheets = google.sheets({ version: 'v4', auth })

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs',
  range: 'Accounts!A1:Z200',
})

const rows = res.data.values || []
console.log(`Total rows: ${rows.length}`)
rows.forEach((row, i) => console.log(`Row ${i}: ${JSON.stringify(row)}`))
