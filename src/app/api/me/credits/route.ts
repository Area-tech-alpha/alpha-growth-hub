import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../auth';


export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { credit_balance: true },
        });

        const credit = user?.credit_balance ? Number(user.credit_balance) : 0;

        return NextResponse.json({ creditBalance: credit });
    } catch (error) {
        console.error('[API] Erro ao obter saldo de créditos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}


