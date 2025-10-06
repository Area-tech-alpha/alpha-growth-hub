"use client";
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SummaryData = { count: number; total: number; avg: number; max: number }

export default function AdminSoldSummary({ month }: { month?: string }) {
    const [loading, setLoading] = useState<boolean>(true)
    const [data, setData] = useState<SummaryData | null>(null)

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/finance/sold-summary${qs}`, { cache: 'no-store', signal: controller.signal })
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Resumo geral de vendas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {loading ? (
                    <>
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                        <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
                    </>
                ) : data ? (
                    <>
                        <div><span className="font-medium">Total vendidos:</span> {data.count}</div>
                        <div><span className="font-medium">Valor total:</span> {formatBRL(data.total)}</div>
                        <div><span className="font-medium">Média:</span> {formatBRL(data.avg)}</div>
                        <div><span className="font-medium">Mais caro:</span> {formatBRL(data.max)}</div>
                    </>
                ) : (
                    <div className="text-muted-foreground">Sem dados</div>
                )}
            </CardContent>
        </Card>
    )
}

