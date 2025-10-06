import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { prisma } from '@/lib/prisma'
import AdminDashboardTabs from '@/components/admin/AdminDashboardTabs'

export default async function AdminDashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return <div>Acesso restrito. Faça login.</div>
    }

    const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || me.role !== 'admin') {
        return <div>403 - Acesso negado</div>
    }

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Dashboard Administrativo</h1>
            <AdminDashboardTabs />
        </div>
    )
}


