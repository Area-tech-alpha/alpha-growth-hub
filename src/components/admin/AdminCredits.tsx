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

type PurchasedLeadItem = {
    leadId: string
    company_name: string | null
    price: number | null
}

export default function AdminCredits() {
    const [form, setForm] = useState<{ userId: string; credits: string; reason: string; action: 'grant' | 'refund'; leadId?: string | null }>(
        { userId: '', credits: '', reason: '', action: 'grant', leadId: null }
    )
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [rewards, setRewards] = useState<HistoryItem[]>([])
    const [refunds, setRefunds] = useState<HistoryItem[]>([])
    const [userSearch, setUserSearch] = useState('')
    const [userOptions, setUserOptions] = useState<LiteUser[]>([])
    const [selectedUser, setSelectedUser] = useState<LiteUser | null>(null)
    const [usersOpen, setUsersOpen] = useState(false)
    const [usersLoading, setUsersLoading] = useState(false)
    const [userLeads, setUserLeads] = useState<{ leadId: string; company_name: string | null; price: number | null }[]>([])
    const [userLeadsLoading, setUserLeadsLoading] = useState(false)
    const selectRef = useRef<HTMLDivElement | null>(null)
    const usersCacheRef = useRef<{ data: Record<string, LiteUser[]>; ts: Record<string, number> }>({ data: {}, ts: {} })
    const USERS_TTL_MS = 60_000
    const creditsNum = useMemo(() => Number(form.credits || '0'), [form.credits])

    const loadHistory = async () => {
        try {
            const res = await fetch('/api/admin/credits?limit=20', { cache: 'no-store' })
            if (!res.ok) return
            const json = await res.json()
            setRewards(Array.isArray(json.rewards) ? json.rewards : [])
            setRefunds(Array.isArray(json.refunds) ? json.refunds : [])
        } catch {
            // ignore
        }
    }

    useEffect(() => { loadHistory() }, [])

    // Click outside to close users dropdown
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!selectRef.current) return
            if (!selectRef.current.contains(e.target as Node)) {
                setUsersOpen(false)
            }
        }
        window.addEventListener('mousedown', handler)
        return () => window.removeEventListener('mousedown', handler)
    }, [])

    // Fetch users with simple in-memory cache + TTL
    const fetchUsers = async (q: string) => {
        const key = (q || '').toLowerCase()
        const now = Date.now()
        const ts = usersCacheRef.current.ts[key]
        if (ts && now - ts < USERS_TTL_MS) {
            setUserOptions(usersCacheRef.current.data[key] || [])
            return
        }
        setUsersLoading(true)
        try {
            const qs = key ? `?q=${encodeURIComponent(key)}` : ''
            const res = await fetch(`/api/admin/users${qs}`, { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                const arr: LiteUser[] = Array.isArray(json.users) ? json.users : []
                usersCacheRef.current.data[key] = arr
                usersCacheRef.current.ts[key] = now
                setUserOptions(arr)
            }
        } catch {
            // ignore
        } finally {
            setUsersLoading(false)
        }
    }

    const idemKeyRef = useRef<string | null>(null)

    // Carrega leads comprados para a ação de estorno
    useEffect(() => {
        let active = true
        async function run() {
            if (form.action !== 'refund' || !form.userId) {
                if (active) setUserLeads([])
                return
            }
            setUserLeadsLoading(true)
            try {
                const res = await fetch(`/api/admin/users/${encodeURIComponent(form.userId)}/purchased-leads`, { cache: 'no-store' })
                if (!active) return
                if (res.ok) {
                    const json = await res.json()
                    const items = Array.isArray(json.items) ? json.items.map((i: PurchasedLeadItem) => ({ leadId: i.leadId, company_name: i.company_name, price: Number(i.price || 0) || null })) : []
                    setUserLeads(items)
                } else {
                    setUserLeads([])
                }
            } catch {
                if (!active) return
                setUserLeads([])
            } finally {
                if (active) setUserLeadsLoading(false)
            }
        }
        run()
        return () => { active = false }
    }, [form.userId, form.action])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)
        if (!form.userId) { setMessage('Selecione um usuário.'); return }
        if (!(creditsNum > 0) && !(form.action === 'refund' && form.leadId)) { setMessage('Cr�ditos inv�lidos.'); return }
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
                    action: form.action,
                    idempotencyKey: idemKeyRef.current,
                    leadId: form.action === 'refund' && form.leadId ? form.leadId : undefined,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                setMessage(err?.error || 'Falha ao conceder créditos')
            } else {
                setMessage('Créditos concedidos com sucesso.')
                setForm({ userId: '', credits: '', reason: '', action: 'grant', leadId: null })
                setUserSearch('')
                setUserOptions([])
                setSelectedUser(null)
                setUserLeads([])
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
                <h2 className="text-lg font-semibold">Créditos</h2>
                <p className="text-sm text-muted-foreground">Conceda créditos de recompensa ou estorno aos usuários. O saldo do usuário é único; a origem aparecerá na auditoria do admin.</p>
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
                                    value={form.userId ? (selectedUser?.name || selectedUser?.email || userSearch) : userSearch}
                                    onChange={async (e) => {
                                        const v = e.target.value
                                        setUserSearch(v)
                                        setUsersOpen(true)
                                        fetchUsers(v)
                                    }}
                                    onFocus={async () => {
                                        setUsersOpen(true)
                                        if (userOptions.length === 0) { fetchUsers('') }
                                    }}
                                    disabled={submitting}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                                    {form.userId && (
                                        <button
                                            type="button"
                                            className="h-7 w-7 text-xs rounded border hover:bg-muted"
                                            onClick={() => { setForm(f => ({ ...f, userId: '', leadId: null })); setSelectedUser(null); setUserSearch(''); setUsersOpen(false); setUserLeads([]) }}
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
                                                            onClick={() => { setForm(f => ({ ...f, userId: u.id })); setSelectedUser(u); setUsersOpen(false); setUserLeads([]) }}
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
                                disabled={submitting || (form.action === 'refund' && !!form.leadId)}
                                min={1}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Ação</label>
                            <select
                                className="h-9 rounded border px-2 bg-background"
                                value={form.action}
                                onChange={e => setForm(f => ({ ...f, action: e.target.value as 'grant' | 'refund', leadId: null }))}
                                disabled={submitting}
                            >
                                <option value="grant">Conceder (Recompensa)</option>
                                <option value="refund">Extornar (Ajuste)</option>
                            </select>
                        </div>
                        {form.action === 'refund' && (
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-sm">Lead (opcional)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="h-9 rounded border px-2 bg-background min-w-[280px]"
                                        disabled={!form.userId || submitting || userLeadsLoading}
                                        value={form.leadId || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || ''
                                            const leadId = val || null
                                            const selected = userLeads.find(l => l.leadId === leadId)
                                            setForm(f => ({ ...f, leadId, credits: selected?.price ? String(selected.price) : f.credits }))
                                        }}
                                    >
                                        <option value="">Nenhum</option>
                                        {userLeads.map(l => (
                                            <option key={l.leadId} value={l.leadId}>
                                                {(l.company_name || l.leadId) + (l.price ? ` — R$ ${l.price.toLocaleString('pt-BR')}` : '')}
                                            </option>
                                        ))}
                                    </select>
                                    {userLeadsLoading && <span className="text-xs text-muted-foreground">carregando...</span>}
                                </div>
                                <span className="text-xs text-muted-foreground">Se um lead for escolhido, o valor do estorno usa o preço de venda; o lead será desvinculado do usuário e o leilão fechado como expirado.</span>
                            </div>
                        )}
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
                    <CardTitle className="text-base">Últimas transações de créditos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 text-sm font-medium">Recompensas</div>
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
                                        {rewards.length === 0 && (
                                            <tr><td className="py-3 text-muted-foreground" colSpan={5}>Sem registros</td></tr>
                                        )}
                                        {rewards.map((h) => {
                                            const reason = h?.metadata?.reason || ''
                                            const by = h?.metadata?.granted_by?.email || h?.metadata?.granted_by?.id || ''
                                            return (
                                                <tr key={`rw-${h.id}`} className="border-b last:border-b-0">
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
                            <div>
                                <div className="mb-2 text-sm font-medium">Estornos</div>
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
                                        {refunds.length === 0 && (
                                            <tr><td className="py-3 text-muted-foreground" colSpan={5}>Sem registros</td></tr>
                                        )}
                                        {refunds.map((h) => {
                                            const reason = h?.metadata?.reason || ''
                                            const by = h?.metadata?.granted_by?.email || h?.metadata?.granted_by?.id || ''
                                            return (
                                                <tr key={`rf-${h.id}`} className="border-b last:border-b-0">
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
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}



