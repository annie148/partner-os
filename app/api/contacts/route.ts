import { NextRequest, NextResponse } from 'next/server'
import { getRows, appendRow } from '@/lib/sheets'
import type { Contact } from '@/types'

function rowToContact(row: string[]): Contact {
  return {
    id: row[0] || '',
    accountId: row[1] || '',
    accountName: row[2] || '',
    name: row[3] || '',
    email: row[4] || '',
    phone: row[5] || '',
    role: row[6] || '',
    notes: row[7] || '',
  }
}

export async function GET() {
  try {
    const rows = await getRows('Contacts')
    const contacts = rows.filter((r) => r[0]).map(rowToContact)
    return NextResponse.json(contacts)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Contact, 'id'> = await req.json()
    const id = crypto.randomUUID()
    await appendRow('Contacts', [
      id,
      body.accountId,
      body.accountName,
      body.name,
      body.email,
      body.phone,
      body.role,
      body.notes,
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
