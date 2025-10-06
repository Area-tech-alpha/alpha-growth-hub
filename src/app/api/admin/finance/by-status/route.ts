import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') // YYYY-MM
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const sessionRole = (session.user as unknown as { role?: string })?.role
        if (sessionRole !== 'admin') {
            const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
            if (!me || me.role !== 'admin') {
                return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
            }
        }

        let createdAtWhere: { gte?: Date; lt?: Date } | undefined
        if (monthParam) {
            const [yyyy, mm] = monthParam.split('-').map(Number)
            if (yyyy && mm && mm >= 1 && mm <= 12) {
                const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0))
                const end = new Date(Date.UTC(yyyy, mm, 1, 0, 0, 0))
                createdAtWhere = { gte: start, lt: end }
            }
        }

        // Get sold leads with auction and winning bid info
        // hot = has contract_url, cold = no contract_url
        const soldLeads = await prisma.leads.findMany({
            where: { status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            select: {
                id: true,
                contract_url: true,
                auctions: {
                    where: { winning_bid_id: { not: null } },
                    select: {
                        bids_auctions_winning_bid_idTobids: {
                            select: { amount: true },
                        },
                    },
                },
            },
        })

        const hot: number[] = []
        const cold: number[] = []

        for (const lead of soldLeads) {
            const isHot = Boolean(lead.contract_url)
            for (const auction of lead.auctions) {
                const winningBid = auction.bids_auctions_winning_bid_idTobids
                if (winningBid) {
                    const salePrice = Number(winningBid.amount)
                    if (isHot) {
                        hot.push(salePrice)
                    } else {
                        cold.push(salePrice)
                    }
                }
            }
        }

        const hotCount = hot.length
        const coldCount = cold.length
        const hotAvg = hotCount > 0 ? hot.reduce((s, v) => s + v, 0) / hotCount : 0
        const coldAvg = coldCount > 0 ? cold.reduce((s, v) => s + v, 0) / coldCount : 0
        const hotMax = hotCount > 0 ? Math.max(...hot) : 0
        const coldMax = coldCount > 0 ? Math.max(...cold) : 0

        return NextResponse.json({
            hot: { count: hotCount, avgSale: hotAvg, maxSale: hotMax },
            cold: { count: coldCount, avgSale: coldAvg, maxSale: coldMax },
        })
    } catch (error: unknown) {
        console.error('[admin/finance/by-status] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}

