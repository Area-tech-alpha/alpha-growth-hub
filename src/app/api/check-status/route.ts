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

        // Check webhook-processed status keyed by internal checkout id
        const eventKey = `checkout_status:${internalCheckoutId}`;
        const processed = await prisma.processed_webhooks.findUnique({ where: { event_key: eventKey } });

        if (processed?.status === 'processed') {
            return NextResponse.json({ status: 'SUCCESS' });
        }
        if (processed?.status === 'failed') {
            return NextResponse.json({ status: 'FAILED' });
        }

        return NextResponse.json({ status: 'PENDING' });
    } catch (error) {
        console.error("Erro ao verificar status do checkout:", error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}