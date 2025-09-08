import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: auctionId } = await params
    if (!auctionId) {
        return NextResponse.json({ error: 'Missing auction id' }, { status: 400 })
    }

    try {
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const toNum = (v: unknown): number => {
                if (v == null) return 0
                const anyV = v as { toNumber?: () => number }
                if (anyV && typeof anyV.toNumber === 'function') {
                    const n = anyV.toNumber()
                    return Number.isFinite(n) ? n : 0
                }
                const n = typeof v === 'string' ? parseFloat(v as string) : Number(v)
                return Number.isFinite(n) ? n : 0
            }
            const auction = await tx.auctions.findUnique({
                where: { id: auctionId },
                include: { leads: true }
            })
            console.log('[close-auction] start', { auctionId, hasAuction: !!auction })

            if (!auction) {
                console.warn('[close-auction] auction not found', { auctionId })
                return { status: 404 as const, body: { error: 'Auction not found' } }
            }

            const topBid = await tx.bids.findFirst({
                where: { auction_id: auctionId },
                orderBy: [{ amount: 'desc' }, { created_at: 'desc' }]
            })
            console.log('[close-auction] topBid', { hasTopBid: !!topBid, topBidId: topBid?.id, user: topBid?.user_id, amount: String(topBid?.amount || '') })

            if (!topBid) {
                const currentLeadStatus = auction.leads?.status || 'cold'
                const nextLeadStatus = currentLeadStatus === 'hot' ? 'high_frozen' : 'low_frozen'

                // Idempotency guard: only transition from open -> closed_expired once
                const lock = await tx.auctions.updateMany({
                    where: { id: auctionId, status: 'open' },
                    data: { status: 'closed_expired', winning_bid_id: null }
                })
                if (lock.count === 0) {
                    console.warn('[close-auction] already closed, skipping duplicate expiration', { auctionId })
                    return { status: 409 as const, body: { error: 'Auction already closed', outcome: 'already_closed' as const } }
                }

                const updatedLead = await tx.leads.update({
                    where: { id: auction.lead_id },
                    data: { status: nextLeadStatus }
                })
                const updatedAuction = await tx.auctions.findUnique({ where: { id: auctionId } })
                console.log('[close-auction] no bids, marked expired', { auctionId })
                return { status: 200 as const, body: { auction: updatedAuction, lead: updatedLead, outcome: 'expired_no_bids' as const } }
            }

            // Idempotency guard: only transition from open -> closed_won once
            const lock = await tx.auctions.updateMany({
                where: { id: auctionId, status: 'open' },
                data: { status: 'closed_won', winning_bid_id: topBid.id }
            })
            if (lock.count === 0) {
                console.warn('[close-auction] already closed, skipping duplicate win processing', { auctionId })
                return { status: 409 as const, body: { error: 'Auction already closed', outcome: 'already_closed' as const } }
            }

            const [updatedAuction, updatedLead] = await Promise.all([
                tx.auctions.findUnique({ where: { id: auctionId } }),
                tx.leads.update({
                    where: { id: auction.lead_id },
                    data: { status: 'sold', owner_id: topBid.user_id }
                })
            ])
            console.log('[close-auction] marked closed_won and lead sold', { auctionId, winningBidId: topBid.id, winnerUserId: topBid.user_id })

            // Consume winner's hold and release others
            const holdsForAuction = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' } })
            const winningAmount = toNum(topBid.amount as unknown)
            console.log('[close-auction] active holds found', { auctionId, count: holdsForAuction.length, winningAmount })

            // Mark winner hold as consumed
            const winnerHold = holdsForAuction.find(h => h.user_id === topBid.user_id)
            if (winnerHold) {
                await tx.credit_holds.update({ where: { id: winnerHold.id }, data: { status: 'consumed', updated_at: new Date() as unknown as Date } })
                console.log('[close-auction] winner hold consumed', { holdId: winnerHold.id, userId: topBid.user_id })
            } else {
                console.warn('[close-auction] winner hold not found', { auctionId, winnerUserId: topBid.user_id })
            }

            // Release all non-winner holds
            const losers = holdsForAuction.filter(h => h.user_id !== topBid.user_id)
            if (losers.length > 0) {
                const loserIds = losers.map(h => h.id)
                await tx.credit_holds.updateMany({ where: { id: { in: loserIds } }, data: { status: 'released', updated_at: new Date() as unknown as Date } })
                console.log('[close-auction] loser holds released', { auctionId, releasedCount: losers.length })
            }

            // Deduct credits from winner balance equal to winning amount
            const winner = await tx.users.findUnique({ where: { id: topBid.user_id }, select: { credit_balance: true } })
            const winnerBalance = toNum(winner?.credit_balance as unknown)
            const nextBalance = new Prisma.Decimal(winnerBalance).minus(new Prisma.Decimal(winningAmount))
            await tx.users.update({ where: { id: topBid.user_id }, data: { credit_balance: nextBalance } })
            console.log('[close-auction] debited winner balance', { userId: topBid.user_id, before: winnerBalance, amount: winningAmount, after: String(nextBalance) })

            return { status: 200 as const, body: { auction: updatedAuction, lead: updatedLead, outcome: 'won' as const, winningBidId: topBid.id } }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[close-auction] error:', error)
        return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
    }
}


