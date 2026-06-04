'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import EditableCell from '@/components/EditableCell'
import ColumnToggle from '@/components/ColumnToggle'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import type { Account, Opportunity, Confidence } from '@/types'
import { SCHOOL_TYPES, OPPORTUNITY_STAGES } from '@/types'
import { forecastAmount } from '@/lib/forecast'
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react'

type SortKey =
  | '_partner'
  | '_partnerType'
  | '_level'
  | 'stage'
  | 'projectedAmount'
  | 'confidence'
  | '_forecast'
  | 'closedWonExpected'

type SortDir = 'asc' | 'desc'

const COLUMNS: [SortKey, string][] = [
  ['_partner', 'Partner'],
  ['_partnerType', 'New or Current Partner'],
  ['_level', 'Type'],
  ['stage', 'Stage'],
  ['projectedAmount', 'Projected'],
  ['confidence', 'Confidence'],
  ['_forecast', 'Forecast'],
  ['closedWonExpected', 'Closed Won Expected'],
]

const LEVEL_COLORS: Record<string, string> = {
  District: 'bg-blue-100 text-blue-700',
  CMO: 'bg-orange-100 text-orange-700',
  School: 'bg-gray-100 text-gray-600',
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function RevenuePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('_partner')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { widths, onMouseDown } = useColumnResize(COLUMNS.length, 140)
  const { hiddenKeys, toggle: toggleColumn, isVisible } = useColumnVisibility('revenue', [])

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/opportunities').then((r) => r.json()),
      fetch('/api/regions').then((r) => r.json()),
    ])
      .then(([accountData, oppData, regionData]) => {
        setAccounts(Array.isArray(accountData) ? accountData : [])
        setOpportunities(Array.isArray(oppData) ? oppData : [])
        setRegions((Array.isArray(regionData) ? regionData : []).map((r: { regionName: string }) => r.regionName).sort())
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load revenue pipeline')
        setLoading(false)
      })
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const accountById = useMemo(() => {
    const map: Record<string, Account> = {}
    for (const a of accounts) map[a.id] = a
    return map
  }, [accounts])

  type Row = {
    opp: Opportunity
    account: Account
    forecast: number
  }

  const rows = useMemo<Row[]>(() => {
    return opportunities
      .map((opp) => {
        const account = accountById[opp.accountId]
        if (!account || !SCHOOL_TYPES.includes(account.type)) return null
        return { opp, account, forecast: forecastAmount(opp) }
      })
      .filter((r): r is Row => r !== null)
  }, [opportunities, accountById])

  const filtered = useMemo<Row[]>(() => {
    let list = rows
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.account.name.toLowerCase().includes(q))
    }
    if (filterRegion) list = list.filter((r) => r.account.region === filterRegion)
    if (filterStage) list = list.filter((r) => r.opp.stage === filterStage)

    const dir = sortDir === 'asc' ? 1 : -1
    const cmp = (a: Row, b: Row): number => {
      switch (sortKey) {
        case '_partner': return a.account.name.localeCompare(b.account.name) * dir
        case '_partnerType': return (a.account.type || '').localeCompare(b.account.type || '') * dir
        case '_level': return (a.account.accountLevel || '').localeCompare(b.account.accountLevel || '') * dir
        case 'stage': {
          const ai = a.opp.stage ? OPPORTUNITY_STAGES.indexOf(a.opp.stage) : -1
          const bi = b.opp.stage ? OPPORTUNITY_STAGES.indexOf(b.opp.stage) : -1
          return (ai - bi) * dir
        }
        case 'projectedAmount': return (Number(a.opp.projectedAmount) - Number(b.opp.projectedAmount)) * dir
        case 'confidence': return (a.opp.confidence - b.opp.confidence) * dir
        case '_forecast': return (a.forecast - b.forecast) * dir
        case 'closedWonExpected': return (a.opp.closedWonExpected || '').localeCompare(b.opp.closedWonExpected || '') * dir
      }
    }
    return [...list].sort(cmp)
  }, [rows, search, filterRegion, filterStage, sortKey, sortDir])

  const totals = useMemo(() => {
    let projected = 0
    let forecast = 0
    for (const r of filtered) {
      const p = Number(r.opp.projectedAmount)
      if (Number.isFinite(p)) projected += p
      forecast += r.forecast
    }
    return { projected, forecast }
  }, [filtered])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-indigo-500" />
    ) : (
      <ChevronDown size={12} className="text-indigo-500" />
    )
  }

  function exportCSV() {
    const headers = ['Partner', 'Stage', 'Projected Amount', 'Confidence', 'Forecast', 'Closed Won Expected', 'Contract Type']
    const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = filtered.map(({ opp, account, forecast }) => [
      escape(account.name),
      escape(opp.stage),
      escape(opp.projectedAmount),
      escape(opp.confidence),
      escape(forecast),
      escape(opp.closedWonExpected),
      escape(opp.contractType),
    ].join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'opportunities.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveOppField(opp: Opportunity, field: keyof Opportunity, value: string | number) {
    const prev = opportunities
    const updated = { ...opp, [field]: value } as Opportunity
    setOpportunities(opportunities.map((o) => o.id === opp.id ? updated : o))
    try {
      const res = await fetch(`/api/opportunities/${opp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) { setOpportunities(prev); setToast('Failed to save. Please try again.') }
    } catch { setOpportunities(prev); setToast('Failed to save. Please try again.') }
  }

  const hasFilters = search || filterRegion || filterStage

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} of {rows.length} {rows.length === 1 ? 'opportunity' : 'opportunities'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search partner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Stages</option>
          {OPPORTUNITY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterRegion(''); setFilterStage('') }}
            className="text-sm text-gray-400 hover:text-gray-600 px-2"
          >
            Clear filters
          </button>
        )}
        <ColumnToggle
          columns={COLUMNS.map(([key, label]) => ({ key, label }))}
          hiddenKeys={hiddenKeys}
          onToggle={toggleColumn}
          alwaysVisible={['_partner']}
        />
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {rows.length === 0 ? 'No opportunities yet.' : 'No opportunities match the filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {COLUMNS.map(([key, label], i) => isVisible(key) && (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      style={{ width: widths[i], minWidth: widths[i] }}
                      className={`relative text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${
                        key === '_partner' ? 'sticky left-0 z-10 bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); onMouseDown(i, e) }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-20"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(({ opp, account, forecast }) => {
                  const projectedNum = Number(opp.projectedAmount)
                  const cells: Record<SortKey, React.ReactNode> = {
                    _partner: (
                      <Link href={`/accounts/schools/${account.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                        {account.name}
                      </Link>
                    ),
                    _partnerType: (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {account.type || '—'}
                      </span>
                    ),
                    _level: account.accountLevel ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[account.accountLevel] || 'bg-gray-100 text-gray-600'}`}>
                        {account.accountLevel}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    ),
                    stage: (
                      <EditableCell value={opp.stage} fieldType="select" options={[...OPPORTUNITY_STAGES]} onSave={(v) => saveOppField(opp, 'stage', v)}>
                        <span className="text-gray-700">{opp.stage || '—'}</span>
                      </EditableCell>
                    ),
                    projectedAmount: (
                      <EditableCell value={opp.projectedAmount} fieldType="number" onSave={(v) => saveOppField(opp, 'projectedAmount', v)}>
                        <span className="text-gray-900">
                          {Number.isFinite(projectedNum) && opp.projectedAmount ? formatCurrency(projectedNum) : '—'}
                        </span>
                      </EditableCell>
                    ),
                    confidence: (
                      <EditableCell value={String(opp.confidence)} fieldType="select" options={['1', '2', '3']} onSave={(v) => saveOppField(opp, 'confidence', Number(v) as Confidence)}>
                        <span className="text-gray-700">{opp.confidence}</span>
                      </EditableCell>
                    ),
                    _forecast: (
                      <span className="text-gray-700">{forecast > 0 ? formatCurrency(forecast) : '—'}</span>
                    ),
                    closedWonExpected: (
                      <EditableCell value={opp.closedWonExpected} fieldType="date" onSave={(v) => saveOppField(opp, 'closedWonExpected', v)}>
                        <span className="text-gray-700">{formatDate(opp.closedWonExpected)}</span>
                      </EditableCell>
                    ),
                  }
                  return (
                    <tr key={opp.id} className="hover:bg-gray-50 group">
                      {COLUMNS.map(([key], i) => isVisible(key) && (
                        <td
                          key={key}
                          style={{ width: widths[i], minWidth: widths[i], maxWidth: widths[i] }}
                          className={`px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap ${
                            key === '_partner' ? 'sticky left-0 z-10 bg-white group-hover:bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                          }`}
                        >
                          {cells[key]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
                  {COLUMNS.map(([key], i) => isVisible(key) && (
                    <td
                      key={key}
                      style={{ width: widths[i], minWidth: widths[i], maxWidth: widths[i] }}
                      className={`px-4 py-3 whitespace-nowrap ${
                        key === '_partner' ? 'sticky left-0 z-10 bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200' : ''
                      }`}
                    >
                      {key === '_partner' ? 'Totals' :
                       key === 'projectedAmount' ? formatCurrency(totals.projected) :
                       key === '_forecast' ? formatCurrency(totals.forecast) :
                       ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
