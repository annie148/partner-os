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

/**
 * GET /api/backfill-task-regions — dry run
 * POST /api/backfill-task-regions — apply updates
 *
 * For each task missing a region, looks up the account's region and backfills it.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run(false)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run(true)
}

async function run(apply: boolean) {
  try {
    const [taskRows, accountRows] = await Promise.all([
      getRows('Tasks'),
      getRows('Accounts'),
    ])

    // Build accountId -> region map (account region is at index 3)
    const accountRegionMap: Record<string, string> = {}
    for (const row of accountRows) {
      const id = row[0] || ''
      const region = row[3] || ''
      if (id && region) {
        accountRegionMap[id] = region
      }
    }

    let updated = 0
    let skipped_no_account = 0
    let skipped_no_region = 0
    let already_has_region = 0

    for (let i = 0; i < taskRows.length; i++) {
      const row = taskRows[i]
      const taskRegion = row[8] || ''
      const taskAccountId = row[1] || ''

      // Task already has a region — skip
      if (taskRegion) {
        already_has_region++
        continue
      }

      // No accountId on the task — can't look up region
      if (!taskAccountId) {
        skipped_no_account++
        continue
      }

      const accountRegion = accountRegionMap[taskAccountId]

      // Account has no region — can't backfill
      if (!accountRegion) {
        skipped_no_region++
        continue
      }

      // Backfill the region
      if (apply) {
        const updatedRow = Array.from({ length: 11 }, (_, j) => row[j] || '')
        updatedRow[8] = accountRegion
        await updateRow('Tasks', i, updatedRow)
      }
      updated++
    }

    return NextResponse.json({
      mode: apply ? 'applied' : 'dry-run',
      updated,
      skipped_no_account,
      skipped_no_region,
      already_has_region,
      total: taskRows.length,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
