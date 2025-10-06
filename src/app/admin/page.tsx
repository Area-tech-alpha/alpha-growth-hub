import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import StatsCards from '@/components/dashboard/leiloes/statsCards'

export default async function AdminDashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return <div>Acesso restrito. Faça login.</div>
    }

    const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || me.role !== 'admin') {
        return <div>403 - Acesso negado</div>
    }

    const h = await headers()
    const cookieHeader = h.get('cookie') ?? ''
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const protocol = h.get('x-forwarded-proto') ?? 'http'
    const baseUrl = `${protocol}://${host}`
    const res = await fetch(`${baseUrl}/api/admin/leads`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
    if (!res.ok) {
        return <div>Falha ao carregar dados</div>
    }
    const data = await res.json() as {
        leadsEntered: unknown[];
        leadsSold: unknown[];
        topBuyers?: { userId: string | null; count: number; name?: string | null; email?: string | null; avatar_url?: string | null }[];
        topBidders?: { userId: string; count: number; name?: string | null; email?: string | null; avatar_url?: string | null }[];
    }

    const enteredCount = Array.isArray(data.leadsEntered) ? data.leadsEntered.length : 0
    const soldCount = Array.isArray(data.leadsSold) ? data.leadsSold.length : 0

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <StatsCards
                items={[
                    {
                        title: 'Leads que entraram',
                        icon: <span className="text-yellow-600">⬤</span>,
                        contentTitle: String(enteredCount),
                        contentDescription: 'Total de leads que entraram',
                    },
                    {
                        title: 'Leads vendidos',
                        icon: <span className="text-yellow-600">⬤</span>,
                        contentTitle: String(soldCount),
                        contentDescription: 'Total de leads vendidos',
                    },
                ]}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top compradores</h2>
                    <ul className="divide-y rounded-md border">
                        {(data.topBuyers ?? []).map((b, idx) => (
                            <li key={`buyer-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                <span className="font-medium">{b.count}</span>
                            </li>
                        ))}
                        {(!data.topBuyers || data.topBuyers.length === 0) && (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top lances</h2>
                    <ul className="divide-y rounded-md border">
                        {(data.topBidders ?? []).map((b, idx) => (
                            <li key={`bidder-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                <span className="font-medium">{b.count}</span>
                            </li>
                        ))}
                        {(!data.topBidders || data.topBidders.length === 0) && (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    )
}


