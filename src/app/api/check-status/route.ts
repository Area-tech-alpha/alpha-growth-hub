import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const internalCheckoutId = searchParams.get('checkoutId');

    if (!internalCheckoutId) {
        return NextResponse.json({ error: 'checkoutId é obrigatório' }, { status: 400 });
    }

    try {
        const checkoutSession = await prisma.checkout_sessions.findFirst({
            where: {
                internal_checkout_id: internalCheckoutId,
                user_id: session.user.id
            }
        });

        if (!checkoutSession) {
            return NextResponse.json({ status: 'PENDING' });
        }

        const transaction = await prisma.credit_transactions.findFirst({
            where: {
                asaas_payment_id: checkoutSession.asaas_checkout_id
            }
        });

        if (transaction) {
            return NextResponse.json({ status: 'SUCCESS' });
        } else {
            return NextResponse.json({ status: 'PENDING' });
        }
    } catch (error) {
        console.error("Erro ao verificar status do checkout:", error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}