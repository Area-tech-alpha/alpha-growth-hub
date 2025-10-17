import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../../auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Params = { id: string }

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
    }

    const leads = await prisma.leads.findMany({
      where: { owner_id: userId, status: 'sold' },
      select: {
        id: true,
        company_name: true,
        created_at: true,
        contract_url: true,
        auctions: {
          where: { winning_bid_id: { not: null } },
          select: {
            id: true,
            winning_bid_id: true,
            bids_auctions_winning_bid_idTobids: { select: { id: true, amount: true, user_id: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    })

    const items = leads.flatMap(l => {
      const auc = l.auctions?.[0]
      const wb = auc?.bids_auctions_winning_bid_idTobids
      const price = wb ? Number(wb.amount as unknown as number) : null
      return [{
        leadId: l.id,
        company_name: l.company_name,
        auctionId: auc?.id || null,
        bidId: wb?.id || null,
        price,
        isHot: Boolean(l.contract_url),
        created_at: l.created_at,
      }]
    })

    return NextResponse.json({ items })
  } catch (error: unknown) {
    console.error('[admin/users/[id]/purchased-leads][GET] error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}

