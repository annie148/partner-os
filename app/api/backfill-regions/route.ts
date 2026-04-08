import { NextResponse } from 'next/server'
import { getRows, updateRow } from '@/lib/sheets'

const SCHOOL_TYPES = [
  'Prospective',
  'Current Partner',
  'Indirect Partner',
  'Declined Partner',
  'Past Partner',
  'Other - Education',
]

const DOMAIN_REGION: Record<string, string> = {
  'lausd.net': 'LA', 'gusd.net': 'LA', 'compton.k12.ca.us': 'LA',
  'sfusd.edu': 'Bay Area', 'x.sfusd.edu': 'Bay Area',
  'cambriansd.com': 'Bay Area', 'unionsd.org': 'Bay Area',
  'busd.net': 'Bay Area', 'scusd.net': 'Bay Area', 'rsed.org': 'Bay Area',
  'davincischools.org': 'LA', 'valueschools.com': 'LA',
  'kippsocal.org': 'LA', 'tempeschools.org': 'South',
  'riversideunified.org': 'LA', 'equitasacademy.org': 'LA',
  'missionpreparatory.org': 'Bay Area',
}

const PARENT_REGION: Record<string, string> = {
  'LAUSD': 'LA', 'Glendale Unified': 'LA', 'Compton Unified': 'LA',
  'Berryessa Union School District': 'Bay Area', 'Cambrian': 'Bay Area',
  'SFUSD': 'Bay Area', 'Rocketship': 'Bay Area', 'Santa Clara Unified': 'Bay Area',
  'Tempe Elementary': 'South', 'Riverside Unified': 'LA',
  'DaVinci Schools': 'LA', 'Value Schools': 'LA',
  'Capitol City (DC)': 'DC',
}

const NAME_REGION: Record<string, string> = {
  'E.L. Haynes PCS - MS': 'DC', 'E.L. Haynes PCS - ES': 'DC',
  'Elsie Whitlow Stokes Community Freedom PCS - East End': 'DC',
  'Elsie Whitlow Stokes Community Freedom PCS - Brookland': 'DC',
  'Mary McLeod Bethune Day Academy PCS': 'DC',
  'Capitol City (DC)': 'DC', 'OSSE': 'DC',
  'Capital City PCS - Lower School': 'DC', 'Capital City PCS - Middle School': 'DC',
  'Tempe Elementary': 'South', 'Riverside Unified': 'LA',
  'LAUSD': 'LA', 'Glendale Unified': 'LA', 'Compton Unified': 'LA',
  'Berryessa Union School District': 'Bay Area', 'Cambrian': 'Bay Area',
  'SFUSD': 'Bay Area', 'Rocketship': 'Bay Area', 'Santa Clara Unified': 'Bay Area',
  'DaVinci Schools': 'LA', 'Value Schools': 'LA',
}

export async function POST() {
  try {
    const accountRows = await getRows('Accounts')
    const contactRows = await getRows('Contacts')

    // Build ID -> name map
    const idToName: Record<string, string> = {}
    for (const row of accountRows) {
      if (row[0]) idToName[row[0]] = row[1]
    }

    // Build account -> email domains
    const accountDomains: Record<string, Set<string>> = {}
    for (const row of contactRows) {
      const aid = row[1]
      const email = row[4]
      if (aid && email && email.includes('@')) {
        if (!accountDomains[aid]) accountDomains[aid] = new Set()
        accountDomains[aid].add(email.split('@')[1].toLowerCase())
      }
    }

    const updated: { name: string; region: string; source: string }[] = []
    const skipped: string[] = []

    for (let i = 0; i < accountRows.length; i++) {
      const row = accountRows[i]
      const id = row[0]
      const name = row[1]
      const type = row[2]
      const existingRegion = row[3]

      if (!id || !SCHOOL_TYPES.includes(type) || existingRegion) continue

      const parentId = row[31] || ''
      const parentName = parentId ? (idToName[parentId] || '') : ''
      const domains = accountDomains[id] || new Set()

      let region = ''
      let source = ''

      // 1. Name match
      if (NAME_REGION[name]) {
        region = NAME_REGION[name]
        source = 'name match'
      }

      // 2. Parent district
      if (!region && parentName && PARENT_REGION[parentName]) {
        region = PARENT_REGION[parentName]
        source = `parent: ${parentName}`
      }

      // 3. Email domain
      if (!region) {
        for (const d of domains) {
          if (DOMAIN_REGION[d]) {
            region = DOMAIN_REGION[d]
            source = `email: @${d}`
            break
          }
        }
      }

      if (region) {
        const updatedRow = Array.from({ length: 40 }, (_, j) => row[j] || '')
        updatedRow[3] = region
        await updateRow('Accounts', i, updatedRow)
        updated.push({ name, region, source })
      } else {
        skipped.push(name)
      }
    }

    return NextResponse.json({ ok: true, updated, updatedCount: updated.length, skipped, skippedCount: skipped.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
