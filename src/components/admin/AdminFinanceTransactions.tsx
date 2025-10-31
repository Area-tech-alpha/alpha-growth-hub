"use client";

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type TransactionUser = {
    id: string
    name: string | null
    email: string | null
}

type Transaction = {
    id: string
    user: TransactionUser
    provider: 'asaas' | 'infinitepay' | 'unknown'
    providerPaymentId: string | null
    asaasPaymentId: string | null
    infinitepayPaymentId: string | null
    status: string
    source?: string | null
    amountPaid: number
    creditsPurchased: number
    createdAt: string | null
}

type ApiResponse = {
    page: number
    pageSize: number
    total: number
    totalPages: number
    transactions: Transaction[]
}

const PAGE_SIZE = 20

const providerLabel: Record<Transaction['provider'], string> = {
    asaas: 'Asaas',
    infinitepay: 'Infinity Pay',
    unknown: '—',
}

const formatBRL = (value: number) =>
    Number.isFinite(value) ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const formatCredits = (value: number) =>
    Number.isFinite(value) ? value.toLocaleString('pt-BR') : '—'

const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR') : '—'

export default function AdminFinanceTransactions({ month }: { month: string }) {
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<ApiResponse | null>(null)

    useEffect(() => { setPage(1) }, [month])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        async function fetchTransactions() {
            setLoading(true)
            setError(null)
            try {
                const searchParams = new URLSearchParams()
                searchParams.set('page', String(page))
                searchParams.set('pageSize', String(PAGE_SIZE))
                if (month) searchParams.set('month', month)
                const res = await fetch(`/api/admin/finance/transactions?${searchParams.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                })
                if (!active) return
                if (!res.ok) {
                    setError('Não foi possível carregar as transações.')
                    setData(null)
                    return
                }
                const json = (await res.json()) as ApiResponse
                if (json?.totalPages && page > json.totalPages) {
                    setPage(json.totalPages)
                    return
                }
                setData(json)
            } catch (err) {
                if (!active) return
                if (err instanceof DOMException && err.name === 'AbortError') return
                setError('Erro ao carregar transações.')
                setData(null)
            } finally {
                if (active) setLoading(false)
            }
        }
        fetchTransactions()
        return () => {
            active = false
            controller.abort()
        }
    }, [month, page])

    const transactions = useMemo(() => data?.transactions ?? [], [data])
    const totalPages = useMemo(() => data?.totalPages ?? 1, [data])
    const total = useMemo(() => data?.total ?? 0, [data])

    return (
        <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <CardTitle className="text-base">Transações financeiras</CardTitle>
                    <p className="text-sm text-muted-foreground">Entradas via Asaas ou Infinity Pay com filtro mensal.</p>
                </div>
                <div className="text-sm text-muted-foreground">
                    {total > 0 ? `${total} transação${total > 1 ? 's' : ''}` : 'Sem registros no período'}
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="py-2 pr-2 whitespace-nowrap">Data</th>
                                <th className="py-2 pr-2">Usuário</th>
                                <th className="py-2 pr-2">Email</th>
                                <th className="py-2 pr-2 whitespace-nowrap">Método</th>
                                <th className="py-2 pr-2 whitespace-nowrap">ID pagamento</th>
                                <th className="py-2 pr-2 whitespace-nowrap">Valor (R$)</th>
                                <th className="py-2 pr-2 whitespace-nowrap">Créditos</th>
                                <th className="py-2 pr-2 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="py-4 text-muted-foreground" colSpan={8}>Carregando...</td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td className="py-4 text-red-500" colSpan={8}>{error}</td>
                                </tr>
                            )}
                            {!loading && !error && transactions.length === 0 && (
                                <tr>
                                    <td className="py-4 text-muted-foreground" colSpan={8}>Sem transações para os filtros selecionados.</td>
                                </tr>
                            )}
                            {!loading && !error && transactions.map(tx => {
                                const name = tx.user?.name || '—'
                                const email = tx.user?.email || '—'
                                const paymentId = tx.providerPaymentId || '—'
                                const amount = formatBRL(tx.amountPaid)
                                const credits = formatCredits(tx.creditsPurchased)
                                const createdAt = formatDateTime(tx.createdAt)
                                const status = tx.status || '—'
                                const provider = providerLabel[tx.provider] ?? tx.provider
                                return (
                                    <tr key={tx.id} className="border-b last:border-b-0">
                                        <td className="py-2 pr-2 whitespace-nowrap">{createdAt}</td>
                                        <td className="py-2 pr-2 truncate max-w-[220px]">{name}</td>
                                        <td className="py-2 pr-2 truncate max-w-[240px]">{email}</td>
                                        <td className="py-2 pr-2 whitespace-nowrap">{provider}</td>
                                        <td className="py-2 pr-2 truncate max-w-[200px]">{paymentId}</td>
                                        <td className="py-2 pr-2 whitespace-nowrap">{amount}</td>
                                        <td className="py-2 pr-2 whitespace-nowrap">{credits}</td>
                                        <td className="py-2 pr-2 uppercase whitespace-nowrap">{status}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm">
                    <div className="text-muted-foreground">
                        Página {Math.min(page, totalPages)} de {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            disabled={loading || page <= 1}
                        >
                            Anterior
                        </button>
                        <button
                            type="button"
                            className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => setPage(prev => prev + 1)}
                            disabled={loading || page >= totalPages}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
