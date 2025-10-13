import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

        const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
        if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const url = new URL(request.url)
        const q = (url.searchParams.get('q') || '').trim()
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)

        const where = q
            ? {
                role: 'user' as const,
                OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { email: { contains: q, mode: 'insensitive' as const } },
                ],
            }
            : { role: 'user' as const }

        const users = await prisma.users.findMany({
            where,
            select: { id: true, name: true, email: true },
            orderBy: [{ name: 'asc' }, { email: 'asc' }],
            take: limit,
        })

        return NextResponse.json({ users })
    } catch (error: unknown) {
        console.error('[admin/users][GET] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}
