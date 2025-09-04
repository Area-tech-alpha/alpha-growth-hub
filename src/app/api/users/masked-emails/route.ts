import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({})) as { userIds?: string[] }
        const userIds = Array.isArray(body.userIds) ? Array.from(new Set(body.userIds.filter(Boolean))).slice(0, 200) : []
        if (userIds.length === 0) {
            return NextResponse.json({ maskedEmails: {} })
        }

        const rows = await prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true }
        })
        const emails: Record<string, string> = {}
        for (const row of rows) {
            if (row?.id && row?.email) emails[row.id] = String(row.email)
        }

        return NextResponse.json({ emails })
    } catch (error: unknown) {
        console.error('[users/masked-emails] error:', error)
        return NextResponse.json({ error: 'Erro interno', details: String(error) }, { status: 500 })
    }
}


