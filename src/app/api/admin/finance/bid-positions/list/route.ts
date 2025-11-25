import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../../auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type Row = {
    auction_id: string
    amount: unknown
    pos: number
    created_at: Date | null
    user_id: string
    user_name: string | null
    user_email: string | null
}

const toNumber = (v: unknown): number => {
    const n = typeof v === 'bigint' ? Number(v) : Number(v)
    return Number.isFinite(n) ? n : 0
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
            Prisma.sql`(l.contract_url IS NULL OR l.contract_url = '')`, // cold
        ]
        if (createdAtWhere?.gte) clauses.push(Prisma.sql`a.created_at >= ${createdAtWhere.gte}`)
        if (createdAtWhere?.lt) clauses.push(Prisma.sql`a.created_at < ${createdAtWhere.lt}`)
        const where = clauses.reduce((acc, clause, idx) => (idx === 0 ? clause : Prisma.sql`${acc} AND ${clause}`))

        const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
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
                    b.created_at,
                    b.user_id,
                    ROW_NUMBER() OVER (PARTITION BY b.auction_id ORDER BY b.created_at ASC, b.id ASC) AS pos
                FROM bids b
                JOIN filtered_auctions fa ON fa.id = b.auction_id
                WHERE b.user_id IS NOT NULL
            )
            SELECT
                ob.auction_id,
                ob.amount,
                ob.created_at,
                ob.user_id,
                ob.pos,
                u.name AS user_name,
                u.email AS user_email
            FROM ordered_bids ob
            LEFT JOIN users u ON u.id = ob.user_id
            WHERE ob.pos IN (2, 3)
            ORDER BY ob.created_at ASC NULLS LAST, ob.auction_id, ob.pos
        `)

        const items = rows.map(r => ({
            auctionId: r.auction_id,
            amount: toNumber(r.amount),
            position: toNumber(r.pos),
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            user: {
                id: r.user_id,
                name: r.user_name,
                email: r.user_email,
            },
        }))

        return NextResponse.json({ items })
    } catch (error: unknown) {
        console.error('[admin/finance/bid-positions/list] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}
