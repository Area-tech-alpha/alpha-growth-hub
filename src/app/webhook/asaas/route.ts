import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const event: string | undefined = body?.event;
        const payment = body?.payment;

        const asaasPaymentId: string | undefined = payment?.id;
        const externalReference: string | undefined = payment?.externalReference ?? payment?.external_reference;
        const checkoutSessionId: string | undefined = payment?.checkoutSession;
        const paidValue: number | undefined = typeof payment?.value === 'number' ? payment.value : Number(payment?.value);

        console.log('Webhook do Asaas recebido:', { event, paymentId: asaasPaymentId, externalReference });

        if (!event || !asaasPaymentId) {
            return NextResponse.json({ error: 'Evento/pagamento inválido' }, { status: 400 });
        }

        // Process only successful payment events
        const isPaidEvent = (
            event === 'PAYMENT_RECEIVED' ||
            event === 'PAYMENT_CONFIRMED' ||
            event === 'PAYMENT_APPROVED'
        );

        if (!isPaidEvent) {
            return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }

        // Resolve userId: prefer externalReference uid, fallback to DB mapping by checkoutSession
        let userId: string | undefined;
        const uidMatch = typeof externalReference === 'string' ? externalReference.match(/uid:([^|]+)/) : null;
        if (uidMatch?.[1]) {
            userId = uidMatch[1];
        } else if (typeof checkoutSessionId === 'string') {
            const mapping = await prisma.checkout_sessions.findFirst({
                where: { asaas_checkout_id: checkoutSessionId },
                select: { user_id: true },
            });
            userId = mapping?.user_id;
        }

        if (!userId) {
            console.warn(`[Asaas Webhook] Não foi possível resolver userId para pagamento ${asaasPaymentId}.`);
            return NextResponse.json({ error: 'Usuário não identificado' }, { status: 500 });
        }

        if (paidValue === undefined || Number.isNaN(paidValue)) {
            console.warn(`[Asaas Webhook] valor inválido no pagamento ${asaasPaymentId}:`, payment?.value);
            return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
        }

        // Idempotent processing using unique asaas_payment_id
        const alreadyProcessed = await prisma.credit_transactions.findUnique({
            where: { asaas_payment_id: asaasPaymentId }
        });
        if (alreadyProcessed) {
            console.log(`[Asaas Webhook] Pagamento ${asaasPaymentId} já processado. Ignorando.`);
            return NextResponse.json({ ok: true, alreadyProcessed: true }, { status: 200 });
        }

        // Enfileira job para o worker no DB (PGMQ)
        const payload = {
            event,
            payment,
            userId,
            enqueuedAt: new Date().toISOString(),
        };

        let msgId: bigint | number | undefined;
        try {
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(payload)}::jsonb) AS msg_id`;
            msgId = result?.[0]?.msg_id as unknown as bigint;
        } catch (e) {
            console.error('[Asaas Webhook] Falha ao enfileirar job no PGMQ:', e);
            return NextResponse.json({ error: 'Falha ao enfileirar job' }, { status: 500 });
        }

        try {
            await prisma.processed_webhooks.create({
                data: {
                    event_key: asaasPaymentId,
                    status: 'queued',
                }
            });
        } catch (e) {
            // Se já existir, seguimos como idempotente
            console.warn('[Asaas Webhook] processed_webhooks create falhou (provável duplicado).', e);
        }

        console.log(`[Asaas Webhook] Job enfileirado (msg_id=${String(msgId)}) para userId=${userId} pagamento=${asaasPaymentId}`);
        return NextResponse.json({ ok: true, queued: true, msgId: String(msgId ?? '') }, { status: 200 });

    } catch (error) {
        console.error('Erro no processamento do webhook do Asaas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
