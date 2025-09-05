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

        return NextResponse.json({ prices })
    } catch (error: unknown) {
        console.error('[purchase-prices] error:', error)
        return NextResponse.json({ error: 'Erro interno', details: String(error) }, { status: 500 })
    }
}


