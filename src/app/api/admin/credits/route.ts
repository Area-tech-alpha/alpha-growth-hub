import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type PostBody = {
    userId?: string
    email?: string
    credits: number
    reason?: string
    metadata?: Record<string, unknown>
}

async function requireAdmin() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { ok: false as const, status: 401 as const, error: 'Não autenticado' }
    const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true, email: true, name: true, id: true } })
    if (!me || me.role !== 'admin') return { ok: false as const, status: 403 as const, error: 'Acesso negado' }
    return { ok: true as const, me }
}

export async function POST(request: Request) {
    try {
        const adminCheck = await requireAdmin()
        if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        const admin = adminCheck.me!

        const body = (await request.json()) as PostBody
        const { userId, email, credits, reason, metadata } = body

        if (!credits || typeof credits !== 'number' || credits <= 0) {
            return NextResponse.json({ error: 'Créditos inválidos. Deve ser número positivo.' }, { status: 400 })
        }
        if (!userId && !email) {
            return NextResponse.json({ error: 'Informe userId ou email do usuário.' }, { status: 400 })
        }

        const user = userId
            ? await prisma.users.findUnique({ where: { id: userId } })
            : await prisma.users.findFirst({ where: { email: email! } })

        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        const meta = {
            ...(metadata ?? {}),
            source: 'reward',
            kind: 'admin_reward',
            reason: reason || null,
            granted_by: { id: admin.id, email: admin.email, name: admin.name },
            granted_at: new Date().toISOString(),
        }

        const result = await prisma.$transaction(async (tx) => {
            const ct = await tx.credit_transactions.create({
                data: {
                    user_id: user.id,
                    amount_paid: 0,
                    credits_purchased: credits,
                    status: 'completed',
                    source: 'reward',
                    metadata: meta as unknown as object,
                },
            })

            await tx.users.update({
                where: { id: user.id },
                data: { credit_balance: { increment: credits } },
            })

            await tx.ledger_entries.create({
                data: {
                    transaction_id: ct.id,
                    user_id: user.id,
                    account_type: 'USER_CREDITS',
                    amount: credits,
                    credit_source: 'reward',
                },
            })

            return { transactionId: ct.id }
        })

        return NextResponse.json({ ok: true, transactionId: result.transactionId })
    } catch (error) {
        console.error('[admin/credits][POST] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}

export async function GET(request: Request) {
    try {
        const adminCheck = await requireAdmin()
        if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        const url = new URL(request.url)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100)

        // Preferimos filtrar por metadata->>'source' = 'reward' (até o campo source existir no schema)
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `
            SELECT ct.id, ct.user_id, ct.credits_purchased, ct.amount_paid, ct.created_at, ct.metadata,
                   u.email, u.name
            FROM credit_transactions ct
            JOIN users u ON u.id = ct.user_id
            WHERE (ct.metadata->>'source') = 'reward'
            ORDER BY ct.created_at DESC
            LIMIT $1
            `,
            limit,
        )

        const items = rows.map((r) => ({
            id: String(r.id),
            userId: r.user_id as string,
            email: r.email as string | null,
            name: r.name as string | null,
            credits: Number(r.credits_purchased) || 0,
            amountPaid: Number(r.amount_paid) || 0,
            createdAt: r.created_at,
            metadata: r.metadata,
        }))

        return NextResponse.json({ items })
    } catch (error) {
        console.error('[admin/credits][GET] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}
