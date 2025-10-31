import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createBatchAuction } from '@/lib/batch-auctions'

export const runtime = 'nodejs'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const toNumber = (value: unknown): number => {
    if (value == null) return 0
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (typeof (value as { toNumber?: () => number })?.toNumber === 'function') {
        const parsed = (value as { toNumber: () => number }).toNumber()
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

type RunBody = {
    mode?: 'auto' | 'backlog'
    batchSize?: number
    maxBatches?: number
}

export async function POST(request: Request) {
    try {
        const admin = await requireAdmin()
        if (!admin.ok) {
            return NextResponse.json({ error: admin.error }, { status: admin.status })
        }

        let body: RunBody = {}
        try {
            body = await request.json()
        } catch {
            /* noop */
        }

        const manualMode = body.mode === 'backlog' ? 'backlog' : 'auto'
        const requestedBatchSize = body.batchSize
        const batchSize = Number.isFinite(requestedBatchSize ?? NaN) ? clamp(Number(requestedBatchSize), 1, 500) : undefined
        const maxBatches = clamp(Number(body.maxBatches ?? (manualMode === 'backlog' ? 5 : 1)) || (manualMode === 'backlog' ? 5 : 1), 1, manualMode === 'backlog' ? 10 : 1)

        const summaries: Array<{
            id: string
            leadIds: string[]
            totalLeads: number
            minimumBid: number
            triggerReason: string
            createdAt: string | Date | null
            auctionId: string
        }> = []
        let skippedReason: 'EMPTY' | 'NOT_ENOUGH' | null = null
        let batchesCreated = 0
        let partialAttempted = false

        while (batchesCreated < maxBatches) {
            const result = await createBatchAuction({
                mode: 'manual',
                allowPartial: false,
                batchSize,
                actorId: admin.user.id,
            })

            if (!result.created) {
                skippedReason = result.reason
                if (manualMode === 'backlog' && !partialAttempted && result.reason === 'NOT_ENOUGH') {
                    partialAttempted = true
                    const partialResult = await createBatchAuction({
                        mode: 'manual',
                        allowPartial: true,
                        batchSize,
                        actorId: admin.user.id,
                    })
                    if (partialResult.created) {
                        const summary = partialResult.summary
                        summaries.push({
                            id: summary.batch.id,
                            leadIds: summary.leadIds,
                            totalLeads: summary.batch.total_leads,
                            minimumBid: toNumber(summary.batch.minimum_bid),
                            triggerReason: summary.batch.trigger_reason,
                            createdAt: summary.batch.created_at,
                            auctionId: summary.auction.id,
                        })
                        batchesCreated++
                        skippedReason = null
                    } else {
                        skippedReason = partialResult.reason
                    }
                }
                break
            }

            const summary = result.summary
            summaries.push({
                id: summary.batch.id,
                leadIds: summary.leadIds,
                totalLeads: summary.batch.total_leads,
                minimumBid: toNumber(summary.batch.minimum_bid),
                triggerReason: summary.batch.trigger_reason,
                createdAt: summary.batch.created_at,
                auctionId: summary.auction.id,
            })
            batchesCreated++

            if (manualMode !== 'backlog') {
                break
            }
        }

        if (summaries.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    reason: skippedReason ?? 'EMPTY',
                },
                { status: 200 },
            )
        }

        return NextResponse.json({
            ok: true,
            createdBatches: summaries.length,
            batches: summaries,
        })
    } catch (error) {
        console.error('[batch-auctions][run][POST]', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
