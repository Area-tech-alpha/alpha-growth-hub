import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // Get all leads that have entered the system
        const totalLeads = await prisma.leads.count({
            where: { status: { not: '' } }
        })

        // Get all sold leads
        const soldLeads = await prisma.leads.count({
            where: { status: 'sold' }
        })

        // Calculate conversion rate
        const conversionRate = totalLeads > 0 ? (soldLeads / totalLeads) * 100 : 0

        // Get top buyers by quantity (count)
        const buyersGroup = await prisma.leads.groupBy({
            by: ['owner_id'],
            where: {
                owner_id: { not: null },
                status: 'sold'
            },
            _count: { owner_id: true },
            orderBy: { _count: { owner_id: 'desc' } }
        })

        const buyerIds = buyersGroup.map(b => b.owner_id!).filter(Boolean)
        const buyerUsers = buyerIds.length
            ? await prisma.users.findMany({
                where: { id: { in: buyerIds } },
                select: { id: true, name: true, email: true }
            })
            : []

        const topBuyers = buyersGroup.map(b => {
            const u = buyerUsers.find(x => x.id === b.owner_id)
            return {
                userId: b.owner_id,
                count: b._count.owner_id,
                name: u?.name ?? null,
                email: u?.email ?? null
            }
        })

        // Get top investors by total investment amount (winning bid amounts)
        // Get all auctions with winning bids
        const wonAuctions = await prisma.auctions.findMany({
            where: {
                winning_bid_id: { not: null },
                status: 'closed_won'
            },
            include: {
                bids_auctions_winning_bid_idTobids: {
                    select: {
                        user_id: true,
                        amount: true
                    }
                }
            }
        })

        // Aggregate investment by user
        const investmentByUser = new Map<string, number>()
        wonAuctions.forEach(auction => {
            const winningBid = auction.bids_auctions_winning_bid_idTobids
            if (winningBid) {
                const userId = winningBid.user_id
                const amount = typeof winningBid.amount === 'string'
                    ? parseFloat(winningBid.amount)
                    : Number(winningBid.amount)

                const current = investmentByUser.get(userId) || 0
                investmentByUser.set(userId, current + amount)
            }
        })

        // Sort by total investment (show all)
        const sortedInvestors = Array.from(investmentByUser.entries())
            .map(([userId, totalInvested]) => ({ userId, totalInvested }))
            .sort((a, b) => b.totalInvested - a.totalInvested)

        // Get user details for investors
        const investorIds = sortedInvestors.map(i => i.userId)
        const investorUsers = investorIds.length
            ? await prisma.users.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, name: true, email: true }
            })
            : []

        const topInvestors = sortedInvestors.map(investor => {
            const u = investorUsers.find(x => x.id === investor.userId)
            return {
                userId: investor.userId,
                totalInvested: investor.totalInvested,
                name: u?.name ?? null,
                email: u?.email ?? null
            }
        })

        return NextResponse.json({
            topBuyers,
            topInvestors,
            conversion: {
                totalLeads,
                soldLeads,
                conversionRate: Math.round(conversionRate * 100) / 100 // Round to 2 decimal places
            }
        })
    } catch (error: unknown) {
        console.error('[user/stats] error:', error)
        return NextResponse.json({
            error: 'Erro ao carregar estatísticas',
            details: String(error)
        }, { status: 500 })
    }
}
