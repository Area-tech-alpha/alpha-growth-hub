import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'
import { REVENUE_BANDS, getRevenueBandByLabel } from '@/lib/revenueBands'

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
        const soldLeads = await prisma.leads.findMany({
            where: { status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            include: {
                auctions: {
                    where: { winning_bid_id: { not: null } },
                    include: {
                        bids_auctions_winning_bid_idTobids: true,
                        bids_bids_auction_idToauctions: true,
                    },
                },
            },
        })

        // Classify by type based on revenue
        // A = acima de 60 mil (índices 3 em diante: 60k-80k, 80k-100k, ..., 1M+)
        // B = entre 20 mil e 60 mil (índices 1-2: 20k-40k, 40k-60k)
        // C = abaixo de 20 mil (índice 0: até 20k)
        const typeA = REVENUE_BANDS.slice(3).map(b => b.label)  // 60k+
        const typeB = REVENUE_BANDS.slice(1, 3).map(b => b.label)  // 20k-60k
        const typeC = [REVENUE_BANDS[0].label]  // 0-20k

        const stats = { A: [], B: [], C: [] } as Record<string, { salePrice: number; avgBidPrice: number; bidCount: number; leadId: string }[]>

        for (const lead of soldLeads) {
            const band = getRevenueBandByLabel(lead.revenue)
            if (!band) continue
            let type: 'A' | 'B' | 'C' | null = null
            if (typeA.includes(band.label)) type = 'A'
            else if (typeB.includes(band.label)) type = 'B'
            else if (typeC.includes(band.label)) type = 'C'
            if (!type) continue

            for (const auction of lead.auctions) {
                const winningBid = auction.bids_auctions_winning_bid_idTobids
                if (!winningBid) continue
                const salePrice = Number(winningBid.amount)
                const allBids = auction.bids_bids_auction_idToauctions ?? []
                const bidCount = allBids.length
                const avgBidPrice = bidCount > 0 ? allBids.reduce((sum, b) => sum + Number(b.amount), 0) / bidCount : 0
                stats[type].push({ salePrice, avgBidPrice, bidCount, leadId: lead.id })
            }
        }

        const result: Record<string, { avgSale: number; avgBidPrice: number; maxSale: number; count: number }> = {}
        for (const [type, items] of Object.entries(stats)) {
            const count = items.length
            const avgSale = count > 0 ? items.reduce((s, i) => s + i.salePrice, 0) / count : 0
            const avgBidPrice = count > 0 ? items.reduce((s, i) => s + i.avgBidPrice, 0) / count : 0
            const maxSale = count > 0 ? Math.max(...items.map(i => i.salePrice)) : 0
            result[type] = { avgSale, avgBidPrice, maxSale, count }
        }

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('[admin/finance/by-type] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}

