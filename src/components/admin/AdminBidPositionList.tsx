"use client";

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BidPositionItem = {
    auctionId: string
    amount: number
    position: number
    createdAt: string | null
    user: { id: string; name: string | null; email: string | null }
}

function SkeletonRow({ cols = 6 }: { cols?: number }) {
    return (
        <tr>
            <td colSpan={cols} className="py-2">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
            </td>
        </tr>
    )
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminBidPositionList({ month }: { month?: string }) {
    const [items, setItems] = useState<BidPositionItem[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const secondItems = useMemo(() => items.filter(i => i.position === 2), [items])
    const thirdItems = useMemo(() => items.filter(i => i.position === 3), [items])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                setError(null)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/finance/bid-positions/list${qs}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setItems([])
                    setError('Não foi possível carregar os lances.')
                } else {
                    const json = await res.json()
                    setItems(Array.isArray(json.items) ? json.items : [])
                }
            } catch (err) {
                if (!active) return
                if (err instanceof DOMException && err.name === 'AbortError') return
                setItems([])
                setError('Erro ao carregar os lances.')
            } finally {
                if (active) setLoading(false)
            }
        }
        run()
        return () => { active = false; controller.abort() }
    }, [month])

    const renderTable = (title: string, list: BidPositionItem[], positionLabel: string) => (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b">
                            <th className="py-2 pr-2">Posição</th>
                            <th className="py-2 pr-2 whitespace-nowrap">Valor</th>
                            <th className="py-2 pr-2">Usuário</th>
                            <th className="py-2 pr-2">Email</th>
                            <th className="py-2 pr-2 whitespace-nowrap">Auction ID</th>
                            <th className="py-2 pr-2 whitespace-nowrap">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <>
                                <SkeletonRow />
                                <SkeletonRow />
                                <SkeletonRow />
                            </>
                        )}
                        {!loading && error && (
                            <tr>
                                <td className="py-3 text-destructive" colSpan={6}>{error}</td>
                            </tr>
                        )}
                        {!loading && !error && list.length === 0 && (
                            <tr>
                                <td className="py-3 text-muted-foreground" colSpan={6}>Sem lances {positionLabel} para os filtros.</td>
                            </tr>
                        )}
                        {!loading && !error && list.map((item, idx) => {
                            const name = item.user?.name || item.user?.email || item.user?.id || '-'
                            const email = item.user?.email || '-'
                            return (
                                <tr key={`${item.auctionId}-${item.position}-${idx}`} className="border-b last:border-b-0">
                                    <td className="py-2 pr-2 whitespace-nowrap">{item.position}º</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">{formatBRL(item.amount)}</td>
                                    <td className="py-2 pr-2 truncate max-w-[160px]">{name}</td>
                                    <td className="py-2 pr-2 truncate max-w-[200px]">{email}</td>
                                    <td className="py-2 pr-2 truncate max-w-[220px]">{item.auctionId}</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">
                                        {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    )

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderTable('Segundos lances (cold)', secondItems, 'de 2º')}
            {renderTable('Terceiros lances (cold)', thirdItems, 'de 3º')}
        </div>
    )
}
