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


    // --- 2. Processamento do Payload e Lógica de Negócio ---
    try {
        const eventPayload = await request.json();
        const event_type: string | undefined = eventPayload?.event_type;
        // InfinitePay pode enviar tanto em eventPayload.data quanto no payload raiz
        const transaction = eventPayload?.data ?? eventPayload;


        const infinitePayPaymentId: string | undefined = transaction?.transaction_id ?? transaction?.transaction_nsu;
        const orderNsu: string | undefined = transaction?.order_nsu;

        if (!infinitePayPaymentId || !orderNsu) {
            console.warn('[Webhook InfinitePay] Payload inválido ou campos essenciais ausentes:', eventPayload);
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

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

        const eventKey = `checkout_status:${internalCheckoutId}`;

        const isPaidEvent = event_type
            ? event_type === 'transaction.paid'
            : (typeof transaction?.paid_amount === 'number' || transaction?.status === 'paid' || transaction?.paid === true);
        if (!isPaidEvent) {

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

            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'processed' },
                create: { event_key: eventKey, status: 'processed' },
            });
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        // Normaliza o payload: creditar exatamente o valor definido, sem taxas.
        // Preferir items[0].price ou amount (ambos em centavos). Só usar paid_amount como último recurso.
        const valueCents = (
            (Array.isArray(transaction?.items) && typeof transaction.items?.[0]?.price === 'number' && transaction.items[0].price) ||
            (typeof transaction?.amount === 'number' && transaction.amount) ||
            (typeof transaction?.paid_amount === 'number' && transaction.paid_amount) ||
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


        const jobPayload = {
            provider: 'INFINITEPAY',
            event: 'PAYMENT_CONFIRMED',
            payment: normalizedPayment,
            userId,
            source: 'monetary',
            enqueuedAt: new Date().toISOString(),
        };

        // Marca o event_key como queued antes de enfileirar
        try {
            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'queued' },
                create: { event_key: eventKey, status: 'queued' },
            });
        } catch (e) {
            console.error('[Webhook InfinitePay] Falha ao marcar processed_webhooks como queued:', e);
        }

        let msgId: bigint | number;
        try {
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(jobPayload)}::jsonb) AS msg_id`;
            msgId = result[0].msg_id;
        } catch (e) {
            console.error('[Webhook InfinitePay] Falha ao enfileirar job no PGMQ:', e);
            return NextResponse.json({ error: 'Falha ao enfileirar job' }, { status: 500 });
        }

        try {
            // Tentativa de processamento imediato (não bloqueante)
            type WorkerRow = { process_credit_jobs_worker: { status?: string; msg_id?: string; error?: string } };
            await prisma.$queryRaw<WorkerRow[]>`SELECT public.process_credit_jobs_worker()`;
        } catch (e) {
            console.error('[Webhook InfinitePay] Erro ao executar worker imediato. O job ainda está na fila.', e);
        }

        // Verifica se a transação foi realmente gravada antes de marcar como processed
        try {
            let txCheck = await prisma.credit_transactions.findUnique({
                where: { infinitepay_payment_id: infinitePayPaymentId },
                select: { id: true, credits_purchased: true }
            });
            if (!txCheck) {
                // Compat: funções antigas podem ter gravado o ID do InfinitePay em asaas_payment_id
                txCheck = await prisma.credit_transactions.findUnique({
                    where: { asaas_payment_id: infinitePayPaymentId },
                    select: { id: true, credits_purchased: true }
                });
            }
            if (txCheck?.id) {
                await prisma.processed_webhooks.upsert({
                    where: { event_key: eventKey },
                    update: { status: 'processed' },
                    create: { event_key: eventKey, status: 'processed' },
                });

            } else {
                await prisma.processed_webhooks.upsert({
                    where: { event_key: eventKey },
                    update: { status: 'failed' },
                    create: { event_key: eventKey, status: 'failed' },
                });

            }
        } catch (e) {
            console.error('[Webhook InfinitePay] Erro ao verificar/atualizar processed_webhooks:', e);
        }

        return NextResponse.json({ status: 'success', queued: true, msgId: String(msgId) }, { status: 200 });

    } catch (error) {
        console.error('[Webhook InfinitePay] Erro inesperado no processamento do webhook:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
