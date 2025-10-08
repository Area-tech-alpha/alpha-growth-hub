import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'

type Row = {
  id: string
  company_name: string | null
  created_at: Date | null
  sold: boolean
  is_hot: boolean
  buyer_id: string | null
  buyer_name: string | null
  buyer_email: string | null
  price: unknown | null
  bids_count: number | null
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }
    // Ensure admin role
    const role = (session.user as unknown as { role?: string })?.role
    if (role !== 'admin') {
      const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
      if (!me || me.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT 
        l.id,
        l.company_name,
        l.created_at,
        (l.owner_id IS NOT NULL) AS sold,
        (l.contract_url IS NOT NULL) AS is_hot,
        u.id as buyer_id,
        u.name as buyer_name,
        u.email as buyer_email,
        wb.amount as price,
        bc.count_bids as bids_count
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_id
      LEFT JOIN auctions a ON a.lead_id = l.id
      LEFT JOIN bids wb ON wb.id = a.winning_bid_id
      LEFT JOIN (
        SELECT auction_id, COUNT(*)::int as count_bids
        FROM bids
        GROUP BY auction_id
      ) bc ON bc.auction_id = a.id
      ORDER BY l.created_at DESC NULLS LAST
      LIMIT 10
    `

    const items = (rows || []).map(r => {
      const price = r.price
      const priceNum = typeof price === 'object' && price !== null && 'toString' in price
        ? Number(String(price))
        : (typeof price === 'number' ? price : null)
      return {
        id: r.id,
        company_name: r.company_name,
        created_at: r.created_at,
        sold: Boolean(r.sold),
        type: r.is_hot ? 'hot' : 'cold',
        buyer: r.sold ? { id: r.buyer_id, name: r.buyer_name, email: r.buyer_email } : null,
        price: r.sold ? priceNum : null,
        bids_count: r.sold ? (r.bids_count ?? 0) : 0,
      }
    })

    return NextResponse.json({ items })
  } catch (error: unknown) {
    console.error('[admin/leads/recent] error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}

