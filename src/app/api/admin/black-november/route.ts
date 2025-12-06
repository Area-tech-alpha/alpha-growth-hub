import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../auth'
import { prisma } from '@/lib/prisma'

type MonthRange = { start: Date; end: Date; label: string }

const CASHBACK_TARGET = 10_000
const BRASILIA_UTC_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3
const BLACK_NOVEMBER_YEAR = 2025
const BLACK_NOVEMBER_MONTH = 11
const BLACK_NOVEMBER_END_DAY = 5

const makeUtcFromBrasilia = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) => {
  const utcBase = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  return new Date(utcBase + BRASILIA_UTC_OFFSET_MS)
}

const parseMonth = (value: string | null): MonthRange | null => {
  if (!value) return null
  const [yyyy, mm] = value.split('-').map(Number)
  if (!yyyy || !mm || mm < 1 || mm > 12) return null
  const isBlackNovember = yyyy === BLACK_NOVEMBER_YEAR && mm === BLACK_NOVEMBER_MONTH
  const start = makeUtcFromBrasilia(yyyy, mm, 1)
  const end = isBlackNovember
    ? makeUtcFromBrasilia(yyyy, mm + 1, BLACK_NOVEMBER_END_DAY + 1)
    : makeUtcFromBrasilia(yyyy, mm + 1, 1)
  return {
    start,
    end,
    label: `${String(mm).padStart(2, '0')}/${String(yyyy).slice(-2)}`,
  }
}

const buildDefaultRange = (): MonthRange => {
  const start = makeUtcFromBrasilia(BLACK_NOVEMBER_YEAR, BLACK_NOVEMBER_MONTH, 1)
  const end = makeUtcFromBrasilia(BLACK_NOVEMBER_YEAR, BLACK_NOVEMBER_MONTH + 1, BLACK_NOVEMBER_END_DAY + 1)
  return {
    start,
    end,
    label: `${String(BLACK_NOVEMBER_MONTH).padStart(2, '0')}/${String(BLACK_NOVEMBER_YEAR).slice(-2)}`,
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const role = (session.user as unknown as { role?: string })?.role
    if (role !== 'admin') {
      const me = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
      if (!me || me.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    const url = new URL(request.url)
    const monthParam = url.searchParams.get('month')
    const range = parseMonth(monthParam) ?? buildDefaultRange()

    const grouped = await prisma.credit_transactions.groupBy({
      by: ['user_id'],
      where: {
        status: 'completed',
        amount_paid: { gt: 0 },
        created_at: { gte: range.start, lt: range.end },
        users: { role: 'user' },
      },
      _sum: { amount_paid: true },
    })

    const userIds = grouped.map((g) => g.user_id)
    const users = userIds.length
      ? await prisma.users.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userMap = users.reduce<Record<string, { name: string | null; email: string | null }>>(
      (acc, user) => {
        acc[user.id] = { name: user.name ?? null, email: user.email ?? null }
        return acc
      },
      {},
    )

    const leaderboard = grouped
      .map((g) => {
        const totalInvested = Number(g._sum.amount_paid ?? 0)
        return {
          userId: g.user_id,
          name: userMap[g.user_id]?.name ?? 'Usuário sem nome',
          email: userMap[g.user_id]?.email ?? 'sem-email',
          totalInvested,
          progress: Math.min(100, (totalInvested / CASHBACK_TARGET) * 100),
          eligible: totalInvested >= CASHBACK_TARGET,
        }
      })
      .sort((a, b) => b.totalInvested - a.totalInvested)

    const totals = leaderboard.reduce(
      (acc, item) => {
        acc.totalInvested += item.totalInvested
        if (item.eligible) acc.achievers += 1
        return acc
      },
      { totalInvested: 0, achievers: 0 },
    )

    return NextResponse.json({
      month: range.label,
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      target: CASHBACK_TARGET,
      participants: leaderboard.length,
      achievers: totals.achievers,
      totalInvested: totals.totalInvested,
      leaderboard,
    })
  } catch (error: unknown) {
    console.error('[admin/black-november] error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}

