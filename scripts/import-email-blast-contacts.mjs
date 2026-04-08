/**
 * Import contacts from "Contacts for Email Blast" CSV into Partner OS.
 *
 * Usage:
 *   node scripts/import-email-blast-contacts.mjs [--dry-run]
 *
 * Requires the live Vercel API to be deployed (uses fetch against partner-os-five.vercel.app).
 */

const API = 'https://partner-os-five.vercel.app'
const DRY_RUN = process.argv.includes('--dry-run')

// ── Account matching map ────────────────────────────────────────────
// CSV "Partner School" → account name in Partner OS (null = needs new account)
const SCHOOL_TO_ACCOUNT = {
  'John B. Monlux Elementary': 'John B. Monlux Elementary',
  'Kittridge Street Elementary': 'Kittridge Street Elementary',
  'Walnut Park Elementary': 'Walnut Park Elementary',
  'Miles Avenue Elementary': 'Miles Avenue Elementary',
  'Esperanza Elementary': 'Esperanza Elementary',
  'Noble Avenue Elementary': 'Noble Avenue Elementary',
  'Parmelee Avenue Elementary': 'Parmelee Avenue Elementary',
  'Valerio Street Elementary': 'Valerio Street Elementary',
  'Charles W. Barrett Elementary': 'Charles W. Barrett Elementary',
  'Cecil Shamley School': 'Cecil Shamley School',
  'Wood School': 'Wood School',
  'Frank Elementary School': 'Frank Elementary School',
  'Bursch Elementary': 'Bursch Elementary',
  'Dickison Elementary': 'Dickison Elementary',
  'Emerson Elementary': 'Emerson Elementary',
  'Longfellow Elementary': 'Longfellow Elementary',
  'Downtown Value School': 'Downtown Value School',
  'Everest Value': 'Everest Value',
  'Mission Preparatory': 'Mission Preparatory',
  'Cerritos Elementary': 'Cerritos Elementary',
  'Glenoaks Elementary': 'Glenoaks Elementary',
  'Valley View Elementary': 'Valley View Elementary',
  'Da Vinci Connect': 'Da Vinci Connect',
  'Summerdale Elementary': 'Summerdale Elementary',
  'Rocketship Discovery Prep': 'Rocketship Discovery Prep',
  'P.S. / I.S. 171 Patrick Henry': 'P.S. / I.S. 171 Patrick Henry',
  'Anderson Elementary': 'Anderson Elementary',
  'Ricardo Lizarraga Elementary': 'Ricardo Lizarraga Elementary',
  'Monroe Elementary': 'Monroe Elementary',
  'KIPP Academy of Opportunity': 'KIPP Academy of Opportunity',
  'P.S. 330Q Helen M. Marshall School': 'P.S. 330Q Helen M. Marshall School',
  'Riverside Virtual School': 'Riverside Virtual School',
  'Canterbury Avenue Elementary': 'Canterbury Avenue Elementary',
  'KIPP Corazon Academy': 'KIPP Corazon Academy',
  'P.S. 20 Anna Silver': 'P.S. 20 Anna Silver',
  'Tenderloin Community': 'Tenderloin Community',
  // Fuzzy matches
  'Thomas Edison Elementary': 'Thomas Edison Elementary (GUSD)',
  'Equitas Academy #3': 'Equitas Academy #3 Charter',
  'EWS - East End Campus': 'Elsie Whitlow Stokes Community Freedom PCS - East End',
  'EWS Brookland Campus': 'Elsie Whitlow Stokes Community Freedom PCS - Brookland',
  'Hillcrest Elementary': 'Hillcrest Elementary (SFUSD)',
  'Bessie Carmichael': 'Carmichael (Bessie)/FEC',
  'Capital City Middle School': 'Capital City PCS - Middle School',
  'Capital City Lower School': 'Capital City PCS - Lower School',
  '96th Street Elementary': 'Ninety-Sixth Street Elementary (96th Street Elementary)',
  '186th Street Elementary': 'One Hundred Eighty-Sixth Street Elementary (186th Street Elementary)',
  'KIPP Compton': 'KIPP Compton Community School',
  // User-confirmed matches
  'Wright Middle School': 'Orville Wright Engineering and Design Magnet',
  'Santa Clara Unified': 'Dolores Huerta Middle (Santa Clara Unified)',
  // New accounts (created by this script)
  'Guadalupe Elementary School': 'Guadalupe Elementary School',
  'Cambrian School District': 'Cambrian School District',
}

// New accounts to create before importing
const NEW_ACCOUNTS = [
  { name: 'Guadalupe Elementary School', type: 'Current School/District' },
  { name: 'Cambrian School District', type: 'Current School/District' },
]

// ── CSV data (parsed from file) ─────────────────────────────────────
const CONTACTS = [
  { email: 'anna.alagulyan@lausd.net', first: 'Anna', last: 'Alagulyan', school: 'John B. Monlux Elementary', title: 'Tutoring Coordinator' },
  { email: 'annie.gharabagi@lausd.net', first: 'Annie', last: 'Gharabagi', school: 'Kittridge Street Elementary', title: 'Title 1 Coordinator' },
  { email: 'sxs6097@lausd.net', first: 'Sandra', last: 'Sanchez', school: 'Walnut Park Elementary', title: 'TSP Advisor' },
  { email: 'dps9032@lausd.net', first: 'Dianna', last: 'Foster', school: 'Miles Avenue Elementary', title: 'TSP Advisor' },
  { email: 'brumble@lausd.net', first: 'Brad', last: 'Rumble', school: 'Esperanza Elementary', title: 'Principal' },
  { email: 'rudy.x.montes@lausd.net', first: 'Rudy', last: 'Montes', school: 'Noble Avenue Elementary', title: 'Tutoring Advisor' },
  { email: 'bxv5100@lausd.net', first: 'Belinda', last: 'Vargas', school: 'Parmelee Avenue Elementary', title: 'Tutoring Advisor' },
  { email: 'sec9646@lausd.net', first: 'Susana', last: 'Cano', school: 'Valerio Street Elementary', title: 'Tutoring Coordinator' },
  { email: 'kxg9978@lausd.net', first: 'Kisha', last: 'Griggs', school: 'Charles W. Barrett Elementary', title: 'Tutoring Coordinator' },
  { email: 'erika.rioverdegarcia@lausd.net', first: 'Erika', last: 'Rioverde Garcia', school: 'Parmelee Avenue Elementary', title: 'Family Coordinator' },
  { email: 'bronwyn.sternberg@tempeschools.org', first: 'Bronwyn', last: 'Sternberg', school: 'Cecil Shamley School', title: '' },
  { email: 'veronica.hibbert@tempeschools.org', first: 'Veronica', last: 'Hibbert', school: 'Wood School', title: '' },
  { email: 'martha.jacobo.smith@tempeschools.org', first: 'Martha', last: 'Jacobo-Smith', school: 'Frank Elementary School', title: '' },
  { email: 'aprovost@compton.k12.ca.us', first: 'Aisha', last: 'Provost', school: 'Bursch Elementary', title: '' },
  { email: 'imikle@compton.k12.ca.us', first: 'Ikoko', last: 'Mikle', school: 'Dickison Elementary', title: '' },
  { email: 'sosborne-scott@compton.k12.ca.us', first: 'Sherry', last: 'Scott', school: 'Emerson Elementary', title: '' },
  { email: 'anicholson@compton.k12.ca.us', first: 'Anisha', last: 'Nicolson', school: 'Longfellow Elementary', title: '' },
  { email: 'ajason@valueschools.com', first: 'Alex', last: 'Jason', school: 'Downtown Value School', title: '' },
  { email: 'mcornejo@valueschools.com', first: 'Michelle', last: 'Cornejo', school: 'Everest Value', title: '' },
  { email: 'clabrecque@gusd.net', first: 'Carmen', last: 'Labrecque', school: 'Thomas Edison Elementary', title: '' },
  { email: 'cjerez@missionpreparatory.org', first: 'Cynthia', last: 'Jerez', school: 'Mission Preparatory', title: '' },
  { email: 'psimmons@gusd.net', first: 'Patrice', last: 'Simmons', school: 'Cerritos Elementary', title: 'Family Coordinator' },
  { email: 'caroyan@gusd.net', first: 'Christine', last: 'Aroyan', school: 'Glenoaks Elementary', title: 'Principal' },
  { email: 'kstubbs@gusd.net', first: 'Kelly', last: 'Stubbs', school: 'Valley View Elementary', title: '' },
  { email: 'ktoon@davincischools.org', first: 'Kaitlin', last: 'Toon', school: 'Da Vinci Connect', title: 'Principal' },
  { email: 'srainer@busd.net', first: 'Samantha', last: 'Rainer', school: 'Summerdale Elementary', title: 'Principal' },
  { email: 'adoster@rsed.org', first: 'Ayesha', last: 'Doster', school: 'Rocketship Discovery Prep', title: '' },
  { email: 'kbillings@ps171.org', first: 'Kreshna', last: 'Billings', school: 'P.S. / I.S. 171 Patrick Henry', title: 'Principal' },
  { email: 'bzondiros@compton.k12.ca.us', first: 'Barbara', last: 'Zondiros', school: 'Anderson Elementary', title: 'Principal' },
  { email: 'shimj@sfusd.edu', first: 'Jackie', last: 'Shim', school: 'Guadalupe Elementary School', title: 'Instructional Coach' },
  { email: 'abarreragarcia@equitasacademy.org', first: 'Alma', last: 'Barrera-Garcia', school: 'Equitas Academy #3', title: 'Community Schools Coordinator EQ3' },
  { email: 'sxm9839@lausd.net', first: 'Susan', last: 'Montano', school: 'Ricardo Lizarraga Elementary', title: 'Principal' },
  { email: 'rwebb@kippsocal.org', first: 'Rhonda', last: 'Webb', school: 'KIPP Compton', title: '' },
  { email: 'svelasquez@scusd.net', first: 'Sandra', last: 'Velasquez', school: 'Santa Clara Unified', title: '' },
  { email: 'padillal10@x.sfusd.edu', first: 'Laura', last: 'Padilla', school: 'Monroe Elementary', title: '' },
  { email: 'palvarez@kippsocal.org', first: 'Prisma', last: 'Alvarez', school: 'KIPP Academy of Opportunity', title: '' },
  { email: 'mwang7@schools.nyc.gov', first: 'Marisa', last: 'Wang', school: 'P.S. 330Q Helen M. Marshall School', title: '' },
  { email: 'ashantig@ewstokes.org', first: 'Ashanti', last: 'Gordon', school: 'EWS - East End Campus', title: '' },
  { email: 'whitee@cambriansd.com', first: 'Emily', last: 'White', school: 'Cambrian School District', title: '' },
  { email: 'ereid@riversideunified.org', first: 'Erin', last: 'Reid', school: 'Riverside Virtual School', title: '' },
  { email: 'lsevilla@lausd.net', first: 'Luisa', last: 'Sevilla', school: 'Canterbury Avenue Elementary', title: '' },
  { email: 'garciaa4@sfusd.edu', first: 'Araceli', last: 'Garcia', school: 'Hillcrest Elementary', title: '' },
  { email: 'degomez@kippsocal.org', first: 'Denise', last: 'Gomez', school: 'KIPP Corazon Academy', title: '' },
  { email: 'kayla.davis@lausd.net', first: 'Kayla', last: 'Davis', school: 'Wright Middle School', title: '' },
  { email: 'jennifers@ewstokes.org', first: 'Jennifer', last: 'Sloop', school: 'EWS Brookland Campus', title: '' },
  { email: 'tsaia@sfusd.edu', first: 'Ann', last: 'Tsai', school: 'Bessie Carmichael', title: '' },
  { email: 'ggoles@ccpcs.org', first: 'Gregory', last: 'Goles', school: 'Capital City Middle School', title: '' },
  { email: 'brittneyhenderson@ccpcs.org', first: 'Brittney', last: 'Henderson', school: 'Capital City Lower School', title: '' },
  { email: 'chs9365@lausd.net', first: 'Christine', last: 'Sanders', school: '96th Street Elementary', title: '' },
  { email: 'iprieto@lausd.net', first: 'Iris', last: 'Prieto', school: '186th Street Elementary', title: '' },
  { email: 'spinto4@schools.nyc.gov', first: 'Sarah', last: 'Pinto', school: 'P.S. 20 Anna Silver', title: '' },
  { email: 'husseinr@sfusd.edu', first: 'Radwa', last: 'Hussein', school: 'Tenderloin Community', title: '' },
]

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== IMPORTING ===')

  // 1. Fetch existing accounts to build name→id map
  const res = await fetch(`${API}/api/accounts`)
  const accounts = await res.json()
  const accountMap = new Map()
  for (const a of accounts) {
    accountMap.set(a.name, a.id)
  }
  console.log(`Loaded ${accountMap.size} existing accounts`)

  // 2. Create new accounts
  for (const newAcc of NEW_ACCOUNTS) {
    if (accountMap.has(newAcc.name)) {
      console.log(`  Account already exists: ${newAcc.name}`)
      continue
    }
    console.log(`  Creating account: ${newAcc.name}`)
    if (!DRY_RUN) {
      const r = await fetch(`${API}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAcc.name,
          type: newAcc.type,
          region: '',
          priority: 'Medium',
          owner: '',
          lastContactDate: '',
          nextFollowUpDate: '',
          nextAction: '',
          notes: '',
          askStatus: '',
          target: '',
          committedAmount: '',
          goal: '',
          principal: '',
          engagementType: '',
          partnerDashboardLink: '',
          partnerEnrollmentToolkit: '',
          googleDriveFile: '',
          midpointDate: '',
          boyData: '',
          moyData: '',
          eoyData: '',
          assessmentName: '',
          mathCurriculum: '',
          elaCurriculum: '',
          granolaNotesUrl: '',
          obcStatus: '',
          contractCap: '',
          dsaStatus: '',
          district: '',
        }),
      })
      const data = await r.json()
      accountMap.set(newAcc.name, data.id)
      console.log(`    Created with ID: ${data.id}`)
    }
  }

  // 3. Fetch existing contacts to check for duplicates
  const contactRes = await fetch(`${API}/api/contacts`)
  const existingContacts = await contactRes.json()
  const existingEmails = new Set(
    (Array.isArray(existingContacts) ? existingContacts : []).map(c => c.email.toLowerCase())
  )

  // 4. Import contacts
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const c of CONTACTS) {
    const name = `${c.first} ${c.last}`
    const accountName = SCHOOL_TO_ACCOUNT[c.school]

    if (!accountName) {
      console.log(`  SKIP (no mapping): ${name} — ${c.school}`)
      failed++
      continue
    }

    const accountId = accountMap.get(accountName)
    if (!accountId) {
      console.log(`  SKIP (account not found): ${name} — ${accountName}`)
      failed++
      continue
    }

    if (existingEmails.has(c.email.toLowerCase())) {
      console.log(`  SKIP (duplicate email): ${name} — ${c.email}`)
      skipped++
      continue
    }

    console.log(`  Import: ${name} → ${accountName}`)
    if (!DRY_RUN) {
      await fetch(`${API}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accountName,
          name,
          email: c.email,
          phone: '',
          role: c.title,
          notes: 'Imported from Email Blast contacts',
        }),
      })
    }
    imported++
  }

  console.log(`\nDone! Imported: ${imported}, Skipped (duplicate): ${skipped}, Failed: ${failed}`)
}

main().catch(console.error)
