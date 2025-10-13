"use client";

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RewardMetadata = {
    reason?: string
    granted_by?: { id?: string; email?: string; name?: string }
} & Record<string, unknown>

type HistoryItem = {
    id: string
    userId: string
    email: string | null
    name: string | null
    credits: number
    amountPaid: number
    createdAt: string
    metadata?: RewardMetadata
}

type LiteUser = { id: string; name: string | null; email: string | null }

export default function AdminCredits() {
    const [form, setForm] = useState<{ userId: string; credits: string; reason: string }>(
        { userId: '', credits: '', reason: '' }
    )
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [userSearch, setUserSearch] = useState('')
    const [userOptions, setUserOptions] = useState<LiteUser[]>([])
    const [usersOpen, setUsersOpen] = useState(false)
    const [usersLoading, setUsersLoading] = useState(false)
    const selectRef = useRef<HTMLDivElement | null>(null)
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

    const idemKeyRef = useRef<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)
        if (!form.userId) { setMessage('Selecione um usuário.'); return }
        if (!(creditsNum > 0)) { setMessage('Créditos inválidos.'); return }
        setSubmitting(true)
        if (!idemKeyRef.current) {
            try { idemKeyRef.current = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) } catch { idemKeyRef.current = Math.random().toString(36).slice(2) }
        }
        try {
            const res = await fetch('/api/admin/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: form.userId,
                    credits: creditsNum,
                    reason: form.reason || undefined,
                    idempotencyKey: idemKeyRef.current,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                setMessage(err?.error || 'Falha ao conceder créditos')
            } else {
                setMessage('Créditos concedidos com sucesso.')
                setForm({ userId: '', credits: '', reason: '' })
                setUserSearch('')
                setUserOptions([])
                idemKeyRef.current = null
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
                        {/* Seletor de usuário com busca */}
                        <div className="flex flex-col gap-1 md:col-span-2" ref={selectRef}>
                            <label className="text-sm">Usuário</label>
                            <div className="relative">
                                <input
                                    className="h-9 w-full rounded border pl-2 pr-16 bg-background"
                                    placeholder="Digite para buscar por nome ou email..."
                                    value={form.userId ? (userOptions.find(u => u.id === form.userId)?.name || userOptions.find(u => u.id === form.userId)?.email || userSearch) : userSearch}
                                    onChange={async (e) => {
                                        const v = e.target.value
                                        setUserSearch(v)
                                        setUsersOpen(true)
                                        setUsersLoading(true)
                                        try {
                                            const qs = v ? `?q=${encodeURIComponent(v)}` : ''
                                            const res = await fetch(`/api/admin/users${qs}`, { cache: 'no-store' })
                                            if (res.ok) {
                                                const json = await res.json()
                                                setUserOptions(Array.isArray(json.users) ? json.users : [])
                                            }
                                        } catch {
                                            // ignore
                                        } finally {
                                            setUsersLoading(false)
                                        }
                                    }}
                                    onFocus={async () => {
                                        setUsersOpen(true)
                                        if (userOptions.length === 0) {
                                            setUsersLoading(true)
                                            try {
                                                const res = await fetch('/api/admin/users', { cache: 'no-store' })
                                                if (res.ok) {
                                                    const json = await res.json()
                                                    setUserOptions(Array.isArray(json.users) ? json.users : [])
                                                }
                                            } catch { } finally { setUsersLoading(false) }
                                        }
                                    }}
                                    disabled={submitting}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                                    {form.userId && (
                                        <button
                                            type="button"
                                            className="h-7 w-7 text-xs rounded border hover:bg-muted"
                                            onClick={() => { setForm(f => ({ ...f, userId: '' })); setUserSearch(''); setUsersOpen(false) }}
                                            title="Limpar seleção"
                                        >×</button>
                                    )}
                                    <button
                                        type="button"
                                        className="h-7 w-14 text-xs rounded border hover:bg-muted"
                                        onClick={() => setUsersOpen(o => !o)}
                                        title="Abrir/fechar"
                                    >{usersOpen ? 'Fechar' : 'Buscar'}</button>
                                </div>
                                {usersOpen && (
                                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border bg-background shadow">
                                        {usersLoading ? (
                                            <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
                                        ) : userOptions.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                                        ) : (
                                            <ul>
                                                {userOptions.map(u => (
                                                    <li key={u.id}>
                                                        <button
                                                            type="button"
                                                            className={`w-full text-left p-2 text-sm hover:bg-muted ${form.userId === u.id ? 'bg-muted' : ''}`}
                                                            onClick={() => { setForm(f => ({ ...f, userId: u.id })); setUsersOpen(false) }}
                                                        >
                                                            <span className="font-medium">{u.name || u.email || u.id}</span>
                                                            <span className="block text-xs text-muted-foreground">{u.email || u.id}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
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
                                    const reason = h?.metadata?.reason || ''
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

