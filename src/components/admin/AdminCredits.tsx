"use client";

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type HistoryItem = {
    id: string
    userId: string
    email: string | null
    name: string | null
    credits: number
    amountPaid: number
    createdAt: string
    metadata?: any
}

export default function AdminCredits() {
    const [form, setForm] = useState<{ userId: string; email: string; credits: string; reason: string }>(
        { userId: '', email: '', credits: '', reason: '' }
    )
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const creditsNum = useMemo(() => Number(form.credits || '0'), [form.credits])

    const loadHistory = async () => {
        try {
            const res = await fetch('/api/admin/credits?limit=20', { cache: 'no-store' })
            if (!res.ok) return
            const json = await res.json()
            setHistory(Array.isArray(json.items) ? json.items : [])
        } catch {
            // ignore
        }
    }

    useEffect(() => { loadHistory() }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)
        if (!form.userId && !form.email) { setMessage('Informe userId ou email.'); return }
        if (!(creditsNum > 0)) { setMessage('Créditos inválidos.'); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/admin/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: form.userId || undefined,
                    email: form.email || undefined,
                    credits: creditsNum,
                    reason: form.reason || undefined,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                setMessage(err?.error || 'Falha ao conceder créditos')
            } else {
                setMessage('Créditos concedidos com sucesso.')
                setForm({ userId: '', email: '', credits: '', reason: '' })
                loadHistory()
            }
        } catch {
            setMessage('Erro de rede ao conceder créditos')
        } finally {
            setSubmitting(false)
        }
    }

    const formatDate = (s: string) => new Date(s).toLocaleString('pt-BR')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Créditos (Admin)</h2>
                <p className="text-sm text-muted-foreground">Conceda créditos de recompensa aos usuários. Os créditos entram no saldo normalmente.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Conceder créditos</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">User ID</label>
                            <input
                                className="h-9 rounded border px-2 bg-background"
                                placeholder="opcional se email informado"
                                value={form.userId}
                                onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                                disabled={submitting}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Email</label>
                            <input
                                className="h-9 rounded border px-2 bg-background"
                                placeholder="opcional se userId informado"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                disabled={submitting}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Créditos</label>
                            <input
                                type="number"
                                className="h-9 rounded border px-2 bg-background"
                                placeholder="ex: 100"
                                value={form.credits}
                                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                                disabled={submitting}
                                min={1}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Motivo</label>
                            <input
                                className="h-9 rounded border px-2 bg-background"
                                placeholder="ex: cashback campanha X"
                                value={form.reason}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                disabled={submitting}
                            />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="h-9 px-3 rounded-md border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >Conceder</button>
                            {message && <span className="text-sm text-muted-foreground">{message}</span>}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Últimas concessões (recompensa)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2 pr-2">Quando</th>
                                    <th className="py-2 pr-2">Usuário</th>
                                    <th className="py-2 pr-2">Créditos</th>
                                    <th className="py-2 pr-2">Motivo</th>
                                    <th className="py-2 pr-2">Por</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 && (
                                    <tr><td className="py-3 text-muted-foreground" colSpan={5}>Sem registros</td></tr>
                                )}
                                {history.map((h) => {
                                    const reason = h?.metadata?.reason || h?.metadata?.motivo || ''
                                    const by = h?.metadata?.granted_by?.email || h?.metadata?.granted_by?.id || ''
                                    return (
                                        <tr key={h.id} className="border-b last:border-b-0">
                                            <td className="py-2 pr-2 whitespace-nowrap">{formatDate(h.createdAt)}</td>
                                            <td className="py-2 pr-2 truncate max-w-[220px]">{h.name || h.email || h.userId}</td>
                                            <td className="py-2 pr-2">{h.credits.toLocaleString('pt-BR')}</td>
                                            <td className="py-2 pr-2 truncate max-w-[280px]">{reason}</td>
                                            <td className="py-2 pr-2 truncate max-w-[200px]">{by}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

