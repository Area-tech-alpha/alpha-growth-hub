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

        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        })

        const role = user?.role ?? 'user'

        return NextResponse.json({ role })
    } catch (error) {
        console.error('[API] Erro ao obter role:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}

