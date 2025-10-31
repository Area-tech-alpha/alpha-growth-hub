import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const runtime = 'nodejs'

const toNumber = (value: unknown): number => {
    if (value == null) return 0
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (typeof (value as { toNumber?: () => number })?.toNumber === 'function') {
        const parsed = (value as { toNumber: () => number }).toNumber()
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

export async function GET(request: Request) {
    try {
        const admin = await requireAdmin()
        if (!admin.ok) {
            return NextResponse.json({ error: admin.error }, { status: admin.status })
        }

        const url = new URL(request.url)
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100)

        const [rows, eligibleLowFrozen] = await Promise.all([
            prisma.batch_auctions.findMany({
                orderBy: { created_at: 'desc' },
                take: limit,
                include: {
                    auction: {
                        select: {
                            id: true,
                            status: true,
                            expired_at: true,
                            minimum_bid: true,
                        },
                    },
                },
            }),
            prisma.leads.count({ where: { status: 'low_frozen', batch_auction_id: null } }),
        ])

        const batches = rows.map((row) => ({
            id: row.id,
            totalLeads: row.total_leads,
            leadUnitPrice: toNumber(row.lead_unit_price),
            minimumBid: toNumber(row.minimum_bid),
            status: row.status,
            result: row.result,
            triggerReason: row.trigger_reason,
            createdAt: row.created_at,
            expiredAt: row.expired_at,
            auction: row.auction
                ? {
                      id: row.auction.id,
                      status: row.auction.status,
                      minimumBid: toNumber(row.auction.minimum_bid),
                      expiredAt: row.auction.expired_at,
                  }
                : null,
        }))

        return NextResponse.json({
            batches,
            stats: { eligibleLowFrozen },
        })
    } catch (error) {
        console.error('[batch-auctions][GET]', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
