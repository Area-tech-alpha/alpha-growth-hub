import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth'
import { prisma } from '@/lib/prisma'

type AdminCheckOk = {
    ok: true
    user: { id: string; email: string | null; name: string | null }
}

type AdminCheckFail = {
    ok: false
    status: number
    error: string
}

export type RequireAdminResult = AdminCheckOk | AdminCheckFail

export async function requireAdmin(): Promise<RequireAdminResult> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { ok: false, status: 401, error: 'Não autenticado' }
    }
    const sessionRole = (session.user as unknown as { role?: string })?.role
    if (sessionRole === 'admin') {
        return { ok: true, user: { id: session.user.id, email: session.user.email ?? null, name: session.user.name ?? null } }
    }
    const me = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { role: true, email: true, name: true, id: true },
    })
    if (!me || me.role !== 'admin') {
        return { ok: false, status: 403, error: 'Acesso negado' }
    }
    return { ok: true, user: { id: me.id, email: me.email ?? null, name: me.name ?? null } }
}
