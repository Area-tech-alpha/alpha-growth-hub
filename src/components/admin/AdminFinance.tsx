"use client";
import StatsCards from '@/components/dashboard/leiloes/statsCards'
import AdminInvestorsList from './AdminInvestorsList'
import AdminLeadsByType from './AdminLeadsByType'
import AdminLeadsByStatus from './AdminLeadsByStatus'
import AdminSoldSummary from './AdminSoldSummary'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type FinanceData = { total: number; pix: number; card: number; held: number }
type BySource = { [k: string]: { amountPaid: number; credits: number; count?: number } }

function SkeletonCard({ title }: { title: string }) {
    return (
        <Card>
            <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-7 w-32 bg-muted animate-pulse rounded" />
                <div className="mt-1 h-4 w-44 bg-muted animate-pulse rounded" />
            </CardContent>
        </Card>
    )
}

export default function AdminFinance() {
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [data, setData] = useState<(FinanceData & { bySource?: BySource }) | null>(null)
    const [monthOptions, setMonthOptions] = useState<string[]>([])
    const [heldByUser, setHeldByUser] = useState<{ userId: string; name: string | null; email: string | null; balance: number }[]>([])
    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    // Fetch available months from backend
    useEffect(() => {
        let active = true
        async function fetchMonths() {
            try {
                const res = await fetch('/api/admin/available-months?source=finance', { cache: 'no-store' })
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
                const res = await fetch(`/api/admin/finance${qs}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setData(null)
                } else {
                    const json = await res.json()
                    setData(json)
                }
            } catch {
                if (!active) return
                setData(null)
            } finally {
                if (active) setLoading(false)
            }
        }
        run()
        return () => { active = false; controller.abort() }
    }, [selectedMonth])

    // Fetch held by user (no filter)
    useEffect(() => {
        let active = true
        async function fetchHeld() {
            try {
                const res = await fetch('/api/admin/finance/held-by-user', { cache: 'no-store' })
                if (!active) return
                if (res.ok) {
                    const json = await res.json()
                    setHeldByUser(Array.isArray(json.users) ? json.users : [])
                }
            } catch {
                if (!active) return
            }
        }
        fetchHeld()
        return () => { active = false }
    }, [])

    const formatMonthLabel = (yyyyMm: string) => {
        const [yyyy, mm] = yyyyMm.split('-')
        const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
        const idx = parseInt(mm, 10) - 1
        return `${monthNames[idx] ?? mm}/${yyyy.slice(2)}`
    }

    const handleRefresh = () => {
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = selectedMonth ? `?month=${selectedMonth}` : ''
                const res = await fetch(`/api/admin/finance${qs}`, { cache: 'no-store', signal: controller.signal })
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch {
                // ignore
            } finally {
                setLoading(false)
            }
        }
        run()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Financeiro</h2>
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

            {loading || !data ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SkeletonCard title="Total recebido" />
                    <SkeletonCard title="Recebido via PIX" />
                    <SkeletonCard title="Recebido via Crédito" />
                </div>
            ) : (
                <StatsCards
                    items={[
                        { title: 'Total recebido', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.total), contentDescription: '' },
                        { title: 'Recebido via PIX', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.pix), contentDescription: '' },
                        { title: 'Recebido via Crédito', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.card), contentDescription: '' },
                    ]}
                />
            )}

            {/* Por origem */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">Por origem</h2>
                    <span className="text-xs text-muted-foreground italic">(monetário em R$, demais em créditos)</span>
                </div>
                {loading || !data ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <SkeletonCard title="Monetário (R$)" />
                        <SkeletonCard title="Recompensa (créditos)" />
                        <SkeletonCard title="Ajuste (créditos)" />
                        <SkeletonCard title="Outros (créditos)" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm text-muted-foreground">Monetário (R$)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{formatBRL(data.bySource?.monetary?.amountPaid || 0)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm text-muted-foreground">Recompensa (créditos)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{(data.bySource?.reward?.credits || 0).toLocaleString('pt-BR')}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm text-muted-foreground">Estorno (créditos)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{(data.bySource?.adjustment?.credits || 0).toLocaleString('pt-BR')}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm text-muted-foreground">Outros (créditos)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{(data.bySource?.unknown?.credits || 0).toLocaleString('pt-BR')}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">Saldo parado na plataforma</h2>
                    <span className="text-xs text-muted-foreground italic">(filtros não se aplicam)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Total geral</div>
                        {loading || !data ? (
                            <div className="h-10 w-40 bg-muted animate-pulse rounded" />
                        ) : (
                            <div className="rounded-md border p-4 text-2xl font-bold text-yellow-600">{formatBRL(data.held)}</div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Top 10 usuários</div>
                        <ul className="divide-y rounded-md border max-h-60 overflow-y-auto">
                            {heldByUser.length > 0 ? (
                                heldByUser.map((u, idx) => (
                                    <li key={`held-${u.userId}-${idx}`} className="flex items-center justify-between p-2 text-sm">
                                        <span className="truncate max-w-[60%]">{u.name || u.email || u.userId || '—'}</span>
                                        <span className="font-medium text-yellow-600">{formatBRL(u.balance)}</span>
                                    </li>
                                ))
                            ) : (
                                <li className="p-2 text-sm text-muted-foreground">Sem dados</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AdminInvestorsList month={selectedMonth} />
                <AdminSoldSummary month={selectedMonth} />
            </div>

            <AdminLeadsByType month={selectedMonth} />
            <AdminLeadsByStatus month={selectedMonth} />
        </div>
    )
}
