import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }
        const userId = session.user.id

        const body = await request.json().catch(() => ({})) as { auction_id?: string; amount?: number }
        const auctionId = String(body.auction_id || '')
        const amount = Number(body.amount)
        if (!auctionId || !Number.isFinite(amount)) {
            return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const toNum = (v: unknown): number => {
                if (v == null) return 0;
                const anyV = v as { toNumber?: () => number };
                if (anyV && typeof anyV.toNumber === 'function') {
                    const n = anyV.toNumber();
                    return Number.isFinite(n) ? n : 0;
                }
                const n = typeof v === 'string' ? parseFloat(v as string) : Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const auction = await tx.auctions.findUnique({ where: { id: auctionId } })
            if (!auction) {
                return { status: 404 as const, body: { error: 'Leilão não encontrado' } }
            }
            if (auction.status !== 'open' || new Date(auction.expired_at).getTime() <= Date.now()) {
                return { status: 409 as const, body: { error: 'Leilão encerrado' } }
            }

            const topBid = await tx.bids.findFirst({
                where: { auction_id: auctionId },
                orderBy: [{ amount: 'desc' }, { created_at: 'desc' }]
            })
            const currentTop = topBid ? toNum(topBid.amount as unknown) : 0
            const minimumBid = toNum(auction.minimum_bid as unknown)
            const requiredMin = Math.max(minimumBid, currentTop + 1)
            if (!Number.isFinite(amount) || amount < requiredMin) {
                return { status: 400 as const, body: { error: `Lance mínimo é ${requiredMin}` } }
            }

            const user = await tx.users.findUnique({ where: { id: userId } })
            const creditBalance = toNum(user?.credit_balance as unknown)

            const existingHold = await tx.credit_holds.findFirst({
                where: { user_id: userId, auction_id: auctionId, status: 'active' }
            })
            const existingHoldAmount = toNum(existingHold?.amount as unknown)

            const holds = await tx.credit_holds.findMany({
                where: { user_id: userId, status: 'active', auctions: { status: 'open' } },
                select: { amount: true, auction_id: true }
            })
            const totalActiveHolds = holds.reduce((sum, h) => sum + toNum(h.amount as unknown), 0)
            const availableExcludingThis = creditBalance - (totalActiveHolds - existingHoldAmount)
            const deltaNeeded = amount - existingHoldAmount
            if (availableExcludingThis < deltaNeeded) {
                return { status: 402 as const, body: { error: 'Créditos insuficientes' } }
            }

            const bid = await tx.bids.create({
                data: {
                    auction_id: auctionId,
                    user_id: userId,
                    amount: new Prisma.Decimal(amount)
                }
            })

            if (existingHold) {
                await tx.credit_holds.update({
                    where: { id: existingHold.id },
                    data: { amount: bid.amount, bid_id: bid.id, status: 'active', updated_at: new Date() as unknown as Date }
                })
            } else {
                await tx.credit_holds.create({
                    data: {
                        user_id: userId,
                        auction_id: auctionId,
                        bid_id: bid.id,
                        amount: bid.amount,
                        status: 'active'
                    }
                })
            }

            await tx.auctions.update({
                where: { id: auctionId },
                data: { minimum_bid: new Prisma.Decimal(amount + 1) }
            })

            const holdsAfter = await tx.credit_holds.findMany({ where: { user_id: userId, status: 'active', auctions: { status: 'open' } }, select: { amount: true } })
            const totalHoldsAfter = holdsAfter.reduce((sum, h) => sum + toNum(h.amount as unknown), 0)
            const availableCredits = Math.max(0, creditBalance - totalHoldsAfter)

            return { status: 201 as const, body: { bid: { id: bid.id, auction_id: auctionId, user_id: userId, amount: toNum(bid.amount as unknown) }, availableCredits } }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[bid] error:', error)
        return NextResponse.json({ error: 'Erro interno', details: String(error) }, { status: 500 })
    }
}


