import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const source = url.searchParams.get('source') // 'leads' or 'finance'
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

        let months: string[] = []

        if (source === 'leads') {
            // Get distinct months from leads.created_at
            const rows = await prisma.$queryRaw<{ month: string }[]>`
                SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM') as month
                FROM leads
                WHERE created_at IS NOT NULL
                ORDER BY month DESC
            `
            months = rows.map(r => r.month)
        } else if (source === 'finance') {
            // Get distinct months from credit_transactions.created_at
            const rows = await prisma.$queryRaw<{ month: string }[]>`
                SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM') as month
                FROM credit_transactions
                WHERE created_at IS NOT NULL
                ORDER BY month DESC
            `
            months = rows.map(r => r.month)
        }

        return NextResponse.json({ months })
    } catch (error: unknown) {
        console.error('[admin/available-months] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}

