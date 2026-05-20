import { NextResponse } from 'next/server'
import { getRows } from '@/lib/sheets'

function rowToAccount(row: string[]): { id: string; name: string; assessmentName: string } {
  return {
    id: row[0] || '',
    name: row[1] || '',
    assessmentName: row[23] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Accounts')
    const accounts = rows.map(rowToAccount).filter((a) => a.assessmentName.trim() !== '')

    const csvLines: string[] = [
      'account_id,account_name,current_assessment_name,proposed_math_value,proposed_reading_value',
    ]

    for (const a of accounts) {
      const id = escapeCsv(a.id)
      const name = escapeCsv(a.name)
      const assessment = escapeCsv(a.assessmentName)
      csvLines.push(`${id},${name},${assessment},${assessment},${assessment}`)
    }

    const csv = csvLines.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="assessment_name_split.csv"',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
