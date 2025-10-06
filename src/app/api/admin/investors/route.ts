import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') // YYYY-MM
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // enforce admin role (prefer role from session if available)
        const sessionRole = (session.user as unknown as { role?: string })?.role
        if (sessionRole !== 'admin') {
            const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
            if (!me || me.role !== 'admin') {
                return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
            }
        }

        // Collect winning bid IDs
        const winning = await prisma.auctions.findMany({
            where: { winning_bid_id: { not: null } },
            select: { winning_bid_id: true },
        })
        const winningIds = winning.map(w => w.winning_bid_id!).filter(Boolean)
        if (winningIds.length === 0) {
            return NextResponse.json({ investors: [] })
        }

        // Sum winning bid amounts by user
        let createdAtWhere: { gte?: Date; lt?: Date } | undefined
        if (monthParam) {
            const [yyyy, mm] = monthParam.split('-').map(Number)
            if (yyyy && mm && mm >= 1 && mm <= 12) {
                const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0))
                const end = new Date(Date.UTC(yyyy, mm, 1, 0, 0, 0))
                createdAtWhere = { gte: start, lt: end }
            }
        }

        const groups = await prisma.bids.groupBy({
            by: ['user_id'],
            where: { id: { in: winningIds }, ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 50,
        })
        const userIds = groups.map(g => g.user_id)
        const users = userIds.length
            ? await prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
            : []

        const investors = groups.map(g => {
            const u = users.find(x => x.id === g.user_id)
            return {
                userId: g.user_id,
                total: g._sum.amount ? Number(g._sum.amount) : 0,
                name: u?.name ?? null,
                email: u?.email ?? null,
            }
        })

        return NextResponse.json({ investors })
    } catch (error: unknown) {
        console.error('[admin/investors] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


