import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getBatchSettings, updateBatchSettings } from '@/lib/batch-auctions'

export const runtime = 'nodejs'

const toNumber = (value: unknown): number => {
    if (value == null) return 0
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (typeof (value as { toNumber?: () => number })?.toNumber === 'function') {
        const parsed = (value as { toNumber: () => number }).toNumber()
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

export async function GET() {
    try {
        const admin = await requireAdmin()
        if (!admin.ok) {
            return NextResponse.json({ error: admin.error }, { status: admin.status })
        }

        const settings = await getBatchSettings()
        return NextResponse.json({
            id: settings.id,
            lowFrozenThreshold: settings.low_frozen_threshold,
            autoTriggerEnabled: settings.auto_trigger_enabled,
            leadUnitPrice: toNumber(settings.lead_unit_price),
            updatedAt: settings.updated_at,
            updatedBy: settings.updated_by,
        })
    } catch (error) {
        console.error('[batch-auctions][settings][GET]', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const admin = await requireAdmin()
        if (!admin.ok) {
            return NextResponse.json({ error: admin.error }, { status: admin.status })
        }

        let body: { lowFrozenThreshold?: unknown; autoTriggerEnabled?: unknown; leadUnitPrice?: unknown } = {}
        try {
            body = await request.json()
        } catch {
            /* noop */
        }

        const threshold = Math.max(1, Math.floor(Number(body.lowFrozenThreshold ?? body['low_frozen_threshold']) || 0))
        const autoTriggerEnabled = Boolean(body.autoTriggerEnabled ?? body['auto_trigger_enabled'])
        const leadUnitPriceRaw = body.leadUnitPrice ?? body['lead_unit_price']
        const leadUnitPriceNum = leadUnitPriceRaw == null ? undefined : Number(leadUnitPriceRaw)
        if (leadUnitPriceNum != null && (!Number.isFinite(leadUnitPriceNum) || leadUnitPriceNum <= 0)) {
            return NextResponse.json({ error: 'Valor do lead inválido' }, { status: 400 })
        }

        const updated = await updateBatchSettings(
            {
                lowFrozenThreshold: threshold,
                autoTriggerEnabled,
                leadUnitPrice: leadUnitPriceNum,
                updatedBy: admin.user.id,
            },
            undefined,
        )

        return NextResponse.json({
            id: updated.id,
            lowFrozenThreshold: updated.low_frozen_threshold,
            autoTriggerEnabled: updated.auto_trigger_enabled,
            leadUnitPrice: toNumber(updated.lead_unit_price),
            updatedAt: updated.updated_at,
            updatedBy: updated.updated_by,
        })
    } catch (error) {
        console.error('[batch-auctions][settings][PUT]', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
