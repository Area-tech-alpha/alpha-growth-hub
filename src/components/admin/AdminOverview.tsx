"use client";
import StatsCards from '@/components/dashboard/leiloes/statsCards'
import { LeadType, getLeadTypeFromRevenue, getRevenueLabelsForLeadType } from '@/lib/revenueBands'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

type Ranked = { userId: string | null; count: number; name?: string | null; email?: string | null }
type RecentLead = {
    id: string;
    company_name: string | null;
    created_at: string | Date | null;
    revenue: string | null;
    sold: boolean;
    type: 'hot' | 'cold';
    leadType: LeadType | null;
    buyer: { id: string | null; name: string | null; email: string | null } | null;
    price: number | null;
    bids_count: number;
    minimum_bid: number | null;
}

type TimelineSummary = {
    label: string;
    soldCount: number;
    unsoldCount: number;
    averageTicket: number | null;
}

type TimelineInvestments = {
    month: { label: string; average: number | null };
    week: { label: string; average: number | null };
}

type TimelineData = {
    items: RecentLead[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    summary: TimelineSummary;
    investments: TimelineInvestments;
}

type WeekOption = { value: string; label: string }
type RangeMode = 'all' | 'monthly' | 'weekly' | 'daily'
type LeadTypeFilterValue = LeadType | ''

const TIMELINE_PAGE_SIZE = 10
const isLeadTypeValue = (value: unknown): value is LeadType => value === 'A' || value === 'B' || value === 'C'

const formatCurrency = (value: number | null | undefined) =>
    typeof value === 'number'
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—'

const normalizeNumber = (value: unknown, fallback: number | null = null): number | null =>
    typeof value === 'number' && !Number.isNaN(value) ? value : fallback

const pad = (value: number) => String(value).padStart(2, '0')

const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const startOfLocalWeek = (date: Date) => {
    const clone = new Date(date)
    clone.setHours(0, 0, 0, 0)
    const day = clone.getDay() // 0 dom ... 6 sab
    const diff = day === 0 ? 6 : day - 1
    clone.setDate(clone.getDate() - diff)
    return clone
}

const formatWeekWindow = (start: Date, end: Date) =>
    `${pad(start.getDate())}/${pad(start.getMonth() + 1)} - ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`

const buildWeekOptions = (slots = 8): WeekOption[] => {
    const base = startOfLocalWeek(new Date())
    return Array.from({ length: slots }).map((_, idx) => {
        const start = new Date(base)
        start.setDate(start.getDate() - idx * 7)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        return {
            value: toIsoDate(start),
            label: formatWeekWindow(start, end),
        }
    })
}

const getCurrentWeekValue = () => toIsoDate(startOfLocalWeek(new Date()))
const getCurrentDayValue = () => toIsoDate(new Date())

export default function AdminOverview() {
    const weekOptions = useMemo(() => buildWeekOptions(10), [])
    const [rangeMode, setRangeMode] = useState<RangeMode>('all')
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [selectedWeek, setSelectedWeek] = useState<string>(() => getCurrentWeekValue())
    const [selectedDay, setSelectedDay] = useState<string>(() => getCurrentDayValue())
    const [selectedFinanceFilter, setSelectedFinanceFilter] = useState<string>('')
    const [monthOptions, setMonthOptions] = useState<string[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [counts, setCounts] = useState<{ entered: number; sold: number } | null>(null)
    const [topBuyers, setTopBuyers] = useState<Ranked[]>([])
    const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
    const [timelineLoading, setTimelineLoading] = useState<boolean>(false)
    const [timelinePage, setTimelinePage] = useState<number>(1)
    const [timelineError, setTimelineError] = useState<string | null>(null)
    const [timelineReloadKey, setTimelineReloadKey] = useState<number>(0)
    const financeOptionGroups = useMemo(
        () => (
            ['A', 'B', 'C'] as LeadType[]
        ).map(typeValue => ({
            type: typeValue,
            bands: getRevenueLabelsForLeadType(typeValue),
        })),
        [],
    )
    const activeLeadType = useMemo<LeadTypeFilterValue>(() => {
        if (!selectedFinanceFilter) return ''
        if (selectedFinanceFilter.startsWith('type:')) {
            const candidate = selectedFinanceFilter.split(':')[1]
            return isLeadTypeValue(candidate) ? candidate : ''
        }
        if (selectedFinanceFilter.startsWith('band:')) {
            const label = selectedFinanceFilter.slice('band:'.length)
            const derived = getLeadTypeFromRevenue(label)
            return derived ?? ''
        }
        return ''
    }, [selectedFinanceFilter])
    const activeRevenueBand = useMemo(() => {
        if (!selectedFinanceFilter) return ''
        if (selectedFinanceFilter.startsWith('band:')) {
            return selectedFinanceFilter.slice('band:'.length)
        }
        return ''
    }, [selectedFinanceFilter])
    const formatMonthLabel = (yyyyMm: string) => {
        const [yyyy, mm] = yyyyMm.split('-')
        const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
        const idx = parseInt(mm, 10) - 1
        return `${monthNames[idx] ?? mm}/${yyyy.slice(2)}`
    }

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
        if (rangeMode === 'monthly' && !selectedMonth && monthOptions.length) {
            setSelectedMonth(monthOptions[0])
        }
    }, [rangeMode, selectedMonth, monthOptions])

    useEffect(() => {
        if (rangeMode === 'weekly' && !selectedWeek) {
            setSelectedWeek(getCurrentWeekValue())
        }
    }, [rangeMode, selectedWeek])

    useEffect(() => {
        if (rangeMode === 'daily' && !selectedDay) {
            setSelectedDay(getCurrentDayValue())
        }
    }, [rangeMode, selectedDay])

    useEffect(() => {
        setTimelinePage(1)
    }, [rangeMode, selectedMonth, selectedWeek, selectedDay, selectedFinanceFilter])

    const buildRangeParams = useCallback(() => {
        const params = new URLSearchParams()
        if (rangeMode === 'monthly') {
            if (selectedMonth) params.set('month', selectedMonth)
            params.set('range', 'monthly')
        } else if (rangeMode === 'weekly') {
            params.set('range', 'weekly')
            if (selectedWeek) params.set('weekStart', selectedWeek)
        } else if (rangeMode === 'daily') {
            params.set('range', 'daily')
            if (selectedDay) params.set('day', selectedDay)
        }
        return params
    }, [rangeMode, selectedMonth, selectedWeek, selectedDay])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function fetchTimeline() {
            try {
                setTimelineLoading(true)
                setTimelineError(null)
                const params = buildRangeParams()
                params.set('page', String(timelinePage))
                params.set('pageSize', String(TIMELINE_PAGE_SIZE))
                if (activeRevenueBand) params.append('revenueBand', activeRevenueBand)
                if (activeLeadType) params.set('leadType', activeLeadType)
                const query = params.toString()
                const res = await fetch(`/api/admin/leads/recent?${query}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) throw new Error('Erro ao carregar leads')
                const data = await res.json()
                const items = Array.isArray(data.items) ? data.items : []
                const paginationRaw = typeof data.pagination === 'object' && data.pagination !== null ? data.pagination : {}
                const summaryRaw = typeof data.summary === 'object' && data.summary !== null ? data.summary : {}
                const investmentsRaw = typeof data.investments === 'object' && data.investments !== null ? data.investments : {}
                setTimelineData({
                    items: items.map((it: RecentLead) => ({
                        ...it,
                        created_at: it.created_at ? new Date(it.created_at).toISOString() : null,
                        price: normalizeNumber(it.price),
                        minimum_bid: normalizeNumber(it.minimum_bid),
                        bids_count: typeof it.bids_count === 'number' && !Number.isNaN(it.bids_count) ? it.bids_count : 0,
                        revenue: typeof it.revenue === 'string' ? it.revenue : null,
                        leadType: isLeadTypeValue(it.leadType) ? it.leadType : null,
                    })),
                    pagination: {
                        page: Number(paginationRaw.page) || timelinePage,
                        pageSize: Number(paginationRaw.pageSize) || TIMELINE_PAGE_SIZE,
                        total: Number(paginationRaw.total) || items.length,
                        totalPages: Number(paginationRaw.totalPages) || 1,
                    },
                    summary: {
                        label: typeof summaryRaw.label === 'string' ? summaryRaw.label : 'Período selecionado',
                        soldCount: Number(summaryRaw.soldCount) || 0,
                        unsoldCount: Number(summaryRaw.unsoldCount) || 0,
                        averageTicket: typeof summaryRaw.averageTicket === 'number' ? summaryRaw.averageTicket : null,
                    },
                    investments: {
                        month: {
                            label: investmentsRaw.month?.label ?? 'Mês atual',
                            average: typeof investmentsRaw.month?.average === 'number' ? investmentsRaw.month.average : null,
                        },
                        week: {
                            label: investmentsRaw.week?.label ?? 'Semana atual',
                            average: typeof investmentsRaw.week?.average === 'number' ? investmentsRaw.week.average : null,
                        },
                    },
                })
            } catch (error) {
                if (!active) return
                if ((error as Error).name === 'AbortError') return
                setTimelineError('Não foi possível carregar os leads')
                setTimelineData(null)
            } finally {
                if (active) setTimelineLoading(false)
            }
        }
        fetchTimeline()
        return () => {
            active = false
            controller.abort()
        }
    }, [buildRangeParams, timelinePage, timelineReloadKey, activeRevenueBand, activeLeadType])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const params = buildRangeParams()
                const qs = params.toString()
                const res = await fetch(`/api/admin/leads${qs ? `?${qs}` : ''}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setCounts({ entered: 0, sold: 0 })
                    setTopBuyers([])
                } else {
                    const data = await res.json()
                    const entered = Array.isArray(data.leadsEntered) ? data.leadsEntered.length : 0
                    const sold = Array.isArray(data.leadsSold) ? data.leadsSold.length : 0
                    setCounts({ entered, sold })
                    setTopBuyers(Array.isArray(data.topBuyers) ? data.topBuyers : [])
                }
            } catch {
                if (!active) return
                setCounts({ entered: 0, sold: 0 })
                setTopBuyers([])
            } finally {
                if (active) setLoading(false)
            }
        }
        run()
        return () => { active = false; controller.abort() }
    }, [buildRangeParams])

    const handleRefresh = () => {
        setTimelineReloadKey(prev => prev + 1)
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const params = buildRangeParams()
                const qs = params.toString()
                const res = await fetch(`/api/admin/leads${qs ? `?${qs}` : ''}`, { cache: 'no-store', signal: controller.signal })
                if (res.ok) {
                    const data = await res.json()
                    const entered = Array.isArray(data.leadsEntered) ? data.leadsEntered.length : 0
                    const sold = Array.isArray(data.leadsSold) ? data.leadsSold.length : 0
                    setCounts({ entered, sold })
                    setTopBuyers(Array.isArray(data.topBuyers) ? data.topBuyers : [])
                }
            } catch {
                // ignore
            } finally {
                setLoading(false)
            }
        }
        run()
    }

    const timelineItems = timelineData?.items ?? []
    const timelinePagination = timelineData?.pagination ?? { page: timelinePage, pageSize: TIMELINE_PAGE_SIZE, total: 0, totalPages: 1 }
    const summary = timelineData?.summary
    const investments = timelineData?.investments
    const summaryDifference = (summary?.soldCount ?? 0) - (summary?.unsoldCount ?? 0)
    const showSummarySkeleton = timelineLoading || !timelineData
    const showListSkeleton = timelineLoading
    const disablePrevPage = timelinePagination.page <= 1 || timelineLoading
    const disableNextPage = timelinePagination.page >= timelinePagination.totalPages || timelinePagination.total === 0 || timelineLoading

    const handlePrevPage = () => {
        if (disablePrevPage) return
        setTimelinePage(prev => Math.max(1, prev - 1))
    }

    const handleNextPage = () => {
        if (disableNextPage) return
        const maxPage = timelinePagination.totalPages || 1
        setTimelinePage(prev => Math.min(maxPage, prev + 1))
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Visão geral</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm text-muted-foreground">Período</label>
                    <select
                        className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                        value={rangeMode}
                        onChange={e => setRangeMode(e.target.value as RangeMode)}
                        disabled={loading}
                    >
                        <option value="all">Geral</option>
                        <option value="monthly">Mensal</option>
                        <option value="weekly">Semanal</option>
                        <option value="daily">Diário</option>
                    </select>
                    {rangeMode === 'monthly' && (
                        <select
                            className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            disabled={loading || monthOptions.length === 0}
                        >
                            {monthOptions.length === 0 ? (
                                <option value="">Sem meses disponíveis</option>
                            ) : (
                                monthOptions.map(m => (
                                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                                ))
                            )}
                        </select>
                    )}
                    {rangeMode === 'weekly' && (
                        <select
                            className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(e.target.value)}
                            disabled={loading}
                        >
                            {weekOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    )}
                    {rangeMode === 'daily' && (
                        <input
                            type="date"
                            className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                            value={selectedDay || ''}
                            onChange={e => setSelectedDay(e.target.value)}
                            disabled={loading}
                        />
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="h-9 px-3 rounded-md border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="Atualizar dados"
                    >
                        ↻
                    </button>
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
            </div>

            <div className="space-y-4">
                <div>
                    <h2 className="text-base font-semibold">Linha do tempo completa</h2>
                    <p className="text-sm text-muted-foreground">Os dados abaixo seguem o mesmo filtro aplicado na seção de visão geral.</p>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex flex-col gap-1 text-sm">
                        <span className="text-xs uppercase text-muted-foreground">Tipo / faixa de faturamento</span>
                        <select
                            className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                            value={selectedFinanceFilter}
                            onChange={e => setSelectedFinanceFilter(e.target.value)}
                            disabled={timelineLoading}
                        >
                            <option value="">Todos os tipos e faixas</option>
                            {financeOptionGroups.map(group => (
                                <Fragment key={group.type}>
                                    <option
                                        value={`type:${group.type}`}
                                        style={{ fontWeight: 'bold' }}
                                    >
                                        Tipo {group.type}
                                    </option>
                                    {group.bands.map(label => (
                                        <option key={`${group.type}-${label}`} value={`band:${label}`}>
                                            {`${label}`}
                                        </option>
                                    ))}
                                </Fragment>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {showSummarySkeleton ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                            <div key={`timeline-summary-skeleton-${idx}`} className="h-28 animate-pulse rounded-md border bg-muted" />
                        ))
                    ) : (
                        <>
                            <div className="rounded-md border p-4 space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">Resumo do período</p>
                                    <p className="text-lg font-semibold">{summary?.label ?? 'Período selecionado'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs uppercase text-muted-foreground">Comprados</p>
                                        <p className="text-2xl font-bold text-foreground">{summary?.soldCount ?? 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase text-muted-foreground">Não comprados</p>
                                        <p className="text-2xl font-bold text-foreground">{summary?.unsoldCount ?? 0}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Diferença (C - NC)</span>
                                    <span className="font-medium text-foreground">{summaryDifference}</span>
                                </div>
                            </div>
                            <div className="rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">Ticket médio no período</p>
                                <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary?.averageTicket ?? null)}</p>
                                <p className="text-xs text-muted-foreground">{summary?.label ?? 'Período selecionado'}</p>
                            </div>
                            <div className="rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">Investimento médio semanal</p>
                                <p className="text-2xl font-semibold text-foreground">{formatCurrency(investments?.week?.average ?? null)}</p>
                                <p className="text-xs text-muted-foreground">{investments?.week?.label ?? 'Semana atual'}</p>
                            </div>
                            <div className="rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">Investimento médio mensal</p>
                                <p className="text-2xl font-semibold text-foreground">{formatCurrency(investments?.month?.average ?? null)}</p>
                                <p className="text-xs text-muted-foreground">{investments?.month?.label ?? 'Mês atual'}</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="rounded-md border">
                        {showListSkeleton ? (
                            Array.from({ length: 4 }).map((_, idx) => (
                                <div key={`timeline-list-skeleton-${idx}`} className="p-4">
                                    <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                                </div>
                            ))
                        ) : timelineError ? (
                            <div className="p-4 text-sm text-destructive">{timelineError}</div>
                        ) : timelineItems.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">Sem eventos para o período selecionado</div>
                        ) : (
                            <ul className="divide-y">
                                {timelineItems.map(item => (
                                    <li key={item.id} className="flex flex-col gap-1 p-4 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium truncate">{item.company_name || item.id}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'hot' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {item.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'sem data'}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span>
                                                Faturamento: <strong className="text-foreground">{item.revenue || 'Não informado'}</strong>
                                            </span>
                                            <span>
                                                Tipo financeiro: <strong className="text-foreground">{item.leadType || '—'}</strong>
                                            </span>
                                        </div>
                                        <div className="mt-1">
                                            {item.sold ? (
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className="text-green-700 bg-green-100 text-xs px-2 py-0.5 rounded">Vendido</span>
                                                    <span className="text-xs">Comprador: <strong>{item.buyer?.name || item.buyer?.email || item.buyer?.id || 'desconhecido'}</strong></span>
                                                    <span className="text-xs">Valor: <strong>{formatCurrency(item.price)}</strong></span>
                                                    <span className="text-xs">Lances: <strong>{item.bids_count}</strong></span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className="text-yellow-700 bg-yellow-100 text-xs px-2 py-0.5 rounded">Não vendido</span>
                                                    {item.minimum_bid != null && (
                                                        <span className="text-xs">Lance mínimo: <strong>{formatCurrency(item.minimum_bid)}</strong></span>
                                                    )}
                                                    <span className="text-xs">Lances: <strong>{item.bids_count}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                        <div className="text-muted-foreground">
                            Página {timelinePagination.page} de {timelinePagination.totalPages} • {timelinePagination.total} leads
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={disablePrevPage}
                                className="h-9 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={disableNextPage}
                                className="h-9 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


