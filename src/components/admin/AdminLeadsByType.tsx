"use client";
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type TypeStats = { avgSale: number; avgBidPrice: number; maxSale: number; count: number }

export default function AdminLeadsByType({ month }: { month?: string }) {
    const [loading, setLoading] = useState<boolean>(true)
    const [data, setData] = useState<Record<string, TypeStats> | null>(null)

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/finance/by-type${qs}`, { cache: 'no-store', signal: controller.signal })
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
    }, [month])

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const types = [
        { key: 'A', label: 'Tipo A (>60k)', desc: 'Faturamento acima de 60 mil' },
        { key: 'B', label: 'Tipo B (20-60k)', desc: 'Faturamento entre 20 e 60 mil' },
        { key: 'C', label: 'Tipo C (<20k)', desc: 'Faturamento abaixo de 20 mil' },
    ]
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Leads vendidos por tipo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {types.map(({ key, label, desc }) => {
                    const stats = data?.[key]
                    return (
                        <Card key={key}>
                            <CardHeader>
                                <CardTitle className="text-base">{label}</CardTitle>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {loading ? (
                                    <>
                                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                                        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                                    </>
                                ) : stats && stats.count > 0 ? (
                                    <>
                                        <div><span className="font-medium">Vendidos:</span> {stats.count}</div>
                                        <div><span className="font-medium">Média venda:</span> {formatBRL(stats.avgSale)}</div>
                                        <div><span className="font-medium">Média lance:</span> {formatBRL(stats.avgBidPrice)}</div>
                                        <div><span className="font-medium">Mais caro:</span> {formatBRL(stats.maxSale)}</div>
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

