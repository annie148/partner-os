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
- **Deployment:** Vercel (auto-deploy from GitHub was unreliable — use `vercel --prod` from CLI)

## Project Structure
```
app/
  page.tsx                    # Dashboard (stats, overdue items, Sync Granola button)
  layout.tsx                  # Root layout with Sidebar
  globals.css                 # Global styles
  accounts/
    page.tsx                  # All accounts table (sortable, filterable, inline-editable)
    [id]/page.tsx             # Account detail + contacts for that account
    funders/page.tsx          # Funder-only view with ask status, target, committed amount
    schools/page.tsx          # School/district view with engagement, data, curriculum fields
  contacts/page.tsx           # Contact management (auto-link, seed from accounts)
  tasks/page.tsx              # Task management
  api/
    accounts/route.ts         # GET all, POST create (returns { id } for new accounts)
    accounts/[id]/route.ts    # PUT update, DELETE
    contacts/route.ts         # GET all, POST create
    contacts/[id]/route.ts    # PUT update, DELETE
    contacts/auto-link/route.ts       # POST: fuzzy-match unlinked contacts to accounts
    contacts/seed-from-accounts/route.ts  # POST: create contacts from account principals
    tasks/route.ts            # GET all, POST create
    tasks/[id]/route.ts       # PUT update, DELETE
    granola-sync/route.ts     # POST/GET: sync Granola meeting notes
components/
  Modal.tsx                   # Reusable modal (sizes: sm, md, lg, xl)
  EditableCell.tsx            # Inline cell editing (text, select, date, number)
  Sidebar.tsx                 # Navigation sidebar with accounts subnav
lib/
  sheets.ts                   # Google Sheets API wrapper (getRows, appendRow, updateRow, deleteRow)
  ai-parse.ts                 # Claude-powered meeting note parsing
  granola.ts                  # Granola API client (fetch notes, get content)
hooks/
  useColumnResize.ts          # Drag-to-resize table columns
types/index.ts                # All TypeScript types (Account, Contact, Task, enums)
scripts/
  cleanup-accounts.mjs        # Data migration script
  peek-sheet.mjs              # Debug script to inspect sheet contents
```

## Commands
- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `vercel --prod` — Deploy to production (preferred over git push, see Deployment section)

## Path Aliases
- `@/*` maps to project root (e.g., `@/lib/sheets`, `@/components/Modal`)

## Deployment
- **Repo:** `github.com/annie148/partner-os`
- **Hosting:** Vercel
- **IMPORTANT:** GitHub auto-deploy has been unreliable (pushes to main don't always trigger builds). Use `vercel --prod` from the CLI to deploy reliably.
- **Cron:** Granola sync runs daily at 8am UTC via Vercel cron (`vercel.json`)
- **Cron auth:** Uses `CRON_SECRET` env var as Bearer token

## Environment Variables
- `GOOGLE_SERVICE_ACCOUNT_KEY` — JSON service account key (Vercel converts `\n` in env vars; code re-escapes in `lib/sheets.ts`)
- `GRANOLA_API_KEY` — Bearer token for Granola API
- `ANTHROPIC_API_KEY` — Used by `@anthropic-ai/sdk` (auto-detected)
- `CRON_SECRET` — Optional, for authenticating Vercel cron requests

---

## Google Sheets Data Store

**Sheet ID:** `1zM5CZ6FXF-17LY0zTntuPQ5boWdXGnhmC-1y64y2Bgs`

### Tabs & Column Mappings

**Accounts** (columns A-Z, 26 total):
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
| 13-25 | N-Z | goal, principal, engagementType, links, dates, data, curriculum (school fields) |

**Contacts** (columns A-H): id, accountId, accountName, name, email, phone, role, notes

**Tasks** (columns A-H): id, accountId, accountName, title, assignee, dueDate, status, notes

**GranolaSync** (columns A-D): noteId, title, matchedAccount, processedAt

### Gotchas & Known Issues

1. **Sparse rows:** Google Sheets API returns rows truncated at the last non-empty cell. A row with data only in columns A-G comes back as a 7-element array. If you then do `row[9]` to read notes, you get `undefined`. **Always pad rows before writing:** `Array.from({ length: 26 }, (_, i) => row[i] || '')`

2. **Row indexing:** `getRows()` strips the header row (`rows.slice(1)`) and returns 0-based data rows. `updateRow()` adds +2 to the index (1-based + header). `deleteRow()` adds +1. These offsets are easy to get wrong.

3. **Newline handling in env vars:** Vercel converts `\n` sequences in environment variables to actual newlines, breaking JSON.parse. `lib/sheets.ts` re-escapes with `.replace(/\n/g, '\\n')` before parsing.

4. **No transactions:** Sheets API has no atomic updates. If the sync updates an account row and then fails creating tasks, data can be partially written.

5. **Denormalized names:** `accountName` is stored on Contacts and Tasks. If an account is renamed, these become stale. No cascade update exists.

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
6. If matched: update account's `lastContactDate`, append summary to `notes`, create tasks for action items
7. Mark note as processed in `GranolaSync` sheet

### What's Working
- Basic sync flow executes and returns 200
- `lastContactDate` updates correctly on matched accounts
- AI parsing extracts action items from meeting content
- Deduplication via GranolaSync sheet prevents re-processing
- Dashboard shows detailed per-note sync results

### What's Been Tried / Current Issues

**Problem: Action items not syncing from Granola**
- Root cause 1: `getNoteContent()` originally preferred `summary_text` which strips structured sections like action items. **Fixed:** Now prefers `summary_markdown` / `notes` / `notes_markdown`.
- Root cause 2: `fetchNoteById()` only requested `include=transcript`. **Fixed:** Now requests `include=transcript,notes`.
- Root cause 3: Granola API may return content under `notes`, `notes_markdown`, `summary_markdown`, or `summary_text` — it's unclear which field is consistently populated. **Added all fields** to the interface and `getNoteContent()` checks them in order.
- **Still investigating:** Content may still come back empty for some notes. The sync response now includes `contentFields` diagnostics per note to help debug.

**Problem: Notes not appearing for specific contacts (e.g., Amanda Steigman)**
- Root cause 1: Sync window was 24 hours; meeting was older. **Fixed:** Increased to 168 hours (7 days).
- Root cause 2: Amanda was a standalone contact not linked to an account, so org-name matching failed. **Fixed:** Added contact-based matching as fallback (checks attendees, title, content against linked contacts).
- Root cause 3: Vercel auto-deploy from GitHub wasn't triggering — code changes weren't actually live. **Fixed:** Now deploying via `vercel --prod` CLI.
- **Still investigating:** Even after fixes, the Amanda meeting may not sync if content fields are empty from the API. Need to check `contentFields` in sync response.

**Problem: Sparse row data loss on update**
- Google Sheets returns short arrays for rows with trailing empty cells. Writing back a short array could blank out columns. **Fixed:** Pad to 26 columns before writing.

### Diagnostic Output
The sync response now includes detailed per-note info:
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
      "contentFields": {
        "has_notes": false,
        "has_notes_markdown": false,
        "has_summary_markdown": true,
        "has_summary_text": true,
        "has_transcript": true
      },
      "contentLength": 1234
    }
  ]
}
```

---

## Data Types

### Account Types
`Prospective Funder` | `Current Funder` | `Former Funder` | `Declined Funder` | `Prospective School/District` | `Current School/District` | `Former School/District` | `Declined School/District`

### Ask Status (Funders)
`Committed` | `Submitted/Ask Made` | `Declined` | `Need to Qualify` | `Cultivating` | `Received` | `No Ask`

### Engagement Type (Schools)
`High Level` | `Medium Level` | `Low Level`

### Priority
`High` | `Medium` | `Low`

### Owner
`Annie` | `Sam` | `Gab`

### Task Status
`Not Started` | `In Progress` | `Complete`

### Regions
`Bay Area` | `DC` | `LA` | `National` | `NY`

---

## UI Patterns
- **Inline editing:** All table cells use `EditableCell` — click to edit, Enter to save, Escape to cancel
- **Modals:** Used for create/edit forms, delete confirmation, import preview
- **Color coding:** Priority (red/yellow/green), type (blue for funders, purple for schools), status badges, overdue dates in red
- **Column resizing:** Drag column borders in account tables (`useColumnResize` hook)
- **Sticky first column:** Account name column stays visible on horizontal scroll
- **Overdue indicators:** Follow-up dates and task due dates turn red when past due

## Key Code Patterns
- All IDs are UUIDs via `crypto.randomUUID()`
- Dates stored as `YYYY-MM-DD` strings
- No global state — each page fetches its own data on mount
- `load()` function pattern: fetch data, setState, called on mount and after mutations
- API routes use `rowToX()` / `xToRow()` helpers to convert between objects and sheet arrays
