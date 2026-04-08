import { NextResponse } from 'next/server'
import { getRows, appendRow, updateRow } from '@/lib/sheets'

const NEW_REGIONS = [
  {
    regionName: 'SF',
    regionGoalSY26: 'Approach to funded work established',
    regionGoalSY27: 'Grant-funded or OBC in place',
    currentStatus: '411 SFUSD students, no line of sight to funding',
  },
  {
    regionName: 'San Jose',
    regionGoalSY26: 'Secure SJ LEARNS',
    regionGoalSY27: 'SJ LEARNS funds; Rocketship partnership; 1 OBC in place',
    currentStatus: 'OBC convo with Alum Rock; OBC convo with Berryessa 3/20',
  },
]

const REGION_UPDATES: Record<string, { regionGoalSY26: string; regionGoalSY27: string; currentStatus: string }> = {
  LA: {
    regionGoalSY26: '3,500 students matched; 1,500 students in literacy; 1,100 4th+ in literacy; LAUSD data pipeline in place; ~10 partner schools',
    regionGoalSY27: '6,000 students matched; 3,000 students in literacy; 2,300 4th+ in literacy; 1-2 OBC\'s in place; LAUSD research partnership in place; 15 partner schools, including 5 Priority Schools',
    currentStatus: '2,655 students matched; 1,158 students in literacy; No LAUSD data pipeline',
  },
  NY: {
    regionGoalSY26: '200 students matched; Expanded partnership with one Local District',
    regionGoalSY27: '500 students; No OBC with individual schools',
    currentStatus: '137 current matched; NYC app submit by 3/31',
  },
  DC: {
    regionGoalSY26: '200 students matched; 2-3 OBCs in place',
    regionGoalSY27: '400 students',
    currentStatus: '177 matched',
  },
  AZ: {
    regionGoalSY26: 'Approach to expanded partnership is in place',
    regionGoalSY27: 'Expanded partnership in place; 200-400 students',
    currentStatus: '',
  },
}

const TASKS: { title: string; assignee: string; region: string }[] = [
  // LA
  { title: 'Follow up on Speroni intro (pending)', assignee: 'Sam', region: 'LA' },
  { title: 'Whitman mtg (3/25)', assignee: 'Sam', region: 'LA' },
  // SF
  { title: "Reach out to Lurie's comms director", assignee: 'Sam', region: 'SF' },
  { title: 'Decide on SFLC funder forum when you have more info', assignee: 'Sam', region: 'SF' },
  { title: 'Re-engage Anne (SF Ed Fund) with clearer demand narrative (TCS, Guadalupe, Monroe, Bessie, etc.)', assignee: 'Sam', region: 'SF' },
  { title: 'Continue attending TCS literacy events; deepen relationship with Radwa and instructional coach', assignee: 'Annie', region: 'SF' },
  { title: 'Connect with SF parents advocacy / Parents Fund leader and explore alignment', assignee: 'Annie', region: 'SF' },
  // San Jose
  { title: 'Berryessa OBC meeting', assignee: 'Annie', region: 'San Jose' },
  { title: 'Follow up on Alum Rock OBC conversation', assignee: 'Annie', region: 'San Jose' },
  { title: "Follow up on Keith's Menlo Park School District intro, set intro call", assignee: 'Annie', region: 'San Jose' },
  { title: 'Rocketship grant results expected in April', assignee: 'Gab', region: 'San Jose' },
  // NY
  { title: 'Email Melanie about resubmission in new format (due 3/31), introduce Annie, confirm submission', assignee: 'Sam', region: 'NY' },
  { title: 'Complete ExpandEd app', assignee: 'Genesis', region: 'NY' },
  { title: 'Email NYC pilot schools (PS 171, PS 330): schedule April meetings with Sam; ask for intros to local district offices and peer schools', assignee: 'Annie', region: 'NY' },
  { title: 'Build prioritized list of NYC charter networks (Dream, Democracy Prep, Excellence, etc.) and outline outreach plan', assignee: 'Annie', region: 'NY' },
  { title: 'Have Jamie send intro email to Eva contact in NYC and propose meeting', assignee: 'Gab', region: 'NY' },
  { title: 'Robin Hood follow-up after early April', assignee: 'Gab', region: 'NY' },
  // DC
  { title: 'Send OBC draft to Cityschools', assignee: 'Annie', region: 'DC' },
  { title: 'Email Cat, clarify OBC rollout status with DC charters; share draft OBC language; ask who to speak with re: EmpowerK12 rostering and missing student IDs, mention Nora mtg in April', assignee: 'Sam', region: 'DC' },
  { title: 'Review DCPS AI application answers before submission (form 1 & form 2)', assignee: 'Sam', region: 'DC' },
  { title: 'Socialize OBC with all current DC schools; log reactions/next steps', assignee: 'Annie', region: 'DC' },
  { title: 'Prepare April update for OSSE (numbers, stories, next-year funding ask)', assignee: 'Annie', region: 'DC' },
  { title: 'April check-in with Gamba', assignee: 'Gab', region: 'DC' },
  // AZ
  { title: 'Email Michelle (Tempe) to ask if superintendent is going to ASU GSV; if yes, request a meeting', assignee: 'Sam', region: 'AZ' },
  { title: 'Reach out to Brent Madden to set a GSV walk-and-talk', assignee: 'Sam', region: 'AZ' },
  { title: 'Prepare Tempe-specific OBC pitch (2 years, results, low penetration, OBC framing)', assignee: 'Annie', region: 'AZ' },
  { title: 'Provide Sam with concise Tempe growth/outcomes bullet + current enrollment numbers', assignee: 'Annie', region: 'AZ' },
]

// GET = dry run, POST = apply
export async function GET() {
  return run(false)
}

export async function POST() {
  return run(true)
}

async function run(apply: boolean) {
  try {
    const regionRows = await getRows('Regions')
    const existingRegions = new Set(regionRows.map((r) => r[0]).filter(Boolean))

    const log: string[] = []

    // 1. Create new regions
    for (const r of NEW_REGIONS) {
      if (existingRegions.has(r.regionName)) {
        log.push(`SKIP new region "${r.regionName}" — already exists`)
      } else {
        log.push(`CREATE region "${r.regionName}"`)
        if (apply) {
          await appendRow('Regions', [
            r.regionName,
            r.regionGoalSY26,
            r.regionGoalSY27,
            r.currentStatus,
            '',
            '',
          ])
        }
      }
    }

    // 2. Update existing regions
    for (const [name, data] of Object.entries(REGION_UPDATES)) {
      const idx = regionRows.findIndex((r) => r[0] === name)
      if (idx === -1) {
        log.push(`SKIP update "${name}" — region not found, will create`)
        if (apply) {
          await appendRow('Regions', [
            name,
            data.regionGoalSY26,
            data.regionGoalSY27,
            data.currentStatus,
            '',
            '',
          ])
        }
      } else {
        log.push(`UPDATE region "${name}" — SY26 Goal, SY27 Goal, Status`)
        if (apply) {
          const row = Array.from({ length: 6 }, (_, i) => regionRows[idx][i] || '')
          row[1] = data.regionGoalSY26
          row[2] = data.regionGoalSY27
          row[3] = data.currentStatus
          await updateRow('Regions', idx, row)
        }
      }
    }

    // 3. Create tasks
    const taskLog: { title: string; assignee: string; region: string }[] = []
    for (const t of TASKS) {
      taskLog.push(t)
      if (apply) {
        const id = crypto.randomUUID()
        await appendRow('Tasks', [
          id,
          '',          // accountId (not linked to a specific account)
          '',          // accountName
          t.title,
          t.assignee,
          '',          // dueDate
          'Not Started',
          '',          // notes
          t.region,
        ])
      }
    }

    return NextResponse.json({
      mode: apply ? 'applied' : 'dry-run',
      regionActions: log,
      tasks: taskLog,
      taskCount: taskLog.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
