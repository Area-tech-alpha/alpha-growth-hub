import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

type SaleEntry = {
    leadId: string
    auctionId: string
    companyName: string | null
    revenue: string | null
    contractUrl: string | null
    contractValue: number | null
    contractTime: string | null
    soldAt: string | null
    buyer: { id: string | null; name: string | null; email: string | null } | null
    price: number | null
}

const toNumberOrNull = (value: unknown): number | null => {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

const sortBySoldAtDesc = (entries: SaleEntry[]) =>
    entries.sort((a, b) => {
        const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0
        const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0
        return bTime - aTime
    })

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') // YYYY-MM
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
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

        // hot = has contract_url, cold = no contract_url
        // fetch only sold leads with their winning bids and buyer info
        const soldLeads = await prisma.leads.findMany({
            where: { status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            select: {
                id: true,
                company_name: true,
                revenue: true,
                contract_url: true,
                contract_value: true,
                contract_time: true,
                auctions: {
                    where: { winning_bid_id: { not: null } },
                    select: {
                        id: true,
                        created_at: true,
                        bids_auctions_winning_bid_idTobids: {
                            select: {
                                amount: true,
                                created_at: true,
                                users: { select: { id: true, name: true, email: true } },
                            },
                        },
                    },
                },
            },
        })

        const hotValues: number[] = []
        const coldValues: number[] = []
        const hotItems: SaleEntry[] = []
        const coldItems: SaleEntry[] = []

        for (const lead of soldLeads) {
            const isHot = Boolean(lead.contract_url)
            for (const auction of lead.auctions) {
                const winningBid = auction.bids_auctions_winning_bid_idTobids
                if (!winningBid) continue

                const salePrice = toNumberOrNull(winningBid.amount)
                const soldAtIso = (winningBid.created_at ?? auction.created_at ?? null)
                    ? new Date((winningBid.created_at ?? auction.created_at) as Date).toISOString()
                    : null
                const entry: SaleEntry = {
                    leadId: lead.id,
                    auctionId: auction.id,
                    companyName: lead.company_name,
                    revenue: lead.revenue,
                    contractUrl: lead.contract_url,
                    contractValue: toNumberOrNull(lead.contract_value),
                    contractTime: lead.contract_time,
                    soldAt: soldAtIso,
                    buyer: winningBid.users
                        ? { id: winningBid.users.id, name: winningBid.users.name, email: winningBid.users.email }
                        : null,
                    price: salePrice,
                }

                if (salePrice !== null) {
                    if (isHot) {
                        hotValues.push(salePrice)
                    } else {
                        coldValues.push(salePrice)
                    }
                }

                if (isHot) {
                    hotItems.push(entry)
                } else {
                    coldItems.push(entry)
                }
            }
        }

        sortBySoldAtDesc(hotItems)
        sortBySoldAtDesc(coldItems)

        const buildStats = (values: number[], items: SaleEntry[]) => {
            const count = values.length
            const totalSale = values.reduce((s, v) => s + v, 0)
            const avgSale = count > 0 ? totalSale / count : 0
            const maxSale = count > 0 ? Math.max(...values) : 0
            return { count, avgSale, maxSale, totalSale, items }
        }

        return NextResponse.json({
            hot: buildStats(hotValues, hotItems),
            cold: buildStats(coldValues, coldItems),
        })
    } catch (error: unknown) {
        console.error('[admin/finance/by-status] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}
