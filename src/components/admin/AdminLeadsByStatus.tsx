"use client";
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StatusKey = 'hot' | 'cold'

type SaleItem = {
    leadId: string
    auctionId: string
    companyName: string | null
    revenue: string | null
    contractUrl: string | null
    contractValue: number | null
    contractTime: string | null
    soldAt: string | null
    buyer: { id: string | null; name: string | null; email: string | null } | null
    price: number | null
}

type StatusStats = { count: number; avgSale: number; maxSale: number; totalSale: number; items: SaleItem[] }

const MAX_ROWS = 15

const toNumber = (value: unknown): number | null => {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

const normalizeStats = (raw: unknown): StatusStats => {
    const obj = (raw as StatusStats) || {}
    const items = Array.isArray((obj as { items?: unknown }).items) ? (obj as { items: SaleItem[] }).items : []
    return {
        count: toNumber((obj as { count?: unknown }).count) ?? 0,
        avgSale: toNumber((obj as { avgSale?: unknown }).avgSale) ?? 0,
        maxSale: toNumber((obj as { maxSale?: unknown }).maxSale) ?? 0,
        totalSale: toNumber((obj as { totalSale?: unknown }).totalSale) ?? 0,
        items,
    }
}

const formatBRL = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v)
        ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'N/A'

const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'

const formatBuyer = (buyer: SaleItem['buyer']) => buyer?.name || buyer?.email || 'N/A'

export default function AdminLeadsByStatus({ month }: { month?: string }) {
    const [loading, setLoading] = useState<boolean>(true)
    const [data, setData] = useState<{ hot: StatusStats; cold: StatusStats } | null>(null)

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/finance/by-status${qs}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setData(null)
                } else {
                    const json = await res.json()
                    setData({
                        hot: normalizeStats(json?.hot),
                        cold: normalizeStats(json?.cold),
                    })
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
    }, [month])

    const statuses = useMemo(
        () => [
            { key: 'hot' as StatusKey, label: 'Hot (com contrato)', tone: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700' },
            { key: 'cold' as StatusKey, label: 'Cold (sem contrato)', tone: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700' },
        ],
        [],
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold">Leads vendidos por status</h2>
                <p className="text-sm text-muted-foreground">Divide hot e cold e mostra os contratos mais recentes (foco nos hot).</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {statuses.map(({ key, label, tone, badge }) => {
                    const stats = data?.[key]
                    const items = stats?.items ?? []
                    return (
                        <Card key={key} className={key === 'hot' ? `border ${tone}` : ''}>
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span>{label}</span>
                                    {stats && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
                                            {stats.count} {stats.count === 1 ? 'venda' : 'vendas'}
                                        </span>
                                    )}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    {key === 'hot'
                                        ? 'Leads com contrato enviado. Detalhamento de comprador, valor e momento da venda.'
                                        : 'Leads sem contrato anexado.'}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {loading ? (
                                    <>
                                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                                        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                                        <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
                                        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                                    </>
                                ) : stats ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs uppercase text-muted-foreground">Vendidos</p>
                                                <p className="text-xl font-semibold text-foreground">{stats.count}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase text-muted-foreground">Valor total</p>
                                                <p className="text-xl font-semibold text-foreground">{formatBRL(stats.totalSale)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase text-muted-foreground">Ticket medio</p>
                                                <p className="text-xl font-semibold text-foreground">{formatBRL(stats.avgSale)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase text-muted-foreground">Mais caro</p>
                                                <p className="text-xl font-semibold text-foreground">{formatBRL(stats.maxSale)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>Contratos recentes ({Math.min(items.length, MAX_ROWS)})</span>
                                                <span>Ordenado por data de venda</span>
                                            </div>
                                            <div className="overflow-x-auto rounded-md border">
                                                <table className="w-full text-xs md:text-sm">
                                                    <thead>
                                                        <tr className="border-b text-left">
                                                            <th className="py-2 px-2 whitespace-nowrap">Empresa</th>
                                                            <th className="py-2 px-2 whitespace-nowrap">Comprador</th>
                                                            <th className="py-2 px-2 whitespace-nowrap">Valor</th>
                                                            <th className="py-2 px-2 whitespace-nowrap">Data</th>
                                                            <th className="py-2 px-2 whitespace-nowrap">Receita</th>
                                                            <th className="py-2 px-2 whitespace-nowrap">Contrato</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.length === 0 ? (
                                                            <tr>
                                                                <td className="py-3 px-2 text-muted-foreground" colSpan={6}>Sem vendas nesse status.</td>
                                                            </tr>
                                                        ) : (
                                                            items.slice(0, MAX_ROWS).map(item => {
                                                                const contractLink = item.contractUrl
                                                                return (
                                                                    <tr key={`${item.auctionId}-${item.leadId}`} className="border-b last:border-b-0">
                                                                        <td className="py-2 px-2 truncate max-w-[200px]">{item.companyName || item.leadId}</td>
                                                                        <td className="py-2 px-2 truncate max-w-[200px]">{formatBuyer(item.buyer)}</td>
                                                                        <td className="py-2 px-2 whitespace-nowrap">{formatBRL(item.price)}</td>
                                                                        <td className="py-2 px-2 whitespace-nowrap">{formatDateTime(item.soldAt)}</td>
                                                                        <td className="py-2 px-2 whitespace-nowrap">{item.revenue || 'N/A'}</td>
                                                                        <td className="py-2 px-2 whitespace-nowrap">
                                                                            {contractLink ? (
                                                                                <a
                                                                                    href={contractLink}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="text-blue-600 hover:underline"
                                                                                >
                                                                                    Abrir
                                                                                </a>
                                                                            ) : (
                                                                                'N/A'
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">Sem dados</div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
