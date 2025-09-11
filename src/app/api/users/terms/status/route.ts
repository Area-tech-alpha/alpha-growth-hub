import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }
        const userId = session.user.id
        const user = await prisma.users.findUnique({ where: { id: userId }, select: { accepted_terms_at: true } as unknown as Record<string, unknown> }) as unknown as { accepted_terms_at?: Date | string | null }
        const accepted = Boolean(user?.accepted_terms_at)
        return NextResponse.json({ accepted })
    } catch (e) {
        console.error('[terms.status] error:', e)
        return NextResponse.json({ error: 'Erro ao verificar termos' }, { status: 500 })
    }
}


