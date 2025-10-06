"use client";
import StatsCards from '@/components/dashboard/leiloes/statsCards'
import { useEffect, useState } from 'react'

type Ranked = { userId: string | null; count: number; name?: string | null; email?: string | null }

export default function AdminOverview() {
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [counts, setCounts] = useState<{ entered: number; sold: number } | null>(null)
    const [topBuyers, setTopBuyers] = useState<Ranked[]>([])
    const [topBidders, setTopBidders] = useState<Ranked[]>([])
    const [monthOptions, setMonthOptions] = useState<string[]>([])

    // Fetch available months from backend
    useEffect(() => {
        let active = true
        async function fetchMonths() {
            try {
                const res = await fetch('/api/admin/available-months?source=leads', { cache: 'no-store' })
                if (!active) return
                if (res.ok) {
                    const data = await res.json()
                    setMonthOptions(Array.isArray(data.months) ? data.months : [])
                }
            } catch {
                if (!active) return
            }
        }
        fetchMonths()
        return () => { active = false }
    }, [])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = selectedMonth ? `?month=${selectedMonth}` : ''
                const res = await fetch(`/api/admin/leads${qs}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setCounts({ entered: 0, sold: 0 })
                    setTopBuyers([])
                    setTopBidders([])
                } else {
                    const data = await res.json()
                    const entered = Array.isArray(data.leadsEntered) ? data.leadsEntered.length : 0
                    const sold = Array.isArray(data.leadsSold) ? data.leadsSold.length : 0
                    setCounts({ entered, sold })
                    setTopBuyers(Array.isArray(data.topBuyers) ? data.topBuyers : [])
                    setTopBidders(Array.isArray(data.topBidders) ? data.topBidders : [])
                }
            } catch {
                if (!active) return
                setCounts({ entered: 0, sold: 0 })
                setTopBuyers([])
                setTopBidders([])
            } finally {
                if (active) setLoading(false)
            }
        }
        run()
        return () => { active = false; controller.abort() }
    }, [selectedMonth])

    const formatMonthLabel = (yyyyMm: string) => {
        const [yyyy, mm] = yyyyMm.split('-')
        const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
        const idx = parseInt(mm, 10) - 1
        return `${monthNames[idx] ?? mm}/${yyyy.slice(2)}`
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Visão geral</h2>
                    <p className="text-sm text-muted-foreground">Filtre por mês para analisar períodos.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm">Mês</label>
                    <select
                        className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        disabled={loading}
                    >
                        <option value="">Geral</option>
                        {monthOptions.map(m => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading || !counts ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-24 bg-muted animate-pulse rounded" />
                    <div className="h-24 bg-muted animate-pulse rounded" />
                    <div className="h-24 bg-muted animate-pulse rounded" />
                </div>
            ) : (
                <StatsCards
                    items={[
                        { title: 'Leads que entraram', icon: <span className="text-yellow-600">⬤</span>, contentTitle: String(counts.entered), contentDescription: 'Total de leads que entraram' },
                        { title: 'Leads vendidos', icon: <span className="text-yellow-600">⬤</span>, contentTitle: String(counts.sold), contentDescription: 'Total de leads vendidos' },
                    ]}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top compradores</h2>
                    <ul className="divide-y rounded-md border">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <li key={`tb-sk-${i}`} className="p-3"><div className="h-4 w-1/2 bg-muted animate-pulse rounded" /></li>
                            ))
                        ) : (topBuyers ?? []).length > 0 ? (
                            (topBuyers ?? []).map((b, idx) => (
                                <li key={`buyer-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                    <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                    <span className="font-medium">{b.count}</span>
                                </li>
                            ))
                        ) : (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top lances</h2>
                    <ul className="divide-y rounded-md border">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <li key={`tl-sk-${i}`} className="p-3"><div className="h-4 w-1/2 bg-muted animate-pulse rounded" /></li>
                            ))
                        ) : (topBidders ?? []).length > 0 ? (
                            (topBidders ?? []).map((b, idx) => (
                                <li key={`bidder-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                    <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                    <span className="font-medium">{b.count}</span>
                                </li>
                            ))
                        ) : (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    )
}


