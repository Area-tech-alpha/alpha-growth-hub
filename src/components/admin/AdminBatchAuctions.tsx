"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ToastBus } from '@/lib/toastBus'
import { Layers, RefreshCw } from 'lucide-react'

type BatchRow = {
    id: string
    totalLeads: number
    minimumBid: number
    triggerReason: string
    status: string
    result: string
    createdAt?: string
    auctionId?: string | null
}

type SettingsResponse = {
    lowFrozenThreshold: number
    autoTriggerEnabled: boolean
    leadUnitPrice: number
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = (value?: string | Date | null) => {
    if (!value) return '—'
    const date = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('pt-BR')
}

export default function AdminBatchAuctions() {
    const [settings, setSettings] = useState<SettingsResponse | null>(null)
    const [thresholdInput, setThresholdInput] = useState<string>('0')
    const [unitPriceInput, setUnitPriceInput] = useState<string>('225')
    const [autoTrigger, setAutoTrigger] = useState<boolean>(false)
    const [loadingSettings, setLoadingSettings] = useState<boolean>(true)
    const [savingSettings, setSavingSettings] = useState<boolean>(false)

    const [batches, setBatches] = useState<BatchRow[]>([])
    const [stats, setStats] = useState<{ eligibleLowFrozen: number } | null>(null)
    const [loadingBatches, setLoadingBatches] = useState<boolean>(true)
    const [runningMode, setRunningMode] = useState<'auto' | 'backlog' | null>(null)

    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true)
            const res = await fetch('/api/admin/batch-auctions/settings', { cache: 'no-store' })
            if (!res.ok) {
                throw new Error('Falha ao carregar configurações.')
            }
            const data = (await res.json()) as SettingsResponse
            setSettings(data)
            setThresholdInput(String(data.lowFrozenThreshold ?? 0))
            setUnitPriceInput(String(data.leadUnitPrice ?? 225))
            setAutoTrigger(Boolean(data.autoTriggerEnabled))
        } catch (error) {
            console.error(error)
            ToastBus.error('Não foi possível carregar as configurações.')
        } finally {
            setLoadingSettings(false)
        }
    }, [])

    const fetchBatches = useCallback(async () => {
        try {
            setLoadingBatches(true)
            const res = await fetch('/api/admin/batch-auctions?limit=20', { cache: 'no-store' })
            if (!res.ok) {
                throw new Error('Falha ao listar lotes.')
            }
            const data = await res.json()
            setBatches(
                Array.isArray(data.batches)
                    ? data.batches.map((row: BatchRow) => ({
                          ...row,
                          minimumBid: Number(row.minimumBid ?? 0),
                      }))
                    : [],
            )
            setStats(data.stats ?? null)
        } catch (error) {
            console.error(error)
            ToastBus.error('Não foi possível carregar os lotes.')
        } finally {
            setLoadingBatches(false)
        }
    }, [])

    useEffect(() => {
        fetchSettings()
        fetchBatches()
    }, [fetchSettings, fetchBatches])

    const handleSave = async () => {
        try {
            setSavingSettings(true)
            const payload = {
                lowFrozenThreshold: Number(thresholdInput),
                autoTriggerEnabled: autoTrigger,
                leadUnitPrice: Number(unitPriceInput),
            }
            const res = await fetch('/api/admin/batch-auctions/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const message = await res.json().catch(() => ({}))
                throw new Error(message?.error || 'Falha ao salvar configurações.')
            }
            const updated = (await res.json()) as SettingsResponse
            setSettings(updated)
            ToastBus.success('Configurações atualizadas com sucesso!')
        } catch (error) {
            console.error(error)
            ToastBus.error(error instanceof Error ? error.message : 'Erro ao salvar as configurações.')
        } finally {
            setSavingSettings(false)
        }
    }

    const runBatch = async (mode: 'auto' | 'backlog') => {
        try {
            setRunningMode(mode)
            const res = await fetch('/api/admin/batch-auctions/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.ok === false) {
                throw new Error(data?.reason ? `Execução ignorada (${data.reason}).` : data?.error || 'Falha ao executar lote.')
            }
            const created = Number(data.createdBatches || 0)
            ToastBus.success(created > 0 ? `Criamos ${created} lote(s) em lote.` : 'Nenhum lote criado.')
            await fetchBatches()
        } catch (error) {
            console.error(error)
            ToastBus.error(error instanceof Error ? error.message : 'Não foi possível executar o lote.')
        } finally {
            setRunningMode(null)
        }
    }

    const thresholdValue = useMemo(() => Number(thresholdInput) || 0, [thresholdInput])
    const leadUnitValue = useMemo(() => Number(unitPriceInput) || 0, [unitPriceInput])

    return (
        <div className="space-y-6">
            <div className="border rounded-lg p-5 space-y-4 bg-card text-card-foreground">
                <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-yellow-600" />
                    <div>
                        <h2 className="text-lg font-semibold">Configurações de lotes</h2>
                        <p className="text-sm text-muted-foreground">
                            Defina o limite mínimo, preço por lead e ative/desative a automação.
                        </p>
                    </div>
                </div>
                {loadingSettings ? (
                    <div className="text-sm text-muted-foreground">Carregando configurações...</div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-3">
                            <label className="flex flex-col gap-2 text-sm">
                                <span className="font-medium text-foreground">Threshold `low_frozen`</span>
                                <Input
                                    type="number"
                                    min={1}
                                    value={thresholdInput}
                                    onChange={(event) => setThresholdInput(event.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-2 text-sm">
                                <span className="font-medium text-foreground">Preço por lead (R$)</span>
                                <Input
                                    type="number"
                                    min={1}
                                    step="1"
                                    value={unitPriceInput}
                                    onChange={(event) => setUnitPriceInput(event.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-2 text-sm">
                                <span className="font-medium text-foreground">Automação</span>
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <input
                                        id="auto-trigger"
                                        type="checkbox"
                                        checked={autoTrigger}
                                        onChange={() => setAutoTrigger((prev) => !prev)}
                                    />
                                    <span className="text-sm">{autoTrigger ? 'Ativada' : 'Desativada'}</span>
                                </div>
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button onClick={handleSave} disabled={savingSettings}>
                                {savingSettings ? 'Salvando...' : 'Salvar configurações'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={runningMode === 'auto'}
                                onClick={() => runBatch('auto')}
                            >
                                {runningMode === 'auto' ? 'Executando...' : 'Rodar com threshold'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={runningMode === 'backlog'}
                                onClick={() => runBatch('backlog')}
                            >
                                {runningMode === 'backlog' ? 'Liberando backlog...' : 'Processar backlog'}
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {thresholdValue > 0 &&
                                `Cada lote cria ${thresholdValue} leads por padrão. Preço mínimo atual: ${currency.format(
                                    thresholdValue * leadUnitValue,
                                )}.`}
                        </div>
                    </>
                )}
            </div>

            <div className="border rounded-lg p-5 space-y-4 bg-card text-card-foreground">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">Lotes recentes</h2>
                        <p className="text-sm text-muted-foreground">
                            Fila `low_frozen` aguardando lote:{' '}
                            <strong>{stats ? stats.eligibleLowFrozen : '—'}</strong>
                        </p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={fetchBatches} disabled={loadingBatches}>
                        <RefreshCw className={`h-4 w-4 ${loadingBatches ? 'animate-spin' : ''}`} />
                        <span className="ml-2">Atualizar</span>
                    </Button>
                </div>
                {loadingBatches ? (
                    <div className="text-sm text-muted-foreground">Carregando lotes...</div>
                ) : batches.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum lote criado ainda.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2 pr-4">Lote</th>
                                    <th className="py-2 pr-4">Leads</th>
                                    <th className="py-2 pr-4">Lance mínimo</th>
                                    <th className="py-2 pr-4">Status</th>
                                    <th className="py-2 pr-4">Resultado</th>
                                    <th className="py-2">Criado em</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map((batch) => (
                                    <tr key={batch.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4 font-mono text-xs">{batch.id.slice(0, 8)}</td>
                                        <td className="py-2 pr-4">{batch.totalLeads}</td>
                                        <td className="py-2 pr-4">{currency.format(batch.minimumBid)}</td>
                                        <td className="py-2 pr-4">
                                            <Badge variant="secondary" className="uppercase">
                                                {batch.status}
                                            </Badge>
                                        </td>
                                        <td className="py-2 pr-4">
                                            <Badge variant="outline" className="uppercase">
                                                {batch.result}
                                            </Badge>
                                        </td>
                                        <td className="py-2 text-muted-foreground">{formatDate(batch.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
