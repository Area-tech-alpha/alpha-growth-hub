// app/api/webhooks/infinitepay/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Endpoint de Webhook para receber e processar notificações da InfinitePay.
 * * Segurança: A autenticação é feita através de um parâmetro de busca 'secret' na URL,
 * que deve corresponder a uma variável de ambiente.
 * * Lógica:
 * 1. Valida o segredo da requisição.
 * 2. Analisa o payload do evento.
 * 3. Valida os campos essenciais do payload.
 * 4. Busca a sessão de checkout interna usando o 'order_nsu'.
 * 5. Ignora eventos que não sejam de pagamento confirmado.
 * 6. Garante a idempotência, verificando se a transação já foi processada.
 * 7. Enfileira um job (PGMQ) para o processamento assíncrono do crédito.
 * 8. Responde com sucesso (200 OK) para a InfinitePay.
 */
export async function POST(request: NextRequest) {
    // --- 1. Verificação de Segurança com Segredo na URL ---
    const secret = request.nextUrl.searchParams.get('secret');

    if (secret !== process.env.APP_WEBHOOK_SECRET) {
        console.warn('[Webhook InfinitePay] Tentativa de acesso com segredo inválido ou ausente.');
        return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }
    console.log('[Webhook InfinitePay] Segredo validado com sucesso.');

    // --- 2. Processamento do Payload e Lógica de Negócio ---
    try {
        const eventPayload = await request.json();
        const { event_type, data: transaction } = eventPayload;
        console.log('[Webhook InfinitePay] Evento recebido:', {
            event_type,
            transaction_id: transaction?.transaction_id,
            order_nsu: transaction?.order_nsu,
        });

        if (!event_type || !transaction?.transaction_id || !transaction?.order_nsu) {
            console.warn('[Webhook InfinitePay] Payload inválido ou campos essenciais ausentes:', eventPayload);
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

        const infinitePayPaymentId: string = transaction.transaction_id;
        const orderNsu: string = transaction.order_nsu;

        const sessionMapping = await prisma.checkout_sessions.findFirst({
            where: { internal_checkout_id: orderNsu },
            select: { user_id: true, internal_checkout_id: true },
        });

        if (!sessionMapping?.user_id) {
            console.error(`[Webhook CRÍTICO InfinitePay] Não foi possível encontrar o usuário para o order_nsu: ${orderNsu}. Pagamento: ${infinitePayPaymentId}`);
            return NextResponse.json({ error: 'Usuário correspondente não encontrado' }, { status: 404 });
        }

        const userId = sessionMapping.user_id;
        const internalCheckoutId = sessionMapping.internal_checkout_id;
        console.log('[Webhook InfinitePay] Mapeamento encontrado:', { userId, internalCheckoutId });
        const eventKey = `checkout_status:${internalCheckoutId}`;

        const isPaidEvent = event_type === 'transaction.paid';
        if (!isPaidEvent) {
            console.log('[Webhook InfinitePay] Evento não-pago ignorado:', { event_type });
            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'failed' },
                create: { event_key: eventKey, status: 'failed' },
            });
            return NextResponse.json({ status: 'ignored', event: event_type }, { status: 200 });
        }

        const alreadyProcessed = await prisma.credit_transactions.findUnique({
            where: { infinitepay_payment_id: infinitePayPaymentId }
        });

        if (alreadyProcessed) {
            console.log('[Webhook InfinitePay] Evento idempotente (já processado):', { infinitePayPaymentId });
            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'processed' },
                create: { event_key: eventKey, status: 'processed' },
            });
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        // Normaliza o payload para o mesmo formato utilizado pelo Asaas
        const valueCents = (
            (typeof transaction?.amount_cents === 'number' && transaction.amount_cents) ||
            (typeof transaction?.total_cents === 'number' && transaction.total_cents) ||
            (typeof transaction?.price_cents === 'number' && transaction.price_cents) ||
            (typeof transaction?.amount === 'number' && Math.round(Number(transaction.amount) * 100)) ||
            (typeof transaction?.total === 'number' && Math.round(Number(transaction.total) * 100)) ||
            (typeof transaction?.price === 'number' && Math.round(Number(transaction.price) * 100)) ||
            undefined
        );
        const normalizedValue = typeof valueCents === 'number' ? valueCents / 100 : undefined;

        const normalizedPayment = {
            id: infinitePayPaymentId,
            value: normalizedValue,
            checkoutSession: internalCheckoutId,
            provider: 'INFINITEPAY',
            raw: transaction,
        };
        console.log('[Webhook InfinitePay] Pagamento normalizado:', {
            id: normalizedPayment.id,
            value: normalizedPayment.value,
            checkoutSession: normalizedPayment.checkoutSession,
        });

        const jobPayload = {
            event: 'PAYMENT_CONFIRMED',
            payment: normalizedPayment,
            userId,
            enqueuedAt: new Date().toISOString(),
        };

        let msgId: bigint | number;
        try {
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(jobPayload)}::jsonb) AS msg_id`;
            msgId = result[0].msg_id;
            console.log('[Webhook InfinitePay] Job enfileirado com sucesso:', { msgId: String(msgId) });
        } catch (e) {
            console.error('[Webhook InfinitePay] Falha ao enfileirar job no PGMQ:', e);
            return NextResponse.json({ error: 'Falha ao enfileirar job' }, { status: 500 });
        }

        try {
            // Tentativa de processamento imediato (não bloqueante)
            await prisma.$queryRaw`SELECT public.process_credit_jobs_worker()`;
            console.log('[Webhook InfinitePay] Worker chamado para processamento imediato.');
        } catch (e) {
            console.error('[Webhook InfinitePay] Erro ao executar worker imediato. O job ainda está na fila.', e);
        }

        await prisma.processed_webhooks.upsert({
            where: { event_key: eventKey },
            update: { status: 'processed' },
            create: { event_key: eventKey, status: 'processed' },
        });
        console.log('[Webhook InfinitePay] Status atualizado em processed_webhooks:', { eventKey, status: 'processed' });

        console.log('[Webhook InfinitePay] Sucesso total do processamento.');
        return NextResponse.json({ status: 'success', queued: true, msgId: String(msgId) }, { status: 200 });

    } catch (error) {
        console.error('[Webhook InfinitePay] Erro inesperado no processamento do webhook:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}