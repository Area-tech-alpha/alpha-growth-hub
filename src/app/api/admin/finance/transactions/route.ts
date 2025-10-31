import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

const MAX_PAGE_SIZE = 100

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month')
        const pageParam = Number(url.searchParams.get('page') ?? '1')
        const pageSizeParam = Number(url.searchParams.get('pageSize') ?? '20')

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

        const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1
        const pageSizeBase = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.floor(pageSizeParam) : 20
        const pageSize = Math.min(pageSizeBase, MAX_PAGE_SIZE)
        const skip = (page - 1) * pageSize

        let createdAtWhere: { gte?: Date; lt?: Date } | undefined
        if (monthParam) {
            const [yyyyRaw, mmRaw] = monthParam.split('-')
            const yyyy = Number(yyyyRaw)
            const mm = Number(mmRaw)
            if (yyyy && mm >= 1 && mm <= 12) {
                const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0))
                const end = new Date(Date.UTC(yyyy, mm, 1, 0, 0, 0))
                createdAtWhere = { gte: start, lt: end }
            }
        }

        const providerWhere = { OR: [{ asaas_payment_id: { not: null } }, { infinitepay_payment_id: { not: null } }] }
        const where = createdAtWhere
            ? { AND: [{ created_at: createdAtWhere }, providerWhere] }
            : providerWhere

        const [totalCount, records] = await Promise.all([
            prisma.credit_transactions.count({ where }),
            prisma.credit_transactions.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: pageSize,
                include: { users: { select: { id: true, name: true, email: true } } },
            }),
        ])

        const transactions = records.map(tx => {
            const provider = tx.asaas_payment_id ? 'asaas' : tx.infinitepay_payment_id ? 'infinitepay' : 'unknown'
            return {
                id: String(tx.id),
                user: {
                    id: tx.user_id,
                    name: tx.users?.name ?? null,
                    email: tx.users?.email ?? null,
                },
                provider,
                providerPaymentId: tx.asaas_payment_id ?? tx.infinitepay_payment_id ?? null,
                asaasPaymentId: tx.asaas_payment_id,
                infinitepayPaymentId: tx.infinitepay_payment_id,
                status: tx.status,
                source: String(tx.source ?? ''),
                amountPaid: Number(tx.amount_paid ?? 0),
                creditsPurchased: Number(tx.credits_purchased ?? 0),
                createdAt: tx.created_at ? tx.created_at.toISOString() : null,
                metadata: tx.metadata ?? null,
            }
        })

        const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

        return NextResponse.json({
            page,
            pageSize,
            total: totalCount,
            totalPages,
            transactions,
        })
    } catch (error: unknown) {
        console.error('[admin/finance/transactions] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}
