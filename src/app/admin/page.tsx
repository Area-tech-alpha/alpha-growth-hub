import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AdminOverview from '@/components/admin/AdminOverview'
import AdminFinance from '@/components/admin/AdminFinance'

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
            <h1 className="text-xl font-semibold">Dashboard Administrativo</h1>
            <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Visão geral</TabsTrigger>
                    <TabsTrigger value="finance">Financeiro</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                    <AdminOverview
                        enteredCount={enteredCount}
                        soldCount={soldCount}
                        topBuyers={(data.topBuyers ?? []).map(b => ({ userId: b.userId, count: b.count, name: b.name ?? null, email: b.email ?? null }))}
                        topBidders={(data.topBidders ?? []).map(b => ({ userId: b.userId, count: b.count, name: b.name ?? null, email: b.email ?? null }))}
                    />
                </TabsContent>
                <TabsContent value="finance" className="mt-4">
                    <AdminFinance />
                </TabsContent>
            </Tabs>
        </div>
    )
}


