import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }
        const userId = session.user.id
        await prisma.users.update({ where: { id: userId }, data: { accepted_terms_at: new Date() as unknown as Date } })
        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('[terms.accept] error:', e)
        return NextResponse.json({ error: 'Erro ao aceitar termos' }, { status: 500 })
    }
}


