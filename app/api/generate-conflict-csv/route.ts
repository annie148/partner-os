import { NextResponse } from 'next/server'
import { getRows } from '@/lib/sheets'

function rowToAccount(row: string[]): {
  id: string
  name: string
  assessmentName: string
  districtAssessmentMath: string
  districtAssessmentReading: string
} {
  return {
    id: row[0] || '',
    name: row[1] || '',
    assessmentName: row[23] || '',
    districtAssessmentMath: row[35] || '',
    districtAssessmentReading: row[36] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Accounts')
    const accounts = rows.map(rowToAccount)

    const csvLines: string[] = [
      'account_id,account_name,field_name,data_sharing_value,curriculum_value',
    ]

    for (const a of accounts) {
      // Check Math conflict: source (assessmentName) and destination (districtAssessmentMath)
      // both have values and they differ
      if (
        a.assessmentName.trim() !== '' &&
        a.districtAssessmentMath.trim() !== '' &&
        a.assessmentName.trim() !== a.districtAssessmentMath.trim()
      ) {
        csvLines.push(
          `${escapeCsv(a.id)},${escapeCsv(a.name)},districtAssessmentMath,${escapeCsv(a.districtAssessmentMath)},${escapeCsv(a.assessmentName)}`
        )
      }

      // Check Reading conflict: source (assessmentName) and destination (districtAssessmentReading)
      // both have values and they differ
      if (
        a.assessmentName.trim() !== '' &&
        a.districtAssessmentReading.trim() !== '' &&
        a.assessmentName.trim() !== a.districtAssessmentReading.trim()
      ) {
        csvLines.push(
          `${escapeCsv(a.id)},${escapeCsv(a.name)},districtAssessmentReading,${escapeCsv(a.districtAssessmentReading)},${escapeCsv(a.assessmentName)}`
        )
      }
    }

    const csv = csvLines.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="field_migration_conflicts.csv"',
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
