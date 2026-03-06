import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
import type { Account } from '@/types'

function rowToAccount(row: string[]): Account {
  return {
    id: row[0] || '',
    name: row[1] || '',
    type: (row[2] || '') as Account['type'],
    region: row[3] || '',
    priority: (row[4] || '') as Account['priority'],
    owner: (row[5] || '') as Account['owner'],
    lastContactDate: row[6] || '',
    nextFollowUpDate: row[7] || '',
    nextAction: row[8] || '',
    notes: row[9] || '',
  }
}

function accountToRow(account: Omit<Account, 'id'>, id: string): string[] {
  return [
    id,
    account.name,
    account.type,
    account.region,
    account.priority,
    account.owner,
    account.lastContactDate,
    account.nextFollowUpDate,
    account.nextAction,
    account.notes,
  ]
}

export async function GET() {
  try {
    const rows = await getRows('Accounts')
    const accounts = rows.filter((r) => r[0]).map(rowToAccount)
    return NextResponse.json(accounts)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Account, 'id'> | Omit<Account, 'id'>[] = await req.json()
    const items = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const id = crypto.randomUUID()
      await appendRow('Accounts', accountToRow(item, id))
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
