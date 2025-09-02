import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ASAAS_API_URL = process.env.ASAAS_API_URL!;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;

export const runtime = 'nodejs';

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
        console.log('[Webhook][Debug] Payload bruto:', JSON.stringify(body));

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
            console.log('[Webhook][Debug] Evento ignorado (não pago):', event);
            return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
        }

        // Resolve userId: prefer externalReference uid, fallback to DB mapping by checkoutSession
        let userId: string | undefined;
        const uidMatch = typeof externalReference === 'string' ? externalReference.match(/uid:([^|]+)/) : null;
        if (uidMatch?.[1]) {
            userId = uidMatch[1];
        } else if (typeof checkoutSessionId === 'string') {
            console.log('[Webhook][Debug] Tentando resolver userId via checkout_sessions:', checkoutSessionId);
            const mapping = await prisma.checkout_sessions.findFirst({
                where: { asaas_checkout_id: checkoutSessionId },
                select: { user_id: true },
            });
            userId = mapping?.user_id;
        }
        console.log('[Webhook][Debug] externalReference:', externalReference, 'checkoutSessionId:', checkoutSessionId, 'userId resolvido:', userId);

        if (!userId) {
            // Fallback: tentar resolver pelo customer do Asaas
            const customerId: string | undefined = payment?.customer;
            if (customerId && ASAAS_API_URL && ASAAS_API_KEY) {
                try {
                    console.log('[Webhook][Debug] Tentando resolver via Asaas Customer:', customerId);
                    const custRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                        method: 'GET',
                        headers: {
                            'accept': 'application/json',
                            'access_token': ASAAS_API_KEY,
                        },
                    });
                    console.log('[Webhook][Debug] Customer fetch status:', custRes.status);
                    if (custRes.ok) {
                        const cust = await custRes.json();
                        const custExtRef: string | undefined = cust?.externalReference ?? cust?.external_reference;
                        const custEmail: string | undefined = cust?.email;
                        console.log('[Webhook][Debug] Customer payload (sanitizado):', { custExtRef, hasEmail: Boolean(custEmail) });
                        if (!userId && typeof custExtRef === 'string') {
                            const m = custExtRef.match(/uid:([^|]+)/);
                            if (m?.[1]) {
                                userId = m[1];
                                console.log('[Webhook][Debug] userId resolvido via customer.externalReference:', userId);
                            }
                        }
                        if (!userId && typeof custEmail === 'string') {
                            const userByEmail = await prisma.users.findUnique({ where: { email: custEmail }, select: { id: true } });
                            if (userByEmail?.id) {
                                userId = userByEmail.id;
                                console.log('[Webhook][Debug] userId resolvido via customer.email -> users.email:', userId);
                            }
                        }
                    } else {
                        console.warn('[Webhook] Falha ao obter customer do Asaas:', await custRes.text());
                    }
                } catch (e) {
                    console.error('[Webhook] Erro ao consultar customer no Asaas:', e);
                }
            }

            console.warn(`[Asaas Webhook] Não foi possível resolver userId para pagamento ${asaasPaymentId}.`);
            try {
                await prisma.processed_webhooks.upsert({
                    where: { event_key: asaasPaymentId },
                    update: { status: 'failed' },
                    create: { event_key: asaasPaymentId, status: 'failed' }
                });
            } catch (e) {
                console.warn('[Asaas Webhook] Falha ao registrar webhook como failed:', e);
            }
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
            console.log('[Webhook][Debug] Enfileirando job no PGMQ com payload:', JSON.stringify(payload));
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(payload)}::jsonb) AS msg_id`;
            msgId = result?.[0]?.msg_id as unknown as bigint;
            console.log('[Webhook][Debug] Job enfileirado com msg_id:', String(msgId ?? ''));
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
            console.log('[Webhook][Debug] processed_webhooks registrado como queued para', asaasPaymentId);
        } catch (e) {
            // Se já existir, seguimos como idempotente
            console.warn('[Asaas Webhook] processed_webhooks create falhou (provável duplicado).', e);
        }

        // Processa imediatamente uma vez para reduzir latência
        try {
            type WorkerRow = { result: unknown };
            const workerCall = await prisma.$queryRaw<WorkerRow[]>`SELECT public.process_credit_jobs_worker() AS result`;
            const workerRaw = workerCall?.[0]?.result as unknown;
            let workerStatus: string | undefined;
            if (typeof workerRaw === 'string') {
                try {
                    const parsed = JSON.parse(workerRaw);
                    workerStatus = parsed?.status;
                } catch {
                    // mantém indefinido
                }
            } else if (workerRaw && typeof workerRaw === 'object') {
                workerStatus = (workerRaw as Record<string, unknown>).status as string | undefined;
            }
            console.log('[Webhook][Debug] Resultado do worker imediato:', workerRaw);
            if (workerStatus !== 'success') {
                console.warn('[Webhook] Worker não retornou success. Status:', workerStatus);
                return NextResponse.json({ error: 'Worker não concluiu com sucesso', msgId: String(msgId ?? '') }, { status: 500 });
            }
        } catch (e) {
            console.error('[Webhook] Erro ao executar worker imediato:', e);
            return NextResponse.json({ error: 'Falha ao processar job imediatamente', msgId: String(msgId ?? '') }, { status: 500 });
        }

        console.log(`[Asaas Webhook] Job processado imediatamente (msg_id=${String(msgId)}) para userId=${userId} pagamento=${asaasPaymentId}`);
        return NextResponse.json({ ok: true, queued: true, processedNow: true, msgId: String(msgId ?? '') }, { status: 200 });

    } catch (error) {
        console.error('Erro no processamento do webhook do Asaas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
