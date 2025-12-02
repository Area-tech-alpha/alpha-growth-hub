import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type BidErrorBody = {
    error: string
    code: string
    meta?: Record<string, unknown>
}

type BidSuccessBody = {
    bid: { id: string; auction_id: string; user_id: string; amount: number }
    availableCredits: number
    nextExpiredAt?: string | null
}

type BidResult =
    | { status: 201; body: BidSuccessBody }
    | { status: 400 | 401 | 402 | 404 | 409; body: BidErrorBody }

const buildErrorPayload = (code: string, message: string, meta?: Record<string, unknown>): BidErrorBody => ({
    error: message,
    code,
    ...(meta ? { meta } : {})
})

const buildErrorResult = <S extends BidResult['status']>(
    status: S,
    code: string,
    message: string,
    meta?: Record<string, unknown>
): Extract<BidResult, { status: S }> => ({
    status,
    body: buildErrorPayload(code, message, meta)
}) as Extract<BidResult, { status: S }>

export const runtime = 'nodejs'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(buildErrorPayload('NOT_AUTHENTICATED', 'Faca login para enviar lances.'), { status: 401 })
        }
        const userId = session.user.id

        const body = await request.json().catch(() => ({})) as { auction_id?: string; amount?: number; buy_now?: boolean; idempotency_key?: string }
        const auctionId = String(body.auction_id || '')
        const amount = Number(body.amount)
        const buyNow = Boolean(body.buy_now)
        const headerKey = request.headers.get('idempotency-key') || ''
        const bodyKey = typeof (body as { idempotency_key?: string }).idempotency_key === 'string' ? (body as { idempotency_key?: string }).idempotency_key as string : ''
        const idemKey = (headerKey || bodyKey).trim()
        if (!auctionId || !Number.isFinite(amount)) {
            return NextResponse.json(buildErrorPayload('INVALID_PAYLOAD', 'Envie o identificador do leilao e o valor do lance.'), { status: 400 })
        }

        const result = await prisma.$transaction<BidResult>(async (tx: Prisma.TransactionClient) => {
            let nextExpiredAt: string | null = null
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
            // Serialize actions per auction using an advisory lock (waits up to lock_timeout)
            try {
                await tx.$executeRawUnsafe("set local lock_timeout = '3s'");
            } catch { }
            // Keep blocking lock as-is; optionally we could switch to try-lock here
            // Use executeRaw for functions that return void to avoid Prisma deserialization errors
            await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${auctionId}))`;

            // Minimal idempotency if table exists
            if (idemKey) {
                try {
                    const inserted = await tx.$executeRaw`insert into public.request_keys(key) values (${idemKey}) on conflict (key) do nothing`;
                    if (!inserted) {
                        return buildErrorResult(409, 'DUPLICATE_REQUEST', 'Detectamos um envio duplicado. Aguarde e atualize o leilao.')
                    }
                } catch { /* ignore if table is missing */ }
            }

            const auction = await tx.auctions.findUnique({ where: { id: auctionId } })
            if (!auction) {
                return buildErrorResult(404, 'AUCTION_NOT_FOUND', 'Nao encontramos esse leilao. Ele pode ter sido encerrado ou removido.')
            }
            if (auction.status !== 'open' || new Date(auction.expired_at).getTime() <= Date.now()) {
                return buildErrorResult(
                    409,
                    'AUCTION_CLOSED',
                    'Esse leilao ja foi encerrado. Atualize a lista de leiloes antes de tentar novamente.',
                    { status: auction.status, expiredAt: auction.expired_at }
                )
            }

            const topBid = await tx.bids.findFirst({
                where: { auction_id: auctionId },
                orderBy: [{ amount: 'desc' }, { created_at: 'desc' }]
            })
            const currentTop = topBid ? toNum(topBid.amount as unknown) : 0
            const minimumBid = toNum(auction.minimum_bid as unknown)
            const nextMinFromTop = currentTop > 0 ? Math.ceil(currentTop * 1.10) : 0
            const requiredMin = Math.max(minimumBid, nextMinFromTop)
            const lead = auction.lead_id
                ? await tx.leads.findUnique({ where: { id: auction.lead_id }, select: { status: true } })
                : null
            const leadStatus = typeof lead?.status === 'string' ? lead.status.toLowerCase() : ''
            const buyNowMultiplier = leadStatus === 'hot' ? 1.2 : 1.5
            if (!Number.isFinite(amount)) {
                return buildErrorResult(400, 'INVALID_AMOUNT', 'Valor de lance invalido. Informe um numero valido.')
            }
            // Server-side buy-now price
            const serverBuyNowPrice = Math.ceil(requiredMin * buyNowMultiplier)
            if (!buyNow) {
                if (amount < requiredMin) {
                    return buildErrorResult(
                        400,
                        'BID_TOO_LOW',
                        `Seu lance deve ser de pelo menos R$ ${requiredMin}.`,
                        { minimumAmount: requiredMin }
                    )
                }
            }

            const user = await tx.users.findUnique({ where: { id: userId } })
            const creditBalance = toNum(user?.credit_balance as unknown)
            let effectiveBalance = creditBalance

            const existingHold = await tx.credit_holds.findFirst({
                where: { user_id: userId, auction_id: auctionId }
            })
            const existingHoldAmount = existingHold?.status === 'active' ? toNum(existingHold.amount as unknown) : 0

            const holds = await tx.credit_holds.findMany({
                where: { user_id: userId, status: 'active', auctions: { status: 'open' } },
                select: { amount: true, auction_id: true }
            })
            const totalActiveHolds = holds.reduce((sum, h) => sum + toNum(h.amount as unknown), 0)
            const effectiveAmount = buyNow ? serverBuyNowPrice : amount
            const availableExcludingThis = creditBalance - (totalActiveHolds - existingHoldAmount)
            const deltaNeeded = effectiveAmount - existingHoldAmount
            if (availableExcludingThis < deltaNeeded) {
                return buildErrorResult(
                    402,
                    'INSUFFICIENT_CREDITS',
                    `Voce precisa de pelo menos R$ ${effectiveAmount} em creditos livres para enviar esse lance.`,
                    {
                        availableCredits: creditBalance - totalActiveHolds,
                        requiredCredits: effectiveAmount
                    }
                )
            }

            const bid = await tx.bids.create({
                data: {
                    auction_id: auctionId,
                    user_id: userId,
                    amount: new Prisma.Decimal(effectiveAmount)
                }
            })

            if (existingHold) {
                await tx.credit_holds.update({
                    where: { id: existingHold.id },
                    data: {
                        amount: bid.amount,
                        bid_id: bid.id,
                        status: 'active',
                        updated_at: new Date() as unknown as Date
                    }
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

            if (topBid?.user_id && topBid.user_id !== userId) {
                // Previous leader was outbid: release their hold so credits return immediately
                await tx.credit_holds.updateMany({
                    where: { bid_id: topBid.id, status: 'active' },
                    data: { status: 'released', updated_at: new Date() as unknown as Date }
                })
            }

            if (buyNow) {
                // Fecha imediatamente
                await tx.auctions.update({ where: { id: auctionId }, data: { status: 'closed_won', winning_bid_id: bid.id, expired_at: new Date() as unknown as Date } })
                await tx.leads.update({ where: { id: auction.lead_id }, data: { status: 'sold', owner_id: userId } })

                const holdsForAuction = await tx.credit_holds.findMany({ where: { auction_id: auctionId, status: 'active' } })
                const winnerHold = holdsForAuction.find(h => h.user_id === userId)
                if (winnerHold) {
                    await tx.credit_holds.update({ where: { id: winnerHold.id }, data: { status: 'consumed', updated_at: new Date() as unknown as Date } })
                }
                const loserIds = holdsForAuction.filter(h => h.user_id !== userId).map(h => h.id)
                if (loserIds.length > 0) {
                    await tx.credit_holds.updateMany({ where: { id: { in: loserIds } }, data: { status: 'released', updated_at: new Date() as unknown as Date } })
                }

                const winner = await tx.users.findUnique({ where: { id: userId }, select: { credit_balance: true } })
                const winnerBalance = toNum(winner?.credit_balance as unknown)
                const nextBalance = new Prisma.Decimal(winnerBalance).minus(new Prisma.Decimal(effectiveAmount))
                await tx.users.update({ where: { id: userId }, data: { credit_balance: nextBalance } })
                effectiveBalance = toNum(nextBalance as unknown)
            } else {
                // Atualiza o lance mínimo para 10% acima do lance atual
                const nextMinimum = Math.ceil(effectiveAmount * 1.10)
                await tx.auctions.update({
                    where: { id: auctionId },
                    data: { minimum_bid: new Prisma.Decimal(nextMinimum) }
                })
            }
            if (!buyNow) {
                // Anti-snipe now happens via DB trigger; fetch the updated expiry to return immediately
                const refreshed = await tx.auctions.findUnique({ where: { id: auctionId }, select: { expired_at: true } })
                if (refreshed?.expired_at) {
                    nextExpiredAt = new Date(refreshed.expired_at as unknown as string).toISOString()
                }
            }

            const holdsAfter = await tx.credit_holds.findMany({ where: { user_id: userId, status: 'active', auctions: { status: 'open' } }, select: { amount: true } })
            const totalHoldsAfter = holdsAfter.reduce((sum, h) => sum + toNum(h.amount as unknown), 0)
            const availableCredits = Math.max(0, effectiveBalance - totalHoldsAfter)

            return {
                status: 201,
                body: {
                    bid: { id: bid.id, auction_id: auctionId, user_id: userId, amount: toNum(bid.amount as unknown) },
                    availableCredits,
                    nextExpiredAt
                }
            }
        })

        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[bid] error:', error)
        return NextResponse.json(
            {
                ...buildErrorPayload('UNEXPECTED_ERROR', 'Nao conseguimos registrar seu lance agora. Tente novamente em instantes.'),
                details: String(error)
            },
            { status: 500 }
        )
    }
}



