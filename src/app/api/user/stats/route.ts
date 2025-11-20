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
            orderBy: { _count: { owner_id: 'desc' } },
            take: 10,
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

        // Get top investors by total investment amount
        const investorsData = await prisma.leads.groupBy({
            by: ['owner_id'],
            where: {
                owner_id: { not: null },
                status: 'sold',
                price: { not: null }
            },
            _sum: { price: true },
            orderBy: { _sum: { price: 'desc' } },
            take: 10,
        })

        const investorIds = investorsData.map(i => i.owner_id!).filter(Boolean)
        const investorUsers = investorIds.length
            ? await prisma.users.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, name: true, email: true }
            })
            : []

        const topInvestors = investorsData.map(i => {
            const u = investorUsers.find(x => x.id === i.owner_id)
            return {
                userId: i.owner_id,
                totalInvested: i._sum.price ?? 0,
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
