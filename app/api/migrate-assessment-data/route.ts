import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow } from '@/lib/sheets'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron =
    cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
  const isCronToken =
    cronSecret && req.headers.get('x-vercel-cron-auth-token') === cronSecret
  const origin = req.headers.get('origin') || req.headers.get('referer')
  return !!(isVercelCron || isCronToken || origin)
}

interface AssessmentMapping {
  accountId: string
  mathValue: string
  readingValue: string
}

interface Conflict {
  accountId: string
  accountName: string
  field: string
  existingValue: string
  newValue: string
}

/**
 * GET /api/migrate-assessment-data — dry run (body with assessmentMappings)
 * POST /api/migrate-assessment-data — apply updates
 *
 * Migrates assessment name data into districtAssessmentMath (index 35)
 * and districtAssessmentReading (index 36) for specified accounts.
 * Only writes if the destination field is empty (no overwrite).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run(req, false)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run(req, true)
}

async function run(req: NextRequest, apply: boolean) {
  try {
    let mappings: AssessmentMapping[] = []
    try {
      const body = await req.json()
      mappings = body.assessmentMappings || []
    } catch {
      // No body or invalid JSON — return empty results
      return NextResponse.json({
        mode: apply ? 'applied' : 'dry-run',
        updated: 0,
        skipped_has_value: 0,
        conflicts: [],
        total: 0,
        error: 'No assessmentMappings provided in request body',
      })
    }

    const accountRows = await getRows('Accounts')

    // Build accountId -> row index map
    const accountIndexMap: Record<string, number> = {}
    for (let i = 0; i < accountRows.length; i++) {
      const id = accountRows[i][0] || ''
      if (id) accountIndexMap[id] = i
    }

    let updated = 0
    let skipped_has_value = 0
    const conflicts: Conflict[] = []

    for (const mapping of mappings) {
      const { accountId, mathValue, readingValue } = mapping
      const rowIndex = accountIndexMap[accountId]
      if (rowIndex === undefined) continue

      const row = accountRows[rowIndex]
      const accountName = row[1] || ''
      const existingMath = row[35] || ''
      const existingReading = row[36] || ''

      let mathUpdated = false
      let readingUpdated = false

      // Check math field
      if (mathValue) {
        if (existingMath && existingMath !== mathValue) {
          conflicts.push({
            accountId,
            accountName,
            field: 'districtAssessmentMath',
            existingValue: existingMath,
            newValue: mathValue,
          })
          skipped_has_value++
        } else if (!existingMath) {
          mathUpdated = true
        }
      }

      // Check reading field
      if (readingValue) {
        if (existingReading && existingReading !== readingValue) {
          conflicts.push({
            accountId,
            accountName,
            field: 'districtAssessmentReading',
            existingValue: existingReading,
            newValue: readingValue,
          })
          skipped_has_value++
        } else if (!existingReading) {
          readingUpdated = true
        }
      }

      if (mathUpdated || readingUpdated) {
        if (apply) {
          const updatedRow = Array.from({ length: 45 }, (_, j) => row[j] || '')
          if (mathUpdated) updatedRow[35] = mathValue
          if (readingUpdated) updatedRow[36] = readingValue
          await updateRow('Accounts', rowIndex, updatedRow)
          // Update local copy so subsequent lookups see the new values
          accountRows[rowIndex] = updatedRow
        }
        updated++
      }
    }

    return NextResponse.json({
      mode: apply ? 'applied' : 'dry-run',
      updated,
      skipped_has_value,
      conflicts,
      total: mappings.length,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
