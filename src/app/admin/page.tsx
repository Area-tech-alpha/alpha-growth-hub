import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { prisma } from '@/lib/prisma'
import AdminDashboardTabs from '@/components/admin/AdminDashboardTabs'

export default async function AdminDashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return <div>Acesso restrito. Faça login.</div>
    }

    // Prefira usar o papel vindo da sessão (evita quebra quando o DB está indisponível)
    const sessionRole = (session.user as unknown as { role?: string })?.role
    if (sessionRole !== 'admin') {
        try {
            const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { role: true } })
            if (!me || me.role !== 'admin') {
                return <div>403 - Acesso negado</div>
            }
        } catch (e) {
            // Quando o banco estiver indisponível, não derrubar a página
            return (
                <div className="p-6 space-y-2">
                    <div className="text-red-600 font-semibold">Serviço de banco indisponível</div>
                    <div className="text-sm text-muted-foreground">Não foi possível validar permissão admin no momento. Tente novamente em instantes.</div>
                </div>
            )
        }
    }

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Dashboard Administrativo</h1>
            <AdminDashboardTabs />
        </div>
    )
}


