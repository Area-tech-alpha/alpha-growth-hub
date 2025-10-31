import { prisma } from '@/lib/prisma'
import {
    Prisma,
    type PrismaClient,
    type batch_auction_settings as BatchAuctionSettings,
    type auctions as AuctionRow,
    type batch_auctions as BatchAuctionRow,
} from '@prisma/client'

const DEFAULT_THRESHOLD = 20
const DEFAULT_LEAD_UNIT_PRICE = new Prisma.Decimal(225)
const BATCH_LOCK_KEY = 'batch_auction_create_lock_v1'

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
type ClientLike = TxClient | PrismaClient

const toDecimal = (value: Prisma.Decimal | null | number | string | undefined): Prisma.Decimal => {
    if (value instanceof Prisma.Decimal) return value
    if (typeof value === 'number' || typeof value === 'string') return new Prisma.Decimal(value)
    return DEFAULT_LEAD_UNIT_PRICE
}

const nowUtc = () => new Date()

const computeDefaultExpiration = (baseMinutes = 5) => {
    const expiry = new Date(Date.now() + baseMinutes * 60 * 1000)
    return expiry
}

const getClient = (client?: TxClient | PrismaClient): ClientLike => client ?? prisma

export const getBatchSettings = async (client?: ClientLike): Promise<BatchAuctionSettings> => {
    const db = getClient(client)
    const settings = await db.batch_auction_settings.findFirst({
        orderBy: { created_at: 'desc' },
    })
    if (settings) {
        return settings
    }
    return db.batch_auction_settings.create({
        data: {
            low_frozen_threshold: DEFAULT_THRESHOLD,
            auto_trigger_enabled: false,
            lead_unit_price: DEFAULT_LEAD_UNIT_PRICE,
        },
    })
}

type UpdateSettingsInput = {
    lowFrozenThreshold: number
    autoTriggerEnabled: boolean
    leadUnitPrice?: number
    updatedBy?: string
}

export const updateBatchSettings = async (input: UpdateSettingsInput, client?: ClientLike) => {
    const db = getClient(client)
    const threshold = Math.max(1, Math.floor(input.lowFrozenThreshold || DEFAULT_THRESHOLD))
    const unitPrice = input.leadUnitPrice != null && !Number.isNaN(input.leadUnitPrice) && input.leadUnitPrice > 0
        ? new Prisma.Decimal(input.leadUnitPrice)
        : DEFAULT_LEAD_UNIT_PRICE

    const current = await db.batch_auction_settings.findFirst({ orderBy: { created_at: 'desc' } })
    if (!current) {
        return db.batch_auction_settings.create({
            data: {
                low_frozen_threshold: threshold,
                auto_trigger_enabled: input.autoTriggerEnabled,
                lead_unit_price: unitPrice,
                updated_by: input.updatedBy,
            },
        })
    }
    return db.batch_auction_settings.update({
        where: { id: current.id },
        data: {
            low_frozen_threshold: threshold,
            auto_trigger_enabled: input.autoTriggerEnabled,
            lead_unit_price: unitPrice,
            updated_by: input.updatedBy,
            updated_at: nowUtc(),
        },
    })
}

type BatchCreationOptions = {
    mode: 'auto' | 'manual'
    allowPartial?: boolean
    batchSize?: number
    actorId?: string
    metadata?: Record<string, unknown>
    client?: PrismaClient
}

export type CreatedBatchSummary = {
    batch: BatchAuctionRow
    auction: AuctionRow
    leadIds: string[]
    settings: BatchAuctionSettings
}

export const createBatchAuction = async (options: BatchCreationOptions): Promise<{ created: true; summary: CreatedBatchSummary } | { created: false; reason: 'NOT_ENOUGH' | 'EMPTY' }> => {
    const { mode, allowPartial = false, batchSize, actorId, metadata } = options
    const triggerReason: Prisma.batch_auction_trigger_enum = mode === 'auto' ? 'auto' : 'manual'

    try {
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`select pg_advisory_xact_lock(hashtext('${BATCH_LOCK_KEY}'))`)

            const settings = await getBatchSettings(tx)
            const targetBatchSize = Math.max(1, Math.min(batchSize ?? settings.low_frozen_threshold, 500))
            const minRequired = allowPartial ? 1 : settings.low_frozen_threshold

            const eligible = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
                SELECT id, status
                FROM leads
                WHERE status = 'low_frozen'
                  AND batch_auction_id IS NULL
                ORDER BY created_at ASC
                LIMIT ${targetBatchSize}
                FOR UPDATE SKIP LOCKED
            `)

            if (eligible.length === 0) {
                return { created: false as const, reason: 'EMPTY' as const }
            }

            if (eligible.length < minRequired) {
                return { created: false as const, reason: 'NOT_ENOUGH' as const }
            }

            const leadIds = eligible.map((row) => row.id)
            const unitPrice = toDecimal(settings.lead_unit_price)
            const minimumBid = unitPrice.mul(leadIds.length)

            const batch = await tx.batch_auctions.create({
                data: {
                    total_leads: leadIds.length,
                    lead_unit_price: unitPrice,
                    minimum_bid: minimumBid,
                    status: 'running',
                    trigger_reason: triggerReason,
                    metadata: {
                        lead_ids: leadIds,
                        actor_id: actorId ?? null,
                        mode,
                        settings_snapshot: {
                            low_frozen_threshold: settings.low_frozen_threshold,
                            auto_trigger_enabled: settings.auto_trigger_enabled,
                            lead_unit_price: unitPrice.toString(),
                        },
                        ...(metadata ?? {}),
                    } satisfies Prisma.JsonObject,
                },
            })

            await tx.batch_auction_leads.createMany({
                data: leadIds.map((leadId, idx) => ({
                    batch_auction_id: batch.id,
                    lead_id: leadId,
                    status_before_batch: eligible[idx]?.status ?? 'low_frozen',
                })),
            })

            await tx.leads.updateMany({
                where: { id: { in: leadIds } },
                data: {
                    status: 'cold',
                    batched_at: nowUtc(),
                    batch_auction_id: batch.id,
                    batch_result: 'pending',
                },
            })

            const expiration = computeDefaultExpiration()

            const auction = await tx.auctions.create({
                data: {
                    lead_id: leadIds[0],
                    minimum_bid: minimumBid,
                    status: 'open',
                    expired_at: expiration,
                    type: 'batch',
                    batch_auction_id: batch.id,
                },
            })

            return { created: true as const, summary: { batch, auction, leadIds, settings } }
        }, { timeout: 20000 })

        if (!result.created) {
            return result
        }
        return result
    } catch (error) {
        const known = error as Prisma.PrismaClientKnownRequestError
        if (known?.code === 'P2034') {
            return { created: false, reason: 'NOT_ENOUGH' }
        }
        throw error
    }
}
