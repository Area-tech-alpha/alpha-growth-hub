import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // Get distinct months from leads.created_at
        // We only care about months where leads exist, as that's the primary stat
        const rows = await prisma.$queryRaw<{ month: string }[]>`
            SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM') as month
            FROM leads
            WHERE created_at IS NOT NULL
            ORDER BY month DESC
        `
        const months = rows.map(r => r.month)

        return NextResponse.json({ months })
    } catch (error: unknown) {
        console.error('[user/available-months] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}
