# Partner OS

## Overview
Partner OS is an internal CRM/operations tool for managing funder and school/district accounts, contacts, and tasks. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4.

## Tech Stack
- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 via PostCSS
- **APIs:** Google Sheets (via `googleapis`), Anthropic Claude SDK (for AI parsing)
- **Deployment:** Vercel

## Project Structure
```
app/                  # Next.js App Router pages and API routes
  accounts/           # Accounts section (funders + schools/districts)
  contacts/           # Contacts management
  tasks/              # Task management
  api/                # API routes (accounts, contacts, granola-sync, tasks)
components/           # Shared UI components (EditableCell, Modal, Sidebar)
lib/                  # Utilities (ai-parse, granola, sheets)
hooks/                # Custom hooks (useColumnResize)
types/                # TypeScript type definitions
scripts/              # Utility scripts (cleanup-accounts, peek-sheet)
public/               # Static assets
```

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Path Aliases
- `@/*` maps to the project root (e.g., `@/lib/sheets`, `@/components/Modal`)

## Key Patterns
- Google Sheets is used as the data store (see `lib/sheets.ts`)
- AI-powered parsing via Anthropic SDK (see `lib/ai-parse.ts`)
- Granola integration for meeting data (see `lib/granola.ts`)
- Accounts are split into two subgroups: **funders** and **schools/districts**
  - Funders track: ask status, target, committed amount
  - Schools/districts track: goal, principal, engagement level, partner dashboard link, enrollment toolkit, Google Drive file, midpoint date, BOY/MOY/EOY data, assessment name, math & ELA curriculum
