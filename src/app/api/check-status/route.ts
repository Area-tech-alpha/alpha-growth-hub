// app/api/check-status/route.ts (VERSÃO CORRIGIDA)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth'; // Ajuste o caminho se necessário

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
            console.log(`[Check-Status] Sessão de checkout não encontrada para internalId: ${internalCheckoutId}`);
            return NextResponse.json({ status: 'PENDING' });
        }

        // CORREÇÃO: Busca a transação usando o 'asaas_checkout_id' que é o link correto
        const transaction = await prisma.credit_transactions.findFirst({
            where: {
                // A tabela credit_transactions precisa ter a coluna asaas_checkout_id
                // ou um link com o asaas_payment_id que possa ser correlacionado.
                // Assumindo que você possa adicionar 'asaas_checkout_id' à tabela de transações.
                // Se não, você precisaria buscar o payment_id associado a este checkout.
                asaas_payment_id: checkoutSession.asaas_checkout_id
            }
        });

        if (transaction) {
            console.log(`[Check-Status] Sucesso para internalId: ${internalCheckoutId}`);
            return NextResponse.json({ status: 'SUCCESS' });
        } else {
            console.log(`[Check-Status] Pendente para internalId: ${internalCheckoutId}`);
            return NextResponse.json({ status: 'PENDING' });
        }
    } catch (error) {
        console.error("Erro ao verificar status do checkout:", error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}