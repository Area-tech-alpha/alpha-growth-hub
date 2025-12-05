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

        // ignore pagamentos que não vieram do seu checkout
        if (!payment.checkoutSession) {
            console.log(`[Webhook Asaas] Ignorando pagamento de outra origem. Evento: ${event}, Payment ID: ${payment.id}`);
            return NextResponse.json({ status: 'ignored', reason: 'Pagamento de outra origem' }, { status: 200 });
        }

        const asaasPaymentId: string = payment.id;
        const checkoutSessionId: string = payment.checkoutSession;

        const sessionMapping = await prisma.checkout_sessions.findFirst({
            where: { asaas_checkout_id: checkoutSessionId },
            select: { user_id: true, internal_checkout_id: true },
        });

        if (!sessionMapping?.user_id) {
            console.error(`[Webhook Asaas CRÍTICO] Não foi possível encontrar o usuário para o checkoutSessionId: ${checkoutSessionId}. Pagamento: ${asaasPaymentId}`);
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
                console.error('[Webhook Asaas] Falha ao registrar status failed:', e);
            }
            return NextResponse.json({ status: 'ignored', event }, { status: 200 });
        }

        // === CORREÇÃO 1: Só atualiza descrição se PENDING ===
        const statusUpper = String(payment.status || '').toUpperCase();
        if (statusUpper === 'PENDING' || statusUpper === 'OVERDUE') {
            try {
                const credits = Math.floor(Number(payment.value ?? 0));
                const desc = `Pagamento originado no Growth Hub — compra de ${credits.toLocaleString('pt-BR')} créditos (checkout ${internalCheckoutId})`;

                const payloadUpdate = {
                    description: desc,
                    externalReference: `ck:${internalCheckoutId}|uid:${userId}`
                };

                // Fetch sem await (fire and forget)
                fetch(`${process.env.ASAAS_API_URL}/payments/${asaasPaymentId}`, {
                    method: 'PUT',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'access_token': process.env.ASAAS_API_KEY as string,
                    },
                    body: JSON.stringify(payloadUpdate),
                }).then((res) => {
                    if (!res.ok) console.warn('[Webhook Asaas] Aviso: Não foi possível atualizar descrição (Status ' + res.status + ')');
                }).catch(err => console.warn('[Webhook Asaas] Erro de rede ao atualizar descrição:', err));

            } catch (e) {
                console.warn('[Webhook Asaas] Erro ao montar payload de atualização:', e);
            }
        }

        // idempotência
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
            } catch { }
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        // ... (Logo após definir o jobPayload) ...

        const jobPayload = {
            event,
            payment,
            userId,
            source: 'monetary',
            enqueuedAt: new Date().toISOString(),
        };

        let atomicResult: { enqueued_msg_id?: string; worker_result?: { status?: string; msg_id?: string; error?: string } } | null = null;

        try {
            // CHAMADA ÚNICA: Envia e Processa junto
            const resultRaw = await prisma.$queryRaw<{ result: { enqueued_msg_id?: string; worker_result?: { status?: string; msg_id?: string; error?: string } } }[]>`
                SELECT public.enqueue_and_process_credit(${JSON.stringify(jobPayload)}::jsonb) as result
            `;

            // O retorno será: { enqueued_msg_id: 123, worker_result: { status: 'success', ... } }
            atomicResult = resultRaw[0]?.result;

            if (atomicResult?.worker_result?.status === 'success') {
                console.log('🟢 [Webhook Asaas] Crédito processado com sucesso (Atômico):', atomicResult);
            } else {
                console.error('🔴 [Webhook Asaas] Erro no processamento atômico:', atomicResult);
            }

        } catch (e) {
            console.error('[Webhook Asaas] Falha fatal na chamada atômica:', e);
            return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 });
        }

        // Marca como processado
        try {
            await prisma.processed_webhooks.upsert({
                where: { event_key: eventKey },
                update: { status: 'processed' },
                create: { event_key: eventKey, status: 'processed' },
            });
        } catch { }

        return NextResponse.json({
            status: 'success',
            queued: true,
            debug: atomicResult
        }, { status: 200 });
    } catch (error) {
        console.error('[Webhook Asaas] Erro inesperado no processamento do webhook:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}