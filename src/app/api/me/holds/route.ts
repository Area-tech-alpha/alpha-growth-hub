import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }
        const userId = session.user.id

        const rows = await prisma.credit_holds.findMany({
            where: { user_id: userId, status: 'active', auctions: { status: 'open' } },
            select: { amount: true },
        })
        const sum = (rows || []).reduce((acc, r) => acc + (typeof (r as any).amount === 'string' ? parseFloat((r as any).amount) : Number((r as any).amount || 0)), 0)
        return NextResponse.json({ activeHolds: sum })
    } catch (e) {
        console.error('[API] /api/me/holds error:', e)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}


