import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') // format: YYYY-MM
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

        let createdAtWhere: { gte?: Date; lt?: Date } | undefined
        if (monthParam) {
            // month boundaries in UTC
            const [yyyy, mm] = monthParam.split('-').map(Number)
            if (yyyy && mm && mm >= 1 && mm <= 12) {
                const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0))
                const end = new Date(Date.UTC(yyyy, mm, 1, 0, 0, 0))
                createdAtWhere = { gte: start, lt: end }
            }
        }

        const totalAgg = await prisma.credit_transactions.aggregate({ _sum: { amount_paid: true }, where: createdAtWhere ? { created_at: createdAtWhere } : undefined })
        const pixAgg = await prisma.credit_transactions.aggregate({ _sum: { amount_paid: true }, where: { ...(createdAtWhere ? { created_at: createdAtWhere } : {}), asaas_payment_id: { not: null } } })
        const cardAgg = await prisma.credit_transactions.aggregate({ _sum: { amount_paid: true }, where: { ...(createdAtWhere ? { created_at: createdAtWhere } : {}), infinitepay_payment_id: { not: null } } })
        const heldAgg = await prisma.users.aggregate({ _sum: { credit_balance: true } })

        const total = totalAgg._sum.amount_paid ? Number(totalAgg._sum.amount_paid) : 0
        const pix = pixAgg._sum.amount_paid ? Number(pixAgg._sum.amount_paid) : 0
        const card = cardAgg._sum.amount_paid ? Number(cardAgg._sum.amount_paid) : 0
        const held = heldAgg._sum.credit_balance ? Number(heldAgg._sum.credit_balance) : 0

        return NextResponse.json({ total, pix, card, held })
    } catch (error: unknown) {
        console.error('[admin/finance] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


