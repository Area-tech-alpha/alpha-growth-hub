"use client";
import StatsCards from '@/components/dashboard/leiloes/statsCards'
import AdminInvestorsList from './AdminInvestorsList'
import AdminLeadsByType from './AdminLeadsByType'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type FinanceData = { total: number; pix: number; card: number; held: number }

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
    const [data, setData] = useState<FinanceData | null>(null)
    const [monthOptions, setMonthOptions] = useState<string[]>([])
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
                        { title: 'Total recebido', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.total), contentDescription: 'Soma de amount_paid' },
                        { title: 'Recebido via PIX', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.pix), contentDescription: 'Com asaas_payment_id' },
                        { title: 'Recebido via Crédito', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.card), contentDescription: 'Com infinitepay_payment_id' },
                    ]}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Saldo parado na plataforma</h2>
                    {loading || !data ? (
                        <div className="h-10 w-40 bg-muted animate-pulse rounded" />
                    ) : (
                        <div className="rounded-md border p-4 text-2xl font-bold text-yellow-600">{formatBRL(data.held)}</div>
                    )}
                </div>
                <AdminInvestorsList month={selectedMonth} />
            </div>

            <AdminLeadsByType month={selectedMonth} />
        </div>
    )
}


