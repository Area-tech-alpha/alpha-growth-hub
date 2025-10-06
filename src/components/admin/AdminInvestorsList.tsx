"use client";
import { useEffect, useMemo, useState } from 'react'

type Investor = { userId: string; total: number; name?: string | null; email?: string | null }

export default function AdminInvestorsList({ month }: { month?: string }) {
    const [loading, setLoading] = useState<boolean>(true)
    const [investors, setInvestors] = useState<Investor[]>([])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function run() {
            try {
                setLoading(true)
                const qs = month ? `?month=${month}` : ''
                const res = await fetch(`/api/admin/investors${qs}`, { cache: 'no-store', signal: controller.signal })
                if (!active) return
                if (!res.ok) {
                    setInvestors([])
                } else {
                    const json = await res.json()
                    setInvestors(Array.isArray(json.investors) ? json.investors : [])
                }
            } catch {
                if (!active) return
                setInvestors([])
            } finally {
                if (active) setLoading(false)
            }
        }
        run()
        return () => { active = false; controller.abort() }
    }, [month])

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="space-y-2">
            <h2 className="text-base font-semibold">Investidores em leads</h2>
            <ul className="divide-y rounded-md border">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <li key={`sk-${i}`} className="p-3">
                            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                        </li>
                    ))
                ) : investors.length > 0 ? (
                    investors.map((inv, idx) => (
                        <li key={`inv-${inv.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                            <span className="truncate max-w-[70%]">{inv.name || inv.email || inv.userId || '—'}</span>
                            <span className="font-medium">{formatBRL(inv.total)}</span>
                        </li>
                    ))
                ) : (
                    <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                )}
            </ul>
        </div>
    )
}


