import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function toNum(v: unknown): number {
    if (v == null) return 0
    const anyV = v as { toNumber?: () => number }
    if (anyV && typeof anyV.toNumber === 'function') {
        const n = anyV.toNumber()
        return Number.isFinite(n) ? n : 0
    }
    const n = typeof v === 'string' ? parseFloat(v as string) : Number(v)
    return Number.isFinite(n) ? n : 0
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({})) as { leadIds?: string[] }
        const leadIds = Array.isArray(body.leadIds) ? body.leadIds.filter(Boolean) : []
        if (leadIds.length === 0) {
            return NextResponse.json({ prices: {} })
        }

        const auctions = await prisma.auctions.findMany({
            where: { lead_id: { in: leadIds }, status: 'closed_won' },
            select: { lead_id: true, winning_bid_id: true }
        })

        const winningBidIds = auctions
            .map(a => a.winning_bid_id)
            .filter((id): id is string => Boolean(id))

        if (winningBidIds.length === 0) {
            return NextResponse.json({ prices: {} })
        }

        const bids = await prisma.bids.findMany({
            where: { id: { in: winningBidIds } },
            select: { id: true, amount: true }
        })
        const amountByBid: Record<string, number> = {}
        bids.forEach(b => { amountByBid[b.id] = toNum(b.amount as unknown) })

        const prices: Record<string, number> = {}
        auctions.forEach(a => {
            const leadId = a.lead_id
            const bidId = a.winning_bid_id || ''
            if (bidId && amountByBid[bidId] != null) prices[leadId] = amountByBid[bidId]
        })

        const pending = leadIds.filter(id => prices[id] == null)
        if (pending.length > 0) {
            const leadsWithBatch = await prisma.leads.findMany({
                where: { id: { in: pending }, batch_auction_id: { not: null } },
                select: { id: true, batch_auction_id: true }
            })
            const batchMap = new Map<string, string[]>()
            leadsWithBatch.forEach(lead => {
                if (!lead.batch_auction_id) return
                const bucket = batchMap.get(lead.batch_auction_id) ?? []
                bucket.push(lead.id)
                batchMap.set(lead.batch_auction_id, bucket)
            })
            if (batchMap.size > 0) {
                const batchIds = Array.from(batchMap.keys())
                const batchMeta = await prisma.batch_auctions.findMany({
                    where: { id: { in: batchIds } },
                    select: { id: true, total_leads: true, lead_unit_price: true }
                })
                const metaById = new Map(batchMeta.map(row => [row.id, row]))
                const batchAuctions = await prisma.auctions.findMany({
                    where: { batch_auction_id: { in: batchIds }, status: 'closed_won' },
                    select: { batch_auction_id: true, winning_bid_id: true }
                })
                const batchWinningIds = batchAuctions
                    .map(a => a.winning_bid_id)
                    .filter((id): id is string => Boolean(id))
                const winningAmounts = batchWinningIds.length
                    ? await prisma.bids.findMany({ where: { id: { in: batchWinningIds } }, select: { id: true, amount: true } })
                    : []
                const amountByWinningId = new Map<string, number>()
                winningAmounts.forEach(row => amountByWinningId.set(row.id, toNum(row.amount as unknown)))
                batchAuctions.forEach(batchAuction => {
                    const batchId = batchAuction.batch_auction_id
                    if (!batchId) return
                    const leadsForBatch = batchMap.get(batchId)
                    if (!leadsForBatch || leadsForBatch.length === 0) return
                    const meta = metaById.get(batchId)
                    if (!meta) return
                    const winningAmount = batchAuction.winning_bid_id ? amountByWinningId.get(batchAuction.winning_bid_id) : undefined
                    const perLead = winningAmount && meta.total_leads > 0
                        ? winningAmount / meta.total_leads
                        : toNum(meta.lead_unit_price as unknown)
                    leadsForBatch.forEach(leadId => {
                        prices[leadId] = perLead
                    })
                })
            }
        }

        return NextResponse.json({ prices })
    } catch (error: unknown) {
        console.error('[purchase-prices] error:', error)
        return NextResponse.json({ error: 'Erro interno', details: String(error) }, { status: 500 })
    }
}


