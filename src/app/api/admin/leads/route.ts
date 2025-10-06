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

        return NextResponse.json({ leadsEntered, leadsSold })
    } catch (error: unknown) {
        console.error('[admin/leads] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


