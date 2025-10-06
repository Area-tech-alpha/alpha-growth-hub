import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'
import type { leads as LeadRow } from '@prisma/client'

export async function GET() {
    try {
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

        // considerar apenas leads com status não-nulo (exclui registros com status NULL)
        const leadsEntered = await prisma.$queryRaw<LeadRow[]>`SELECT * FROM "leads" WHERE status IS NOT NULL`

        const leadsSold = await prisma.leads.findMany({ where: { status: 'sold' } })

        // Top buyers (users who purchased the most leads)
        const buyersGroup = await prisma.leads.groupBy({
            by: ['owner_id'],
            where: { owner_id: { not: null }, status: 'sold' },
            _count: { owner_id: true },
            orderBy: { _count: { owner_id: 'desc' } },
            take: 10,
        })
        const buyerIds = buyersGroup.map(b => b.owner_id!).filter(Boolean)
        const buyerUsers = buyerIds.length
            ? await prisma.users.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true, email: true, avatar_url: true } })
            : []
        const topBuyers = buyersGroup.map(b => {
            const u = buyerUsers.find(x => x.id === b.owner_id)
            return { userId: b.owner_id, count: b._count.owner_id, name: u?.name ?? null, email: u?.email ?? null, avatar_url: u?.avatar_url ?? null }
        })

        // Top bidders (users who placed the most bids)
        const biddersGroup = await prisma.bids.groupBy({
            by: ['user_id'],
            _count: { user_id: true },
            orderBy: { _count: { user_id: 'desc' } },
            take: 10,
        })
        const bidderIds = biddersGroup.map(b => b.user_id).filter(Boolean)
        const bidderUsers = bidderIds.length
            ? await prisma.users.findMany({ where: { id: { in: bidderIds } }, select: { id: true, name: true, email: true, avatar_url: true } })
            : []
        const topBidders = biddersGroup.map(b => {
            const u = bidderUsers.find(x => x.id === b.user_id)
            return { userId: b.user_id, count: b._count.user_id, name: u?.name ?? null, email: u?.email ?? null, avatar_url: u?.avatar_url ?? null }
        })

        return NextResponse.json({ leadsEntered, leadsSold, topBuyers, topBidders })
    } catch (error: unknown) {
        console.error('[admin/leads] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


