import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getLeadTypeFromRevenue, getRevenueBandByLabel, getRevenueLabelsForLeadType, LeadType } from '@/lib/revenueBands'

type Row = {
  id: string
  company_name: string | null
  created_at: Date | null
  revenue: string | null
  sold: boolean
  is_hot: boolean
  buyer_id: string | null
  buyer_name: string | null
  buyer_email: string | null
  price: unknown | null
  bids_count: number | null
  minimum_bid: unknown | null
}

type DateRange = { start: Date; end: Date }

const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MS_PER_DAY = 24 * 60 * 60 * 1000
const STATUS_PRESENT_CLAUSE = Prisma.sql`COALESCE(l.status, '') <> ''`
const SAO_PAULO_OFFSET_HOURS = 3
const SAO_PAULO_OFFSET_MS = SAO_PAULO_OFFSET_HOURS * 60 * 60 * 1000

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

const buildBrazilMidnight = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day, SAO_PAULO_OFFSET_HOURS, 0, 0))

const getMonthRange = (year: number, monthIndex: number): DateRange => ({
  start: buildBrazilMidnight(year, monthIndex, 1),
  end: buildBrazilMidnight(year, monthIndex + 1, 1),
})

const parseMonthRange = (value: string | null): DateRange | null => {
  if (!value) return null
  const [yyyy, mm] = value.split('-').map(Number)
  if (!yyyy || !mm || mm < 1 || mm > 12) return null
  return getMonthRange(yyyy, mm - 1)
}

const startOfBrazilWeek = (date: Date): Date => {
  const clone = buildBrazilMidnight(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const day = clone.getUTCDay() // 0 (dom) ... 6 (sáb)
  const diff = day === 0 ? 6 : day - 1 // segunda-feira como início
  clone.setUTCDate(clone.getUTCDate() - diff)
  return clone
}

const getWeekRange = (date: Date): DateRange => {
  const start = startOfBrazilWeek(date)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}

const parseWeekRange = (value: string | null): DateRange | null => {
  if (!value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null
  const [yyyy, mm, dd] = parts
  if (!yyyy || !mm || !dd) return null
  const base = buildBrazilMidnight(yyyy, mm - 1, dd)
  if (Number.isNaN(base.getTime())) return null
  return getWeekRange(base)
}

const getDayRange = (date: Date): DateRange => {
  const start = buildBrazilMidnight(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

const parseDayRange = (value: string | null): DateRange | null => {
  if (!value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null
  const [yyyy, mm, dd] = parts
  if (!yyyy || !mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const base = buildBrazilMidnight(yyyy, mm - 1, dd)
  if (Number.isNaN(base.getTime())) return null
  return getDayRange(base)
}

const formatMonthLabel = (range: DateRange): string => {
  const monthIdx = range.start.getUTCMonth()
  const year = range.start.getUTCFullYear()
  return `${monthLabels[monthIdx] ?? String(monthIdx + 1).padStart(2, '0')}/${String(year).slice(-2)}`
}

const formatShortDate = (date: Date): string => {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yy = String(date.getUTCFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

const formatWeekLabel = (range: DateRange): string => {
  const start = formatShortDate(range.start)
  const inclusiveEnd = new Date(range.end.getTime() - MS_PER_DAY)
  const end = formatShortDate(inclusiveEnd)
  return `${start} - ${end}`
}

const formatDayLabel = (range: DateRange): string => formatShortDate(range.start)

const decimalToNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const buildWhere = (range?: DateRange, extraClauses: Prisma.Sql[] = []) => {
  const clauses: Prisma.Sql[] = [STATUS_PRESENT_CLAUSE, ...extraClauses]
  if (range) {
    clauses.push(Prisma.sql`l.created_at >= ${range.start}`)
    clauses.push(Prisma.sql`l.created_at < ${range.end}`)
  }

  const [first, ...rest] = clauses
  const chain = rest.reduce((acc, clause) => Prisma.sql`${acc} AND ${clause}`, first)
  return Prisma.sql`WHERE ${chain}`
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const role = (session.user as unknown as { role?: string })?.role
    if (role !== 'admin') {
      const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
      if (!me || me.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    const url = new URL(request.url)
    const now = new Date()
    const nowInBrazil = new Date(now.getTime() - SAO_PAULO_OFFSET_MS)

    const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSizeParam = Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
    const pageSize = clamp(Number.isNaN(pageSizeParam) ? 10 : pageSizeParam, 5, 50)
    const offset = (page - 1) * pageSize

    const rangeParam = url.searchParams.get('range')
    const rangeMode = rangeParam === 'monthly' || rangeParam === 'weekly' || rangeParam === 'daily' ? rangeParam : 'all'
    const monthParam = url.searchParams.get('month')
    const weekParam = url.searchParams.get('weekStart')
    const dayParam = url.searchParams.get('day')

    const currentMonthRange = getMonthRange(nowInBrazil.getUTCFullYear(), nowInBrazil.getUTCMonth())
    const currentWeekRange = getWeekRange(nowInBrazil)
    const currentDayRange = getDayRange(nowInBrazil)

    const parsedMonthRange = parseMonthRange(monthParam)
    const parsedWeekRange = parseWeekRange(weekParam)
    const parsedDayRange = parseDayRange(dayParam)

    const activeRange =
      rangeMode === 'monthly'
        ? (parsedMonthRange ?? currentMonthRange)
        : rangeMode === 'weekly'
          ? (parsedWeekRange ?? currentWeekRange)
          : rangeMode === 'daily'
            ? (parsedDayRange ?? currentDayRange)
            : undefined

    const revenueBandFilters = url.searchParams.getAll('revenueBand')
      .map(label => getRevenueBandByLabel(label)?.label)
      .filter((label): label is string => Boolean(label))

    const leadTypeParamRaw = url.searchParams.get('leadType')?.toUpperCase() ?? null
    const leadTypeFilter = leadTypeParamRaw === 'A' || leadTypeParamRaw === 'B' || leadTypeParamRaw === 'C'
      ? (leadTypeParamRaw as LeadType)
      : null

    let allowedRevenueLabels: string[] | null = revenueBandFilters.length ? revenueBandFilters : null
    if (leadTypeFilter) {
      const typeLabels = getRevenueLabelsForLeadType(leadTypeFilter)
      allowedRevenueLabels = allowedRevenueLabels
        ? allowedRevenueLabels.filter(label => typeLabels.includes(label))
        : typeLabels
    }

    const extraClauses: Prisma.Sql[] = []
    if (allowedRevenueLabels) {
      if (allowedRevenueLabels.length === 0) {
        extraClauses.push(Prisma.sql`1 = 0`)
      } else {
        extraClauses.push(Prisma.sql`l.revenue IN (${Prisma.join(allowedRevenueLabels)})`)
      }
    }

    const listWhere = buildWhere(activeRange, extraClauses)

    const totalRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint as count
      FROM leads l
      ${listWhere}
    `)
    const total = totalRows.length ? Number(totalRows[0].count) : 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT 
        l.id,
        l.company_name,
        l.created_at,
        l.revenue,
        (l.owner_id IS NOT NULL) AS sold,
        (l.contract_url IS NOT NULL) AS is_hot,
        u.id as buyer_id,
        u.name as buyer_name,
        u.email as buyer_email,
        wb.amount as price,
        COALESCE(bc.count_bids, 0) as bids_count
        ,
        a.minimum_bid
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_id
      LEFT JOIN auctions a ON a.lead_id = l.id
      LEFT JOIN bids wb ON wb.id = a.winning_bid_id
      LEFT JOIN (
        SELECT auction_id, COUNT(*)::int as count_bids
        FROM bids
        GROUP BY auction_id
      ) bc ON bc.auction_id = a.id
      ${listWhere}
      ORDER BY l.created_at DESC NULLS LAST
      LIMIT ${pageSize}
      OFFSET ${offset}
    `)

    const summaryRows = await prisma.$queryRaw<{ sold_count: bigint; avg_ticket: unknown | null }[]>(Prisma.sql`
      SELECT 
        COUNT(*) FILTER (WHERE l.owner_id IS NOT NULL)::bigint AS sold_count,
        AVG(CASE WHEN l.owner_id IS NOT NULL THEN wb.amount ELSE NULL END)::numeric AS avg_ticket
      FROM leads l
      LEFT JOIN auctions a ON a.lead_id = l.id
      LEFT JOIN bids wb ON wb.id = a.winning_bid_id
      ${listWhere}
    `)
    const soldCount = summaryRows.length ? Number(summaryRows[0].sold_count) : 0
    const unsoldCount = Math.max(total - soldCount, 0)
    const averageTicket = summaryRows.length ? decimalToNumber(summaryRows[0].avg_ticket) : null

    const selectedMonthRange = parsedMonthRange ?? currentMonthRange
    const selectedWeekRange = parsedWeekRange ?? currentWeekRange

    const monthAvgWhere = buildWhere(selectedMonthRange, [Prisma.sql`l.owner_id IS NOT NULL`, ...extraClauses])
    const weekAvgWhere = buildWhere(selectedWeekRange, [Prisma.sql`l.owner_id IS NOT NULL`, ...extraClauses])

    const monthAvgRows = await prisma.$queryRaw<{ avg_value: unknown | null }[]>(Prisma.sql`
      SELECT AVG(wb.amount)::numeric AS avg_value
      FROM leads l
      LEFT JOIN auctions a ON a.lead_id = l.id
      LEFT JOIN bids wb ON wb.id = a.winning_bid_id
      ${monthAvgWhere}
    `)
    const weekAvgRows = await prisma.$queryRaw<{ avg_value: unknown | null }[]>(Prisma.sql`
      SELECT AVG(wb.amount)::numeric AS avg_value
      FROM leads l
      LEFT JOIN auctions a ON a.lead_id = l.id
      LEFT JOIN bids wb ON wb.id = a.winning_bid_id
      ${weekAvgWhere}
    `)

    const monthAverage = monthAvgRows.length ? decimalToNumber(monthAvgRows[0].avg_value) : null
    const weekAverage = weekAvgRows.length ? decimalToNumber(weekAvgRows[0].avg_value) : null

    const items = (rows || []).map(r => {
      const priceNum = decimalToNumber(r.price)
      return {
        id: r.id,
        company_name: r.company_name,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
        revenue: r.revenue,
        sold: Boolean(r.sold),
        type: r.is_hot ? 'hot' : 'cold',
        buyer: r.sold ? { id: r.buyer_id, name: r.buyer_name, email: r.buyer_email } : null,
        price: r.sold ? priceNum : null,
        bids_count: r.bids_count ?? 0,
        minimum_bid: decimalToNumber(r.minimum_bid),
        leadType: getLeadTypeFromRevenue(r.revenue),
      }
    })

    const summaryLabel =
      rangeMode === 'monthly' && activeRange
        ? formatMonthLabel(activeRange)
        : rangeMode === 'weekly' && activeRange
          ? formatWeekLabel(activeRange)
          : rangeMode === 'daily' && activeRange
            ? formatDayLabel(activeRange)
            : 'Todos os registros'

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      summary: {
        label: summaryLabel,
        soldCount,
        unsoldCount,
        averageTicket,
      },
      investments: {
        month: {
          label: formatMonthLabel(selectedMonthRange),
          average: monthAverage,
        },
        week: {
          label: formatWeekLabel(selectedWeekRange),
          average: weekAverage,
        },
      },
    })
  } catch (error: unknown) {
    console.error('[admin/leads/recent] error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}

