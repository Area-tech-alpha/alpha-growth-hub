import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

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

            return { status: 200 as const, body: { auction: updatedAuction, lead: updatedLead, outcome: 'won' as const, winningBidId: topBid.id } }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[close-auction] error:', error)
        return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
    }
}


