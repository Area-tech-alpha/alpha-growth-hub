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

        // Segmentar por origem (tenta usar coluna `source`; se falhar, usa fallback no metadata)
        let bySourceRows: { derived_source: string | null, amount_paid_sum: any, credits_sum: any }[] = []
        try {
            const where = createdAtWhere ? { created_at: createdAtWhere } : undefined
            const grouped = await prisma.credit_transactions.groupBy({
                by: ['source'],
                where,
                _sum: { amount_paid: true, credits_purchased: true },
            })
            bySourceRows = grouped.map(g => ({
                derived_source: g.source as unknown as string,
                amount_paid_sum: g._sum.amount_paid ?? 0,
                credits_sum: g._sum.credits_purchased ?? 0,
            }))
        } catch {
            const start = createdAtWhere?.gte ?? null
            const end = createdAtWhere?.lt ?? null
            bySourceRows = await prisma.$queryRawUnsafe<{ derived_source: string | null, amount_paid_sum: any, credits_sum: any }[]>(
                `
                WITH filtered AS (
                  SELECT
                    ct.*,
                    COALESCE(NULLIF(ct.metadata->>'source',''),
                             CASE WHEN ct.amount_paid > 0 OR ct.asaas_payment_id IS NOT NULL OR ct.infinitepay_payment_id IS NOT NULL
                                  THEN 'monetary' ELSE 'monetary' END) AS derived_source
                  FROM credit_transactions ct
                  WHERE ($1::timestamptz IS NULL OR ct.created_at >= $1)
                    AND ($2::timestamptz IS NULL OR ct.created_at < $2)
                )
                SELECT derived_source,
                       COALESCE(SUM(amount_paid),0) AS amount_paid_sum,
                       COALESCE(SUM(credits_purchased),0) AS credits_sum
                FROM filtered
                GROUP BY derived_source
                `,
                start,
                end,
            )
        }

        const total = totalAgg._sum.amount_paid ? Number(totalAgg._sum.amount_paid) : 0
        const pix = pixAgg._sum.amount_paid ? Number(pixAgg._sum.amount_paid) : 0
        const card = cardAgg._sum.amount_paid ? Number(cardAgg._sum.amount_paid) : 0
        const held = heldAgg._sum.credit_balance ? Number(heldAgg._sum.credit_balance) : 0

        // Mapear resultado para estrutura amigável
        const base = { amountPaid: 0, credits: 0 }
        const bySource: Record<string, { amountPaid: number, credits: number }> = {
            monetary: { ...base },
            reward: { ...base },
            adjustment: { ...base },
            unknown: { ...base },
        }
        for (const r of bySourceRows) {
            const key = (r.derived_source || 'unknown') as keyof typeof bySource
            const amountPaid = Number(r.amount_paid_sum || 0)
            const credits = Number(r.credits_sum || 0)
            if (!bySource[key]) bySource[key] = { amountPaid: 0, credits: 0 }
            bySource[key].amountPaid += amountPaid
            bySource[key].credits += credits
        }

        return NextResponse.json({ total, pix, card, held, bySource })
    } catch (error: unknown) {
        console.error('[admin/finance] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


