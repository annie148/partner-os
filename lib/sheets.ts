import { google } from 'googleapis'

const SHEET_ID = '1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs'

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  // Vercel converts \n sequences in env vars to actual newline characters,
  // which makes JSON.parse fail with "bad control character". Re-escape first.
  const sanitized = key.trim().replace(/\n/g, '\\n').replace(/\r/g, '')
  const credentials = JSON.parse(sanitized)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function client() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

export async function getRows(sheet: string): Promise<string[][]> {
  const s = await client()
  const res = await s.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheet}!A:AN`,
  })
  const rows = res.data.values || []
  return rows.length > 1 ? (rows.slice(1) as string[][]) : []
}

export async function appendRow(sheet: string, values: string[]): Promise<void> {
  const s = await client()
  await s.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheet}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

export async function updateRow(
  sheet: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  const sheetRow = rowIndex + 2 // +1 for 1-based, +1 for header row
  const s = await client()
  await s.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheet}!A${sheetRow}:AN${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

export async function deleteRow(sheet: string, rowIndex: number): Promise<void> {
  const sheetRow = rowIndex + 1 // 0-based index; header is 0, data starts at 1
  const s = await client()
  const spreadsheet = await s.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const sheetObj = spreadsheet.data.sheets?.find(
    (sh) => sh.properties?.title?.toLowerCase() === sheet.toLowerCase()
  )
  if (sheetObj?.properties?.sheetId === undefined) {
    throw new Error(`Sheet "${sheet}" not found`)
  }
  await s.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetObj.properties.sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow,
              endIndex: sheetRow + 1,
            },
          },
        },
      ],
    },
  })
}
