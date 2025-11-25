import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type AggregateRow = {
    avg_second: unknown | null
    avg_third: unknown | null
    count_second: bigint | number | null
    count_third: bigint | number | null
    auctions_with_second: bigint | number | null
    auctions_with_third: bigint | number | null
}

const toNumber = (v: unknown): number => {
    const num = typeof v === 'bigint' ? Number(v) : Number(v)
    return Number.isFinite(num) ? num : 0
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') // YYYY-MM
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Nǜo autenticado' }, { status: 401 })
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

        const clauses: Prisma.Sql[] = [
            Prisma.sql`a.status = 'closed_won'`,
            Prisma.sql`(l.contract_url IS NULL OR l.contract_url = '')`, // cold lead
        ]
        if (createdAtWhere?.gte) clauses.push(Prisma.sql`a.created_at >= ${createdAtWhere.gte}`)
        if (createdAtWhere?.lt) clauses.push(Prisma.sql`a.created_at < ${createdAtWhere.lt}`)

        const where = clauses.reduce((acc, clause, idx) => (idx === 0 ? clause : Prisma.sql`${acc} AND ${clause}`))

        const rows = await prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
            WITH filtered_auctions AS (
                SELECT a.id
                FROM auctions a
                JOIN leads l ON l.id = a.lead_id
                WHERE ${where}
            ),
            ordered_bids AS (
                SELECT
                    b.auction_id,
                    b.amount,
                    ROW_NUMBER() OVER (PARTITION BY b.auction_id ORDER BY b.created_at ASC, b.id ASC) AS pos
                FROM bids b
                JOIN filtered_auctions fa ON fa.id = b.auction_id
            )
            SELECT
                AVG(CASE WHEN pos = 2 THEN amount END)::numeric AS avg_second,
                COUNT(*) FILTER (WHERE pos = 2) AS count_second,
                COUNT(DISTINCT auction_id) FILTER (WHERE pos = 2) AS auctions_with_second,
                AVG(CASE WHEN pos = 3 THEN amount END)::numeric AS avg_third,
                COUNT(*) FILTER (WHERE pos = 3) AS count_third,
                COUNT(DISTINCT auction_id) FILTER (WHERE pos = 3) AS auctions_with_third
            FROM ordered_bids
        `)

        const agg = rows[0] || {
            avg_second: 0,
            avg_third: 0,
            count_second: 0,
            count_third: 0,
            auctions_with_second: 0,
            auctions_with_third: 0,
        }

        return NextResponse.json({
            avgSecond: toNumber(agg.avg_second),
            avgThird: toNumber(agg.avg_third),
            countSecond: toNumber(agg.count_second),
            countThird: toNumber(agg.count_third),
            auctionsWithSecond: toNumber(agg.auctions_with_second),
            auctionsWithThird: toNumber(agg.auctions_with_third),
        })
    } catch (error: unknown) {
        console.error('[admin/finance/bid-positions] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}
