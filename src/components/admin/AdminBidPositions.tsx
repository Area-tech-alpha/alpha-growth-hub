"use client";

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BidPositions = {
    avgSecond: number
    avgThird: number
    countSecond: number
    countThird: number
    auctionsWithSecond: number
    auctionsWithThird: number
}

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

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminBidPositions({ month }: { month?: string }) {
    const [data, setData] = useState<BidPositions | null>(null)
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/finance/bid-positions${qs}`, { cache: 'no-store', signal: controller.signal })
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

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Lances em leilões cold fechados</h2>
                <span className="text-xs text-muted-foreground italic">Média do 2º e 3º lance (ordem que foram enviados)</span>
            </div>
            {loading || !data ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SkeletonCard title="2º lance (média)" />
                    <SkeletonCard title="3º lance (média)" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm text-muted-foreground">2º lance (média)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="text-2xl font-semibold">{formatBRL(data.avgSecond || 0)}</div>
                            <div className="text-xs text-muted-foreground">
                                Leilões com 2º lance: {data.auctionsWithSecond} | Lances coletados: {data.countSecond}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm text-muted-foreground">3º lance (média)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="text-2xl font-semibold">{formatBRL(data.avgThird || 0)}</div>
                            <div className="text-xs text-muted-foreground">
                                Leilões com 3º lance: {data.auctionsWithThird} | Lances coletados: {data.countThird}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
