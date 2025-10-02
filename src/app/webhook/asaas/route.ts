import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const asaasToken = request.headers.get("asaas-access-token");

    if (asaasToken !== process.env.ASAAS_WEBHOOK_SECRET) {
        console.warn('[Webhook Asaas] Tentativa de acesso com token inválido.');
        return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

    const rawBody = await request.text();

    try {
        const body = JSON.parse(rawBody);
        const { event, payment } = body;

        // Validação Mínima: Garante que é um payload válido do Asaas
        if (!event || !payment?.id) {
            console.warn('[Webhook Asaas] Payload com estrutura mínima inválida:', body);
            return NextResponse.json({ error: 'Payload com estrutura mínima inválida' }, { status: 400 });
        }

        // --- ALTERAÇÃO PRINCIPAL AQUI ---
        // Verifica se o pagamento veio da nossa aplicação (através do checkoutSession).
        // Se não tiver, é de outra origem. Ignoramos e retornamos 200 OK.
        if (!payment.checkoutSession) {
            console.log(`[Webhook Asaas] Ignorando pagamento de outra origem. Evento: ${event}, Payment ID: ${payment.id}`);
            return NextResponse.json({ status: 'ignored', reason: 'Pagamento de outra origem' }, { status: 200 });
        }
        // ---------------------------------

        const asaasPaymentId: string = payment.id;
        const checkoutSessionId: string = payment.checkoutSession;

        const sessionMapping = await prisma.checkout_sessions.findFirst({
            where: { asaas_checkout_id: checkoutSessionId },
            select: { user_id: true, internal_checkout_id: true },
        });

        // Se tem checkoutSession mas não achamos no DB, é um erro real da nossa aplicação.
        if (!sessionMapping?.user_id) {
            console.error(`[Webhook Asaas CRÍTICO] Não foi possível encontrar o usuário para o checkoutSessionId: ${checkoutSessionId}. Pagamento: ${asaasPaymentId}`);
            // Retornamos 200 aqui também para evitar que o Asaas reenvie um webhook que nunca vai funcionar.
            // O erro crítico já foi logado para investigação.
            return NextResponse.json({ status: 'error', message: 'Usuário correspondente não encontrado, webhook ignorado.' }, { status: 200 });
        }

        const userId = sessionMapping.user_id;
        const internalCheckoutId = sessionMapping.internal_checkout_id;
        const eventKey = `checkout_status:${internalCheckoutId}`;

        const isPaidEvent = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
        if (!isPaidEvent) {
            try {
                await prisma.processed_webhooks.upsert({
                    where: { event_key: eventKey },
                    update: { status: 'failed' },
                    create: { event_key: eventKey, status: 'failed' },
                });
            } catch (e) {
                console.error('[Webhook Asaas] Falha ao registrar status failed em processed_webhooks:', e);
            }
            return NextResponse.json({ status: 'ignored', event }, { status: 200 });
        }

        const alreadyProcessed = await prisma.credit_transactions.findUnique({
            where: { asaas_payment_id: asaasPaymentId }
        });

        if (alreadyProcessed) {
            try {
                await prisma.processed_webhooks.upsert({
                    where: { event_key: eventKey },
                    update: { status: 'processed' },
                    create: { event_key: eventKey, status: 'processed' },
                });
            } catch (e) {
                console.error('[Webhook Asaas] Falha ao registrar status processed (idempotente) em processed_webhooks:', e);
            }
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        const jobPayload = {
            event,
            payment,
            userId,
            enqueuedAt: new Date().toISOString(),
        };

        let msgId: bigint | number;
        try {
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(jobPayload)}::jsonb) AS msg_id`;
            msgId = result[0].msg_id;
        } catch (e) {
            console.error('[Webhook Asaas] Falha ao enfileirar job no PGMQ:', e);
            return NextResponse.json({ error: 'Falha ao enfileirar job' }, { status: 500 });
        }

        try {
            await prisma.$queryRaw`SELECT public.process_credit_jobs_worker()`;
        } catch (e) {
            console.error('[Webhook Asaas] Erro ao executar worker imediato. O job ainda está na fila.', e);
        }

        try {
            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'processed' },
                create: { event_key: eventKey, status: 'processed' },
            });
        } catch (e) {
            console.error('[Webhook Asaas] Falha ao registrar status processed em processed_webhooks:', e);
        }

        return NextResponse.json({ status: 'success', queued: true, msgId: String(msgId) }, { status: 200 });

    } catch (error) {
        console.error('[Webhook Asaas] Erro inesperado no processamento do webhook:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}