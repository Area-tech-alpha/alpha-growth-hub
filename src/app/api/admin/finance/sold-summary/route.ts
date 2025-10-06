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

        // Get sold leads with winning bid amounts
        const soldLeads = await prisma.leads.findMany({
            where: { status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            select: {
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

        const salePrices: number[] = []
        for (const lead of soldLeads) {
            for (const auction of lead.auctions) {
                const winningBid = auction.bids_auctions_winning_bid_idTobids
                if (winningBid) {
                    salePrices.push(Number(winningBid.amount))
                }
            }
        }

        const count = salePrices.length
        const total = count > 0 ? salePrices.reduce((s, v) => s + v, 0) : 0
        const avg = count > 0 ? total / count : 0
        const max = count > 0 ? Math.max(...salePrices) : 0

        return NextResponse.json({ count, total, avg, max })
    } catch (error: unknown) {
        console.error('[admin/finance/sold-summary] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}

