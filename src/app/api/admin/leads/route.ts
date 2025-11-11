import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

type DateRange = { start: Date; end: Date }

const getMonthRange = (year: number, monthIndex: number): DateRange => {
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0))
    const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0))
    return { start, end }
}

const parseMonthRange = (value: string | null): DateRange | null => {
    if (!value) return null
    const [yyyy, mm] = value.split('-').map(Number)
    if (!yyyy || !mm || mm < 1 || mm > 12) return null
    return getMonthRange(yyyy, mm - 1)
}

const startOfUtcWeek = (date: Date): Date => {
    const clone = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0))
    const day = clone.getUTCDay()
    const diff = day === 0 ? 6 : day - 1
    clone.setUTCDate(clone.getUTCDate() - diff)
    return clone
}

const getWeekRange = (date: Date): DateRange => {
    const start = startOfUtcWeek(date)
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
    const base = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0))
    if (Number.isNaN(base.getTime())) return null
    return getWeekRange(base)
}

const getDayRange = (date: Date): DateRange => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0))
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
    const base = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0))
    if (Number.isNaN(base.getTime())) return null
    return getDayRange(base)
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const sessionRole = (session.user as unknown as { role?: string })?.role
        if (sessionRole !== 'admin') {
            const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
            if (!me || me.role !== 'admin') {
                return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
            }
        }

        const now = new Date()
        const monthParam = url.searchParams.get('month')
        const rangeParam = url.searchParams.get('range')
        const weekParam = url.searchParams.get('weekStart')
        const dayParam = url.searchParams.get('day')

        const currentMonthRange = getMonthRange(now.getUTCFullYear(), now.getUTCMonth())
        const currentWeekRange = getWeekRange(now)
        const currentDayRange = getDayRange(now)

        const explicitMonth = Boolean(monthParam)
        const rangeModeInput = rangeParam === 'monthly' || rangeParam === 'weekly' || rangeParam === 'daily' ? rangeParam : 'all'
        const rangeMode = rangeModeInput === 'all' && explicitMonth ? 'monthly' : rangeModeInput

        let createdAtWhere: { gte?: Date; lt?: Date } | undefined
        if (rangeMode === 'monthly') {
            const monthRange = parseMonthRange(monthParam) ?? currentMonthRange
            createdAtWhere = { gte: monthRange.start, lt: monthRange.end }
        } else if (rangeMode === 'weekly') {
            const weekRange = parseWeekRange(weekParam) ?? currentWeekRange
            createdAtWhere = { gte: weekRange.start, lt: weekRange.end }
        } else if (rangeMode === 'daily') {
            const dayRange = parseDayRange(dayParam) ?? currentDayRange
            createdAtWhere = { gte: dayRange.start, lt: dayRange.end }
        }

        const leadsEntered = await prisma.leads.findMany({
            where: { status: { not: '' }, ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
        })

        const leadsSold = await prisma.leads.findMany({
            where: { status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
        })

        const buyersGroup = await prisma.leads.groupBy({
            by: ['owner_id'],
            where: { owner_id: { not: null }, status: 'sold', ...(createdAtWhere ? { created_at: createdAtWhere } : {}) },
            _count: { owner_id: true },
            orderBy: { _count: { owner_id: 'desc' } },
            take: 10,
        })
        const buyerIds = buyersGroup.map(b => b.owner_id!).filter(Boolean)
        const buyerUsers = buyerIds.length
            ? await prisma.users.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true, email: true, avatar_url: true } })
            : []
        const topBuyers = buyersGroup.map(b => {
            const u = buyerUsers.find(x => x.id === b.owner_id)
            return { userId: b.owner_id, count: b._count.owner_id, name: u?.name ?? null, email: u?.email ?? null, avatar_url: u?.avatar_url ?? null }
        })

        const biddersGroup = await prisma.bids.groupBy({
            by: ['user_id'],
            where: createdAtWhere ? { created_at: createdAtWhere } : undefined,
            _count: { user_id: true },
            orderBy: { _count: { user_id: 'desc' } },
            take: 10,
        })
        const bidderIds = biddersGroup.map(b => b.user_id).filter(Boolean)
        const bidderUsers = bidderIds.length
            ? await prisma.users.findMany({ where: { id: { in: bidderIds } }, select: { id: true, name: true, email: true, avatar_url: true } })
            : []
        const topBidders = biddersGroup.map(b => {
            const u = bidderUsers.find(x => x.id === b.user_id)
            return { userId: b.user_id, count: b._count.user_id, name: u?.name ?? null, email: u?.email ?? null, avatar_url: u?.avatar_url ?? null }
        })

        return NextResponse.json({ leadsEntered, leadsSold, topBuyers, topBidders })
    } catch (error: unknown) {
        console.error('[admin/leads] error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
    }
}


