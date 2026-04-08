import { NextRequest, NextResponse } from 'next/server'
import { getRows, updateRow, deleteRow } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const { from, to } = await req.json()
    if (!from || !to) return NextResponse.json({ error: 'Need from and to' }, { status: 400 })

    // Update all accounts with the old region
    const accountRows = await getRows('Accounts')
    const updated: string[] = []
    for (let i = 0; i < accountRows.length; i++) {
      const row = accountRows[i]
      if (row[0] && row[3] === from) {
        const updatedRow = Array.from({ length: 40 }, (_, j) => row[j] || '')
        updatedRow[3] = to
        await updateRow('Accounts', i, updatedRow)
        updated.push(row[1])
      }
    }

    // Delete the old region row from Regions sheet
    const regionRows = await getRows('Regions')
    const oldIdx = regionRows.findIndex((r) => r[0] === from)
    if (oldIdx !== -1) {
      await deleteRow('Regions', oldIdx)
    }

    return NextResponse.json({ ok: true, updated, count: updated.length, deletedRegionRow: oldIdx !== -1 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
