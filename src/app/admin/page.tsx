import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

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
    const data = await res.json() as { leadsEntered: unknown[]; leadsSold: unknown[] }

    const enteredCount = Array.isArray(data.leadsEntered) ? data.leadsEntered.length : 0
    const soldCount = Array.isArray(data.leadsSold) ? data.leadsSold.length : 0

    return (
        <div style={{ padding: 24 }}>
            <h1>Admin Dashboard</h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <div>
                    <div>Total Entraram</div>
                    <div>{enteredCount}</div>
                </div>
                <div>
                    <div>Total Vendidos</div>
                    <div>{soldCount}</div>
                </div>
            </div>
            <div style={{ marginTop: 24 }}>
                <h2>Leads Entraram</h2>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(data.leadsEntered?.slice(0, 20), null, 2)}</pre>
            </div>
            <div style={{ marginTop: 24 }}>
                <h2>Leads Vendidos</h2>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(data.leadsSold?.slice(0, 20), null, 2)}</pre>
            </div>
        </div>
    )
}


