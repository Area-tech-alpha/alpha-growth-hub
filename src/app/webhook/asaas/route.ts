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

        if (!event || !payment?.id) {
            console.warn('[Webhook Asaas] Payload com estrutura mínima inválida:', body);
            return NextResponse.json({ error: 'Payload com estrutura mínima inválida' }, { status: 400 });
        }

        const asaasPaymentId: string = payment.id;
        const parsedExternal = typeof payment.externalReference === 'string'
            ? parseExternalReference(payment.externalReference)
            : null;
        const checkoutSessionId: string | null = payment.checkoutSession ?? null;
        if (!checkoutSessionId) {
            console.log(`[Webhook Asaas] checkoutSession ausente; tentando fallback via externalReference. Evento: ${event}, Payment ID: ${asaasPaymentId}`);
        }

        if (!checkoutSessionId && !parsedExternal?.checkoutId) {
            console.log(`[Webhook Asaas] Ignorando pagamento de outra origem. Evento: ${event}, Payment ID: ${asaasPaymentId}`);
            return NextResponse.json({ status: 'ignored', reason: 'Pagamento de outra origem' }, { status: 200 });
        }

        let sessionMapping = checkoutSessionId
            ? await prisma.checkout_sessions.findFirst({
                where: { asaas_checkout_id: checkoutSessionId },
                select: { user_id: true, internal_checkout_id: true },
            })
            : null;

        // Fallback: alguns webhooks do Asaas nÇœo trazem checkoutSession. Tentamos usar externalReference.
        if (!sessionMapping?.user_id && parsedExternal?.checkoutId) {
            sessionMapping = await prisma.checkout_sessions.findFirst({
                where: { internal_checkout_id: parsedExternal.checkoutId },
                select: { user_id: true, internal_checkout_id: true },
            });
        }

        // Se veio externalReference com uid mas ainda nÇœo achou, logamos o UID para investigaÇõÇœo.
        if (!sessionMapping?.user_id && parsedExternal?.userId) {
            const fallbackByUid = await prisma.checkout_sessions.findFirst({
                where: { user_id: parsedExternal.userId },
                select: { user_id: true, internal_checkout_id: true },
            });
            if (fallbackByUid) {
                sessionMapping = fallbackByUid;
            }
        }

        if (!sessionMapping?.user_id) {
            console.error(`[Webhook Asaas CRÍTICO] Não foi possível encontrar o usuário (checkoutSessionId=${checkoutSessionId}, externalReference=${payment.externalReference}). Pagamento: ${asaasPaymentId}`);
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

        // === NOVO: atualiza a cobrança no Asaas com a descrição/origem ===
        const asaasStatus = String(payment?.status ?? '').toUpperCase();
        const canEditAsaasPayment = ['PENDING', 'OVERDUE'].includes(asaasStatus); // Asaas só permite editar nesses status
        if (canEditAsaasPayment) {
            try {
                const credits = Math.floor(Number(payment.value ?? 0));
                const desc =
                    `Pagamento originado no Growth Hub — compra de ${credits.toLocaleString('pt-BR')} créditos ` +
                    `(checkout ${internalCheckoutId} • uid ${userId})`;

                const payloadUpdate: {
                    description: string;
                    externalReference?: string;
                } = {
                    description: desc,
                };

                // opcional: garantir externalReference também na cobrança
                // se você quer propagar seu id interno aqui
                payloadUpdate.externalReference = `ck:${internalCheckoutId}|uid:${userId}`;

                const resUpdate = await fetch(`${process.env.ASAAS_API_URL}/payments/${asaasPaymentId}`, {
                    method: 'PUT',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'access_token': process.env.ASAAS_API_KEY as string,
                    },
                    body: JSON.stringify(payloadUpdate),
                });

                if (!resUpdate.ok) {
                    const errJson = await safeJson(resUpdate);
                    console.warn('[Webhook Asaas] Falha ao atualizar descrição do payment:', resUpdate.status, errJson);
                    // segue o fluxo mesmo assim — não bloqueia crédito
                }
            } catch (e) {
                console.warn('[Webhook Asaas] Exceção ao atualizar cobrança (description/externalReference):', e);
                // segue o fluxo mesmo assim
            }
        } else {
            console.log(`[Webhook Asaas] Pulando atualização da cobrança (status ${asaasStatus}) para evitar 400 do Asaas.`);
        }
        // === FIM NOVO ===

        // idempotência: se já processou, só marca processed e sai
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
            source: 'monetary',
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

// util para não quebrar o fluxo se o JSON vier inválido
async function safeJson(r: Response) {
    try { return await r.json(); } catch { return { raw: await r.text() }; }
}

function parseExternalReference(ref: string): { checkoutId?: string; userId?: string } | null {
    // Formato definido na criação: "ck:{internalCheckoutId}|uid:{userId}"
    if (!ref.includes('ck:') && !ref.includes('uid:')) return null;
    const parts = ref.split('|').map(p => p.trim());
    const out: { checkoutId?: string; userId?: string } = {};
    for (const part of parts) {
        if (part.startsWith('ck:')) out.checkoutId = part.slice(3);
        if (part.startsWith('uid:')) out.userId = part.slice(4);
    }
    return out;
}
