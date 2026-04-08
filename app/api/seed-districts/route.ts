import { NextResponse } from 'next/server'
import { getRows, appendRow, updateRow } from '@/lib/sheets'

const DISTRICTS_TO_CREATE = [
  'LAUSD',
  'Glendale Unified',
  'Berryessa Union School District',
  'Compton Unified',
  'Santa Clara Unified',
  'Tempe Elementary',
  'Cambrian',
  'Riverside Unified',
  'SFUSD',
  'Capitol City (DC)',
]

const CMOS_TO_CREATE = [
  'Rocketship',
  'DaVinci Schools',
  'Value Schools',
]

// Map email domain → district name
const DOMAIN_TO_DISTRICT: Record<string, string> = {
  'lausd.net': 'LAUSD',
  'mymail.lausd.net': 'LAUSD',
  'gusd.net': 'Glendale Unified',
  'busd.net': 'Berryessa Union School District',
  'compton.k12.ca.us': 'Compton Unified',
  'scusd.net': 'Santa Clara Unified',
  'tempeschools.org': 'Tempe Elementary',
  'cambriansd.com': 'Cambrian',
  'rusd.k12.ca.us': 'Riverside Unified',
  'sfusd.edu': 'SFUSD',
  'capitolcitydc.org': 'Capitol City (DC)',
  'rsed.org': 'Rocketship',
  'davincischools.org': 'DaVinci Schools',
  'valueschools.com': 'Value Schools',
}

const SCHOOL_TYPES = [
  'Prospective',
  'Current Partner',
  'Indirect Partner',
  'Declined Partner',
  'Past Partner',
  'Other - Education',
]

function buildRow(id: string, name: string): string[] {
  // 32 columns: A-AF
  const row = Array(32).fill('')
  row[0] = id
  row[1] = name
  row[2] = 'Current Partner'
  row[4] = 'Medium'
  row[5] = 'Annie'
  return row
}

export async function POST() {
  try {
    const accountRows = await getRows('Accounts')
    const contactRows = await getRows('Contacts')

    // Build existing account name → id map (case-insensitive)
    const existingAccounts = new Map<string, { id: string; name: string; idx: number }>()
    for (let i = 0; i < accountRows.length; i++) {
      const row = accountRows[i]
      if (row[0]) {
        existingAccounts.set(row[1]?.toLowerCase() || '', { id: row[0], name: row[1], idx: i })
      }
    }

    const log: string[] = []

    // PHASE 2: Create missing district/CMO records
    const allToCreate = [...DISTRICTS_TO_CREATE, ...CMOS_TO_CREATE]
    const districtIdMap = new Map<string, string>() // name → id

    for (const name of allToCreate) {
      const existing = existingAccounts.get(name.toLowerCase())
      if (existing) {
        log.push(`SKIP (exists): ${name} → id=${existing.id}`)
        districtIdMap.set(name, existing.id)
      } else {
        const id = crypto.randomUUID()
        await appendRow('Accounts', buildRow(id, name))
        log.push(`CREATED: ${name} → id=${id}`)
        districtIdMap.set(name, id)
        existingAccounts.set(name.toLowerCase(), { id, name, idx: -1 })
      }
    }

    // PHASE 3: Auto-link schools to districts by contact email domain
    // Build contact email domain → account mapping
    const accountContactEmails = new Map<string, Set<string>>() // accountId → set of email domains
    for (const row of contactRows) {
      const accountId = row[1] // accountId column
      const email = row[4] // email column
      if (accountId && email && email.includes('@')) {
        const domain = email.split('@')[1].toLowerCase()
        if (!accountContactEmails.has(accountId)) {
          accountContactEmails.set(accountId, new Set())
        }
        accountContactEmails.get(accountId)!.add(domain)
      }
    }

    // Re-read account rows to get fresh data (including newly created districts)
    const freshRows = await getRows('Accounts')
    const linked: string[] = []
    const unlinked: string[] = []

    for (let i = 0; i < freshRows.length; i++) {
      const row = freshRows[i]
      const accountId = row[0]
      const accountName = row[1]
      const accountType = row[2]
      const existingParent = row[31] // parentDistrictId

      // Only process school-type accounts that don't already have a parent
      if (!accountId || !SCHOOL_TYPES.includes(accountType) || existingParent) continue

      // Skip if this account IS a district/CMO itself
      if (districtIdMap.has(accountName)) continue

      // Check contact email domains for this account
      const domains = accountContactEmails.get(accountId)
      if (!domains || domains.size === 0) {
        unlinked.push(`${accountName}: no contact emails`)
        continue
      }

      // Find matching district by domain
      let matchedDistrict: string | null = null
      let matchedDomain: string | null = null
      for (const domain of domains) {
        if (DOMAIN_TO_DISTRICT[domain]) {
          if (matchedDistrict && matchedDistrict !== DOMAIN_TO_DISTRICT[domain]) {
            // Ambiguous: multiple domains mapping to different districts
            matchedDistrict = null
            matchedDomain = null
            break
          }
          matchedDistrict = DOMAIN_TO_DISTRICT[domain]
          matchedDomain = domain
        }
      }

      if (matchedDistrict && districtIdMap.has(matchedDistrict)) {
        const parentId = districtIdMap.get(matchedDistrict)!
        // Update the row
        const updatedRow = Array.from({ length: 32 }, (_, j) => freshRows[i][j] || '')
        updatedRow[31] = parentId
        await updateRow('Accounts', i, updatedRow)
        linked.push(`${accountName} → ${matchedDistrict} (via ${matchedDomain})`)
      } else {
        const domainList = Array.from(domains).join(', ')
        unlinked.push(`${accountName}: domains=[${domainList}], no match`)
      }
    }

    return NextResponse.json({
      ok: true,
      phase2: log,
      phase3: {
        linked,
        unlinked,
        linkedCount: linked.length,
        unlinkedCount: unlinked.length,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
