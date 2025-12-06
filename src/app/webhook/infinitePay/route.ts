import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Tipagem do retorno da função atômica (igual ao Asaas)
type AtomicResult = {
    enqueued_msg_id: string | number;
    worker_result: {
        status: string;
        msg_id?: string | number;
        error?: string;
    };
};

/**
 * Endpoint de Webhook para receber e processar notificações da InfinitePay.
 * ATUALIZADO: Agora usa arquitetura Atômica (enqueue_and_process_credit) na fila V2.
 */
export async function POST(request: NextRequest) {
    // --- 1. Verificação de Segurança ---
    const secret = request.nextUrl.searchParams.get('secret');

    if (secret !== process.env.APP_WEBHOOK_SECRET) {
        console.warn('[Webhook InfinitePay] Tentativa de acesso com segredo inválido ou ausente.');
        return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

    // --- 2. Processamento do Payload ---
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

        // --- 3. Idempotência ---
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

        // --- 4. Normalização do Payload ---
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

        // --- 5. PROCESSAMENTO ATÔMICO (A Mágica Nova) ---
        let atomicResult: AtomicResult | null = null;

        try {
            // Usa a mesma função V2 que criamos para o Asaas
            const resultRaw = await prisma.$queryRaw<{ result: AtomicResult }[]>`
                SELECT public.enqueue_and_process_credit(${JSON.stringify(jobPayload)}::jsonb) as result
            `;

            atomicResult = resultRaw[0]?.result;

            if (atomicResult?.worker_result?.status === 'success') {
                console.log('🟢 [Webhook InfinitePay] Sucesso Atômico! Crédito processado:', JSON.stringify(atomicResult));
            } else {
                console.error('🔴 [Webhook InfinitePay] Falha no processamento atômico:', JSON.stringify(atomicResult));
            }

        } catch (e) {
            console.error('[Webhook InfinitePay] Falha fatal na chamada atômica:', e);
            return NextResponse.json({ error: 'Falha ao processar pagamento' }, { status: 500 });
        }

        // --- 6. Finalização ---
        // Se o processamento atômico deu sucesso, garantimos que foi salvo.
        try {
            const statusFinal = atomicResult?.worker_result?.status === 'success' ? 'processed' : 'failed';

            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: statusFinal },
                create: { event_key: eventKey, status: statusFinal },
            });
        } catch (e) {
            console.error('[Webhook InfinitePay] Erro ao atualizar status do webhook:', e);
        }

        return NextResponse.json({
            status: 'success',
            queued: true,
            msgId: String(atomicResult?.enqueued_msg_id),
            debug: atomicResult
        }, { status: 200 });

    } catch (error) {
        console.error('[Webhook InfinitePay] Erro inesperado no processamento:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}