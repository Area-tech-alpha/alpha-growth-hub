import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const internalCheckoutId = searchParams.get('checkoutId');

    if (!internalCheckoutId) {
        return NextResponse.json({ error: 'checkoutId é obrigatório' }, { status: 400 });
    }

    // Primeiro, encontre o asaas_checkout_id correspondente
    const session = await prisma.checkout_sessions.findFirst({
        where: { internal_checkout_id: internalCheckoutId }
    });

    if (!session) {
        return NextResponse.json({ status: 'PENDING' });
    }

    // Agora, verifique se a transação de crédito foi criada pelo webhook
    const transaction = await prisma.credit_transactions.findFirst({
        where: { asaas_payment_id: session.asaas_checkout_id }
    });

    if (transaction) {
        return NextResponse.json({ status: 'SUCCESS' });
    } else {
        return NextResponse.json({ status: 'PENDING' });
    }
}