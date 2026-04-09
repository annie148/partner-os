# Partner OS

## Overview
Partner OS is an internal CRM/operations tool for Step Up Tutoring, managing funder and school/district accounts, contacts, and tasks. Google Sheets is the data store. Granola meeting notes are synced via AI parsing to automatically update accounts and create tasks.

## Tech Stack
- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 via PostCSS
- **Data Store:** Google Sheets (via `googleapis`)
- **AI:** Anthropic Claude SDK (`@anthropic-ai/sdk`) — used for parsing meeting notes
- **Meeting Notes:** Granola API — fetches meeting notes with transcripts/summaries
- **Email:** Gmail API (via `googleapis`) — task assignment notifications, due-date reminders, daily digests
- **Testing:** Playwright (chromium, smoke tests against live site)
- **Deployment:** Vercel (use `vercel --prod` from CLI; GitHub auto-deploy is unreliable)

## Project Structure
```
app/
  page.tsx                    # Dashboard (3 stat cards: Overdue Tasks, Due This Week, Total Accounts; Sync Granola button; auto-generates follow-up tasks)
  layout.tsx                  # Root layout with Sidebar
  globals.css                 # Global styles
  accounts/
    page.tsx                  # All accounts table (sortable, filterable, inline-editable, Level column)
    [id]/page.tsx             # Account detail + contacts for that account
    funders/page.tsx          # Funder-only view with ask status, target, committed amount
    funders/[id]/page.tsx     # Funder detail
    schools/page.tsx          # School/district view — Level filter (District/CMO/School), unified or filtered by ?level=
    schools/[id]/page.tsx     # School/district detail
  contacts/page.tsx           # Contact management (auto-link, seed from accounts)
  tasks/
    page.tsx                  # Task management (4 statuses: Not Started, In Progress, Blocked, Complete)
    [id]/page.tsx             # Task detail
  regions/
    page.tsx                  # Region management
    [name]/page.tsx           # Region detail
  api/
    accounts/route.ts         # GET all, POST create (returns { id } for new accounts)
    accounts/[id]/route.ts    # PUT update, DELETE
    contacts/route.ts         # GET all, POST create
    contacts/[id]/route.ts    # PUT update, DELETE
    contacts/auto-link/route.ts       # POST: fuzzy-match unlinked contacts to accounts
    contacts/seed-from-accounts/route.ts  # POST: create contacts from account principals
    tasks/route.ts            # GET all, POST create (sends email notification to assignee)
    tasks/[id]/route.ts       # PUT update, DELETE
    activities/route.ts       # GET all, POST create (auto-creates Activity tab if missing)
    granola-sync/route.ts     # POST: sync Granola meeting notes (cron + manual)
    regions/route.ts          # GET all, POST create
    regions/[name]/route.ts   # PUT update, DELETE
    regions/setup/route.ts    # POST: region initialization
    rename-region/route.ts    # POST: rename region
    auth/gmail/route.ts       # Gmail OAuth flow
    auth/gmail/callback/route.ts  # Gmail OAuth callback
    send-daily-digest/route.ts    # GET: morning digest email with team-wide visibility (cron)
    send-eod-summary/route.ts     # GET: end-of-day summary with completed + outstanding tasks (cron)
    email-drafts/route.ts     # Email draft management (DISABLED — UI and Granola draft creation commented out)
    generate-followup-tasks/route.ts  # POST: auto-create Follow-up tasks from overdue account follow-up dates (dedup: skips if Follow-up completed within 7 days)
    import-district-data/route.ts  # District data import
    backfill-regions/route.ts      # Region backfill
    seed-districts/route.ts        # Seed district data
    seed-account-levels/route.ts   # Seed account levels
    migrate-school-types/route.ts  # One-time migration: GET=dry-run, POST=apply (batch update)
    import-regional-priorities/route.ts  # One-time import: regional goals + tasks from planning doc (2026-03-24)
components/
  Modal.tsx                   # Reusable modal (sizes: sm, md, lg, xl)
  EditableCell.tsx            # Inline cell editing (text, select, date, number, textarea)
  Sidebar.tsx                 # Navigation sidebar with accounts subnav and schools/districts level subtabs
  SearchableSelect.tsx        # Dropdown with search/filter
  ColumnToggle.tsx            # Column visibility control
  NotesDisplay.tsx            # Rich notes renderer (markdown, auto-linked URLs, collapsible)
  ActivityLog.tsx             # Activity log component (add/view activities, used on account detail pages)
lib/
  date.ts                     # Pacific timezone helpers (todayPacific, offsetDaysPacific, isWeekdayPacific)
  sheets.ts                   # Google Sheets API wrapper (getRows, appendRow, updateRow, deleteRow)
  ai-parse.ts                 # Claude-powered meeting note parsing
  granola.ts                  # Granola API client (fetch notes, get content)
  gmail.ts                    # Gmail API (task emails, reminders, daily digests)
hooks/
  useColumnResize.ts          # Drag-to-resize table columns
  useColumnVisibility.ts      # LocalStorage-based column show/hide toggle
types/index.ts                # All TypeScript types (Account, Contact, Task, Activity, Region, enums) + shared SCHOOL_TYPES constant
tests/
  qa-smoke.spec.ts            # Playwright smoke tests (9 tests against live site)
.github/
  workflows/qa.yml            # CI: run smoke tests on push to main
```

## Commands
- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run qa` — Run Playwright QA smoke tests against the live site
- `vercel --prod` — Deploy to production (preferred over git push, see Deployment section)

## QA Smoke Tests
- **Framework:** Playwright (chromium only)
- **Config:** `playwright.config.ts` — runs against `BASE_URL` env var (defaults to https://partner-os-five.vercel.app)
- **Tests:** `tests/qa-smoke.spec.ts` — 9 tests covering Accounts (list, filters, Add form with Level), Tasks (list, status filter for all 4 statuses, detail page), Dashboard, Regions (list + detail), Funders
- **Run locally:** `npm run qa` (requires `npx playwright install chromium` first)
- **CI:** `.github/workflows/qa.yml` runs on push to main after a 60s deploy wait. On failure: uploads Playwright report as artifact and posts to Slack (requires `SLACK_WEBHOOK_URL` secret in GitHub)
- Screenshots captured automatically on test failure

## Path Aliases
- `@/*` maps to project root (e.g., `@/lib/sheets`, `@/components/Modal`)

## Deployment
- **Repo:** `github.com/annie148/partner-os`
- **Hosting:** Vercel
- **IMPORTANT:** GitHub auto-deploy has been unreliable (pushes to main don't always trigger builds). Use `vercel --prod` from the CLI to deploy reliably.
- **Crons** (via Vercel cron in `vercel.json`):
  - Granola sync: daily at 8am UTC (`/api/granola-sync`)
  - Morning digest: daily at 2pm UTC / 7am PT (`/api/send-daily-digest`)
  - EOD summary: daily at midnight UTC / 5pm PT (`/api/send-eod-summary`)
- **Cron auth:** Routes accept `x-vercel-cron-auth-token` header (Vercel's built-in mechanism) or `Authorization: Bearer <CRON_SECRET>`, or requests with `origin`/`referer` headers (browser/dashboard). The `CRON_SECRET` env var must be set in Vercel for cron jobs to authenticate.

## Environment Variables
- `GOOGLE_SERVICE_ACCOUNT_KEY` — JSON service account key (Vercel converts `\n` in env vars; code re-escapes in `lib/sheets.ts`)
- `GRANOLA_API_KEY` — Bearer token for Granola API
- `ANTHROPIC_API_KEY` — Used by `@anthropic-ai/sdk` (auto-detected)
- `CRON_SECRET` — Required for Vercel cron job authentication (set in Vercel production env)
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` — OAuth credentials for Gmail API (task emails, reminders, digests)

---

## Google Sheets Data Store

**Sheet ID:** `1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs`

### Tabs & Column Mappings

**Accounts** (41 fields — columns extend beyond Z):
| Index | Column | Field |
|-------|--------|-------|
| 0 | A | id (UUID) |
| 1 | B | name |
| 2 | C | type |
| 3 | D | region |
| 4 | E | priority |
| 5 | F | owner |
| 6 | G | lastContactDate |
| 7 | H | nextFollowUpDate |
| 8 | I | nextAction |
| 9 | J | notes |
| 10-12 | K-M | askStatus, target, committedAmount (funder fields) |
| 13-25 | N-Z | goal, principal, engagementType, links, dates, data, curriculum, granolaNotesUrl, obcStatus, contractCap, dsaStatus, district, parentDistrictId |
| 26-39 | AA-AN | accountLevel, mouStatus, dataReceived, districtAssessmentMath, districtAssessmentReading, testWindow, matchedStudents, assessmentFollowUpNotes |
| 40 | AO | contractSigned (date, schools/districts only) |

**Contacts** (columns A-H): id, accountId, accountName, name, email, phone, role, notes

**Tasks** (columns A-K): id, accountId, accountName, title, assignee, dueDate, status, notes, region, completedDate, type
- Task types: `Follow-up` | `Outreach` | `Internal` | `Other` (default: `Other` for existing tasks)
- Follow-up tasks are auto-generated from overdue account `nextFollowUpDate` via `POST /api/generate-followup-tasks` (called on dashboard load). Deduplicates: skips if an open Follow-up task already exists for that account.

**Regions** (columns A-F): regionName, regionGoalSY26, regionGoalSY27, currentStatus, openQuestions, nextMoves

**Activity** (columns A-G): id, accountId, date, type, description, loggedBy, sourceId
- Activity types: `Call` | `Email` | `Meeting` | `Note` | `Other`
- Tab is auto-created on first use (GET returns empty array, POST creates it)
- `sourceId` stores the Granola note ID for auto-logged activities (used for deduplication)
- Activity log is available on school/district detail pages, funder detail pages, AND region detail pages
- For region activities, `accountId` stores the region name (not an account UUID)

**GranolaSync** (columns A-D): noteId, title, matchedAccount, processedAt

### Gotchas & Known Issues

1. **Sparse rows:** Google Sheets API returns rows truncated at the last non-empty cell. A row with data only in columns A-G comes back as a 7-element array. If you then do `row[9]` to read notes, you get `undefined`. **Always pad rows before writing:** `Array.from({ length: 26 }, (_, i) => row[i] || '')`

2. **Row indexing:** `getRows()` strips the header row (`rows.slice(1)`) and returns 0-based data rows. `updateRow()` adds +2 to the index (1-based + header). `deleteRow()` adds +1. These offsets are easy to get wrong.

3. **Newline handling in env vars:** Vercel converts `\n` sequences in environment variables to actual newlines, breaking JSON.parse. `lib/sheets.ts` re-escapes with `.replace(/\n/g, '\\n')` before parsing.

4. **No transactions:** Sheets API has no atomic updates. If the sync updates an account row and then fails creating tasks, data can be partially written.

5. **Denormalized names:** `accountName` is stored on Contacts and Tasks. If an account is renamed, these become stale. No cascade update exists.

6. **Local Google Sheets auth broken:** The service account private key is PKCS#1 (`RSA PRIVATE KEY`) format. Node.js 20 with OpenSSL 3 cannot sign with PKCS#1 keys (`ERR_OSSL_UNSUPPORTED`). Scripts like `peek-sheet.mjs` and `migrate-school-types.mjs` fail locally. **Workaround:** Use API routes deployed to Vercel (whose runtime handles the key format) instead of local scripts for any Sheets operations. Alternatively, convert the key to PKCS#8 format in `.env.local`.

7. **Sheets API rate limits:** Updating many rows individually can exceed the per-minute write quota. Use `batchUpdate` for bulk operations (see `migrate-school-types/route.ts` for an example).

8. **Timezone: always use Pacific time for dates.** Vercel runs in UTC. `new Date().toISOString().split('T')[0]` returns the UTC date, which diverges from Pacific time after 5pm PT. Use `todayPacific()` from `lib/date.ts` instead. This caused a bug where task completions and digest emails used mismatched dates.

---

## Email System

### How It Works
Emails are sent via Gmail API using OAuth (`lib/gmail.ts`). Three types:

1. **Task assignment** — sent immediately when a task is created via `POST /api/tasks`. Notifies the assignee.
2. **Morning digest** — cron at 2pm UTC / 7am PT, **weekdays only**. Each recipient sees their own tasks (overdue, due today, due this week) at the top, followed by a "Team Tasks" section showing all other team members' tasks grouped by person.
3. **EOD summary** — cron at midnight UTC / 5pm PT, **weekdays only**. Sent to all team members. Section 1: "Completed Today" shows tasks marked Complete today, grouped by owner. Section 2: "Still Outstanding" shows all incomplete tasks grouped by owner with overdue highlighting. Uses `completedDate` field on tasks (auto-set when status changes to Complete).

### Team Email Map (`lib/gmail.ts`)
- Annie: annie@stepuptutoring.org
- Genesis: genesis@stepuptutoring.org
- Sam: sam@stepuptutoring.org
- Gab: gabriella@stepuptutoring.org
- **Krissy: not configured** — tasks assigned to Krissy skip email silently

### Manual Testing
Cron routes can be triggered manually via curl with a Referer header:
```
curl -H "Referer: https://partner-os-five.vercel.app" https://partner-os-five.vercel.app/api/send-daily-digest
curl -H "Referer: https://partner-os-five.vercel.app" https://partner-os-five.vercel.app/api/send-eod-summary
```

---

## Granola Sync — How It Works

### Flow (app/api/granola-sync/route.ts)
1. Fetch recent notes from Granola API (last **168 hours / 7 days**)
2. Check each note against `GranolaSync` sheet — skip already-processed
3. Extract content via `getNoteContent()` (prefers markdown > plain text > transcript)
4. Send content to Claude AI to parse: organization name, summary, action items
5. Match to an account:
   - **Step 1:** Fuzzy match AI-extracted org name against account names
   - **Step 2 (fallback):** Check if meeting attendees/title/content match any contact linked to an account
6. If matched: update account's `lastContactDate`, append summary to `notes`, create tasks for action items, auto-log a Meeting activity on the account (with `[Granola]` prefix and sourceId for deduplication)
7. Mark note as processed in `GranolaSync` sheet

### Diagnostic Output
The sync response includes detailed per-note info:
```json
{
  "totalNotes": 80,
  "synced": 3,
  "skipped": 75,
  "noContent": 2,
  "noMatch": 0,
  "results": [
    {
      "noteId": "...",
      "title": "Annie/Amanda",
      "status": "synced | skipped-already-processed | skipped-no-content | no-account-match",
      "matched": "Account Name or null",
      "tasks": 2,
      "summary": "...",
      "contentFields": { "has_summary": true, "has_notes": false, "has_transcript": true },
      "contentLength": 1234,
      "nextStepsLength": 245,
      "actionItems": ["Send calendar invite", "Follow up on rostering"]
    }
  ]
}
```

---

## Data Types

### Account Types — Funders
`Prospective Funder` | `Current Funder` | `Former Funder` | `Declined Funder` | `Other - Funder`

### Account Types — Schools/Districts
`Prospective` | `Current Partner` | `Indirect Partner` | `Declined Partner` | `Past Partner` | `Other - Education`

The canonical list is exported as `SCHOOL_TYPES` from `types/index.ts` — all pages import from there.

### Account Level
`District` | `CMO` | `School` | (empty string)

Available on the Add/Edit Account form and as an inline-editable column on the Accounts list page. Color coded: blue for District, orange for CMO, gray for School.

### Ask Status (Funders)
`Committed` | `Submitted/Ask Made` | `Declined` | `Need to Qualify` | `Cultivating` | `Received` | `No Ask`

### Engagement Type (Schools)
`High Level` | `Medium Level` | `Low Level`

### Priority
`High` | `Medium` | `Low`

### Owner
`Annie` | `Genesis` | `Sam` | `Gab` | `Krissy`

### Task Status
`Not Started` | `In Progress` | `Blocked` | `Complete`

Color coding: gray (Not Started), blue (In Progress), orange/amber (Blocked), green (Complete). `STATUS_COLORS` is defined in each file that displays task badges. Default filter on the Tasks page shows Not Started, In Progress, and Blocked (hides Complete).

### Task Type
`Follow-up` | `Outreach` | `Internal` | `Other`

Color coding: purple (Follow-up), sky (Outreach), gray (Internal), light gray (Other). Type badges shown on dashboard task lists and tasks table. Editable inline and in task form.

### Regions
`AZ` | `Bay Area` | `DC` | `LA` | `National` | `NY` | `SF` | `San Jose`

SF and San Jose were split out from Bay Area (2026-03-24). Bay Area remains as a separate region.

---

## Sidebar Navigation
```
Dashboard
Accounts
  +-- Funders            -> /accounts/funders
  +-- Schools/Districts  -> /accounts/schools (unified view)
      +-- Schools        -> /accounts/schools?level=School
      +-- Districts      -> /accounts/schools?level=District
Regions
Contacts
Tasks
```
- Schools/Districts subtabs filter by `accountLevel` via query param
- The unified view (`/accounts/schools` with no param) shows all school/district records regardless of level
- Sidebar uses `useSearchParams` for active-state highlighting; wrapped in `<Suspense>` in `layout.tsx`

## UI Patterns
- **Inline editing:** All fields across the app use `EditableCell` — click to edit, Enter/blur to save, Escape to cancel. This applies to table cells on list pages AND all fields on detail pages (account name, type, region, priority, owner, dates, URLs, notes, etc.). URL fields display as clickable links but enter edit mode on click. Granola Notes URL is always shown (not conditionally hidden). **Optimistic updates:** Inline edits update local React state immediately and fire the API call in the background — no full page re-fetch. If the API call fails, state is reverted and a toast error is shown. This allows rapid sequential editing without scroll resets or flicker. `load()` is only called for form submissions, deletions, and bulk operations.
- **Modals:** Used for create/edit forms, delete confirmation, import preview
- **Color coding:** Priority (red/yellow/green), type (blue for funders, purple for schools), account level (blue/orange/gray), task status (gray/blue/orange/green), overdue dates in red
- **Column resizing:** Drag column borders in account tables (`useColumnResize` hook)
- **Column visibility:** Toggle columns on/off via `ColumnToggle` component (`useColumnVisibility` hook, persisted to localStorage)
- **Searchable dropdowns:** `SearchableSelect` for filtered option selection
- **Sticky first column:** Account name column stays visible on horizontal scroll
- **Overdue indicators:** Follow-up dates and task due dates turn red when past due
- **Notes display:** `NotesDisplay` component renders markdown (bold, italic, bullet lists, links), auto-detects and linkifies URLs (shortened display), collapses long notes (3+ lines) with "Show more" toggle. Used on task detail, account detail (funder + school), and region detail pages. Edit mode shows raw text in auto-resizing textarea.

## Key Code Patterns
- All IDs are UUIDs via `crypto.randomUUID()`
- Dates stored as `YYYY-MM-DD` strings
- No global state — each page fetches its own data on mount
- `load()` function pattern: fetch data, setState, called on mount and after form submissions/deletes (NOT after inline edits — those use optimistic state updates with `res.ok` rollback)
- API routes use `rowToX()` / `xToRow()` helpers to convert between objects and sheet arrays
- Components using `useSearchParams` must be wrapped in `<Suspense>` (Next.js requirement for static prerendering)
- `STATUS_COLORS` for task badges is defined locally in each file that renders them (tasks/page, tasks/[id], accounts/schools/[id], accounts/funders/[id]) rather than shared

## Known Issues
- Column resize can crash with "Cannot read properties of null (reading 'index')" error; refreshing clears it. Likely a stale ref or event handler cleanup issue.
- Granola sync pulls meeting summaries but does not reliably extract discrete action items/next steps as tasks.
- Krissy has no email configured in `lib/gmail.ts` TEAM_EMAILS; task assignment and digest emails are silently skipped for her.

## Disabled Features
- **Email Drafts** — The Pending Email Drafts banner on the Tasks page and the Granola sync draft creation are commented out. The API route (`/api/email-drafts`) and Gmail draft functions (`lib/gmail.ts`) still exist but are not called. To re-enable: search for "Email drafts feature disabled" comments in `app/tasks/page.tsx` and `app/api/granola-sync/route.ts`.

## Important Implementation Notes
- **All server-side date logic uses Pacific time** via `lib/date.ts` helpers (`todayPacific`, `offsetDaysPacific`, `isWeekdayPacific`). This is critical because Vercel runs in UTC — using `new Date().toISOString()` for date comparisons will produce wrong results for Pacific-timezone users. Always use the `lib/date.ts` helpers for "today" calculations in API routes.
- **Optimistic updates must check `res.ok`** — `fetch().catch()` only catches network errors, not HTTP 4xx/5xx responses. All task PUT callers check `res.ok` and rollback + show a toast on failure. Follow this pattern for any new optimistic update code.
