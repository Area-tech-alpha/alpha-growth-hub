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

            if (!auction) {
                return { status: 404 as const, body: { error: 'Auction not found' } }
            }

            // Find highest bid, if any
            const topBid = await tx.bids.findFirst({
                where: { auction_id: auctionId },
                orderBy: [{ amount: 'desc' }, { created_at: 'desc' }]
            })

            if (!topBid) {
                // No bids -> close as expired and freeze lead based on status
                const currentLeadStatus = auction.leads?.status || 'cold'
                console.log('[close-auction] currentLeadStatus:', currentLeadStatus)
                const nextLeadStatus = currentLeadStatus === 'hot' ? 'high_frozen' : 'low_frozen'

                const [updatedAuction, updatedLead] = await Promise.all([
                    tx.auctions.update({
                        where: { id: auctionId },
                        data: { status: 'closed_expired', winning_bid_id: null }
                    }),
                    tx.leads.update({
                        where: { id: auction.lead_id },
                        data: { status: nextLeadStatus }
                    })
                ])

                // Release all active holds for this auction
                const before = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' }, select: { id: true, user_id: true, amount: true, status: true } })
                console.log('[close-auction] no-bids active holds before:', before.length, before.map(h => h.id))
                const upd = await tx.credit_holds.updateMany({
                    where: { auction_id: auctionId, status: 'active' },
                    data: { status: 'released', updated_at: new Date() as unknown as Date }
                })
                const after = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' }, select: { id: true } })
                console.log('[close-auction] no-bids holds update count:', upd.count, 'remaining active:', after.length)

                return { status: 200 as const, body: { auction: updatedAuction, lead: updatedLead, outcome: 'expired_no_bids' as const } }
            }

            // Has winner -> close as won, set winning_bid_id, transfer ownership
            const [updatedAuction, updatedLead] = await Promise.all([
                tx.auctions.update({
                    where: { id: auctionId },
                    data: { status: 'closed_won', winning_bid_id: topBid.id }
                }),
                tx.leads.update({
                    where: { id: auction.lead_id },
                    data: { status: 'sold', owner_id: topBid.user_id }
                })
            ])

            // Consume winner's hold and release others
            const beforeWinner = await tx.credit_holds.findMany({ where: { auction_id: auctionId, user_id: topBid.user_id, status: 'active' }, select: { id: true, amount: true } })
            const beforeOthers = await tx.credit_holds.findMany({ where: { auction_id: auctionId, user_id: { not: topBid.user_id }, status: 'active' }, select: { id: true, amount: true } })
            console.log('[close-auction] winner holds before count:', beforeWinner.length, 'ids:', beforeWinner.map(h => h.id))
            console.log('[close-auction] others holds before count:', beforeOthers.length, 'ids:', beforeOthers.map(h => h.id))

            const updWinner = await tx.credit_holds.updateMany({
                where: { auction_id: auctionId, user_id: topBid.user_id, status: 'active' },
                data: { status: 'consumed', updated_at: new Date() as unknown as Date }
            })
            const updOthers = await tx.credit_holds.updateMany({
                where: { auction_id: auctionId, user_id: { not: topBid.user_id }, status: 'active' },
                data: { status: 'released', updated_at: new Date() as unknown as Date }
            })
            const remaining = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' }, select: { id: true, user_id: true } })
            console.log('[close-auction] holds updated - winner consumed:', updWinner.count, 'others released:', updOthers.count, 'remaining active:', remaining.length)

            // Deduct credits from winner's balance (proportional to winning bid)
            const winner = await tx.users.findUnique({ where: { id: topBid.user_id }, select: { credit_balance: true } })
            const winnerBalance = toNum(winner?.credit_balance as unknown)
            const winningAmount = toNum(topBid.amount as unknown)
            const nextBalance = new Prisma.Decimal(winnerBalance).minus(new Prisma.Decimal(winningAmount))
            await tx.users.update({ where: { id: topBid.user_id }, data: { credit_balance: nextBalance } })

            return { status: 200 as const, body: { auction: updatedAuction, lead: updatedLead, outcome: 'won' as const, winningBidId: topBid.id } }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[close-auction] error:', error)
        return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
    }
}


