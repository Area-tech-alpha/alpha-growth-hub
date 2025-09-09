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

        const body = await request.json().catch(() => ({})) as { auction_id?: string; amount?: number; buy_now?: boolean }
        const auctionId = String(body.auction_id || '')
        const amount = Number(body.amount)
        const buyNow = Boolean(body.buy_now)
        if (!auctionId || !Number.isFinite(amount)) {
            return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
        }
        console.log('[bid] received', { auctionId, userId, amount, buyNow })

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
            const nextMinFromTop = currentTop > 0 ? Math.ceil(currentTop * 1.10) : 0
            const requiredMin = Math.max(minimumBid, nextMinFromTop)
            if (!Number.isFinite(amount)) {
                return { status: 400 as const, body: { error: 'Valor inválido' } }
            }
            if (buyNow) {
                const buyNowMin = Math.ceil(requiredMin * 1.5)
                if (amount < buyNowMin) {
                    return { status: 400 as const, body: { error: `Comprar já! requer no mínimo ${buyNowMin}` } }
                }
            } else {
                if (amount < requiredMin) {
                    return { status: 400 as const, body: { error: `Lance mínimo é ${requiredMin}` } }
                }
            }

            const user = await tx.users.findUnique({ where: { id: userId } })
            const creditBalance = toNum(user?.credit_balance as unknown)
            let effectiveBalance = creditBalance
            if (buyNow) {
                console.log('[bid] buy-now start', { auctionId, userId, creditBalanceBefore: creditBalance })
            }

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

            if (buyNow) {
                // Fecha imediatamente: marca como ganho, expira agora e transfere lead
                await tx.auctions.update({ where: { id: auctionId }, data: { status: 'closed_won', winning_bid_id: bid.id, expired_at: new Date() as unknown as Date } })
                await tx.leads.update({ where: { id: auction.lead_id }, data: { status: 'sold', owner_id: userId } })

                // Consome hold do vencedor e libera os demais
                const holdsForAuction = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' } })
                const winnerHold = holdsForAuction.find(h => h.user_id === userId)
                if (winnerHold) {
                    await tx.credit_holds.update({ where: { id: winnerHold.id }, data: { status: 'consumed', updated_at: new Date() as unknown as Date } })
                    console.log('[bid] buy-now consumed winner hold', { auctionId, holdId: winnerHold.id, amount: String(winnerHold.amount) })
                }
                const loserIds = holdsForAuction.filter(h => h.user_id !== userId).map(h => h.id)
                if (loserIds.length > 0) {
                    await tx.credit_holds.updateMany({ where: { id: { in: loserIds } }, data: { status: 'released', updated_at: new Date() as unknown as Date } })
                    console.log('[bid] buy-now released loser holds', { auctionId, releasedCount: loserIds.length })
                }

                // Debita saldo do vencedor
                const winner = await tx.users.findUnique({ where: { id: userId }, select: { credit_balance: true } })
                const winnerBalance = toNum(winner?.credit_balance as unknown)
                const nextBalance = new Prisma.Decimal(winnerBalance).minus(new Prisma.Decimal(amount))
                await tx.users.update({ where: { id: userId }, data: { credit_balance: nextBalance } })
                effectiveBalance = toNum(nextBalance as unknown)
                console.log('[bid] buy-now debited balance', { userId, before: winnerBalance, amount, after: effectiveBalance })
            } else {
                // Atualiza o lance mínimo para 10% acima do lance atual
                const nextMinimum = Math.ceil(amount * 1.10)
                await tx.auctions.update({
                    where: { id: auctionId },
                    data: { minimum_bid: new Prisma.Decimal(nextMinimum) }
                })
            }

            if (!buyNow) {
                // Regra de anti-sniping: apenas para lances normais
                const nowMs = Date.now()
                const expMs = new Date(auction.expired_at as unknown as string).getTime()
                const remainingMs = expMs - nowMs
                if (Number.isFinite(remainingMs) && remainingMs <= 60_000) {
                    const extendToMs = remainingMs > 30_000 ? 67_000 : 37_000
                    const newExpiry = new Date(nowMs + extendToMs) as unknown as Date
                    await tx.auctions.update({
                        where: { id: auctionId },
                        data: { expired_at: newExpiry }
                    })
                }
            }

            const holdsAfter = await tx.credit_holds.findMany({ where: { user_id: userId, status: 'active', auctions: { status: 'open' } }, select: { amount: true } })
            const totalHoldsAfter = holdsAfter.reduce((sum, h) => sum + toNum(h.amount as unknown), 0)
            const availableCredits = Math.max(0, effectiveBalance - totalHoldsAfter)
            if (buyNow) {
                console.log('[bid] buy-now computed availableCredits', { userId, effectiveBalance, totalHoldsAfter, availableCredits })
            }

            return { status: 201 as const, body: { bid: { id: bid.id, auction_id: auctionId, user_id: userId, amount: toNum(bid.amount as unknown) }, availableCredits } }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[bid] error:', error)
        return NextResponse.json({ error: 'Erro interno', details: String(error) }, { status: 500 })
    }
}


