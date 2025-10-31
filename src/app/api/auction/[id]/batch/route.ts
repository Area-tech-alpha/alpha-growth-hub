import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'ID do leilão obrigatório' }, { status: 400 })
    }

    const auction = await prisma.auctions.findUnique({
        where: { id },
        select: { id: true, type: true, batch_auction_id: true },
    })
    if (!auction || auction.type !== 'batch' || !auction.batch_auction_id) {
        return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    }

    const batch = await prisma.batch_auctions.findUnique({
        where: { id: auction.batch_auction_id },
        include: {
            entries: {
                include: {
                    lead: true,
                },
                orderBy: { included_at: 'asc' },
            },
        },
    })

    if (!batch) {
        return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    }

    const leads = batch.entries.map((entry) => {
        const lead = entry.lead
        return {
            id: lead.id,
            company_name: lead.company_name,
            contact_name: lead.contact_name,
            phone: lead.phone,
            email: lead.email,
            state: lead.state,
            city: lead.city,
            revenue: lead.revenue,
            marketing_investment: lead.marketing_investment,
            segment: lead.segment,
            status: lead.status,
            contract_installments: lead.contract_installments,
        }
    })

    return NextResponse.json({
        id: batch.id,
        totalLeads: batch.total_leads,
        leadUnitPrice: toNumber(batch.lead_unit_price),
        minimumBid: toNumber(batch.minimum_bid),
        status: batch.status,
        result: batch.result,
        leads,
    })
}
