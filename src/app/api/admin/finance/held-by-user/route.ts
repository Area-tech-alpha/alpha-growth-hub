import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
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

        // Top users with balance > 0, ordered by balance desc
        const topUsers = await prisma.users.findMany({
            where: { credit_balance: { gt: 0 } },
            orderBy: { credit_balance: 'desc' },
            take: 10,
            select: { id: true, name: true, email: true, credit_balance: true },
        })

        const users = topUsers.map(u => ({
            userId: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
            balance: Number(u.credit_balance),
        }))

        return NextResponse.json({ users })
    } catch (error: unknown) {
        console.error('[admin/finance/held-by-user] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}

