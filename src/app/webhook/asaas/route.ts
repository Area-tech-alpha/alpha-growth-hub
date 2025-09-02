import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Variáveis de ambiente essenciais para o webhook
const ASAAS_WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;

/**
 * Valida a assinatura do webhook para garantir que a requisição veio do Asaas.
 * @param rawBody O corpo da requisição como texto puro.
 * @param signature O valor do header 'Asaas-Signature'.
 * @returns {boolean} True se a assinatura for válida, false caso contrário.
 */
function verifyAsaasSignature(rawBody: string, signature: string | null): boolean {
    if (!ASAAS_WEBHOOK_SECRET || !signature) {
        console.error('[Webhook Security] Secret de webhook ou assinatura ausente.');
        return false;
    }

    const hmac = crypto.createHmac('sha256', ASAAS_WEBHOOK_SECRET);
    const computedSignature = hmac.update(rawBody).digest('hex');

    return computedSignature === signature;
}


// O Next.js recomenda o runtime 'nodejs' para usar APIs do Node como 'crypto'
export const runtime = 'nodejs';

export async function POST(request: Request) {
    // 1. SEGURANÇA: Obter o corpo como texto para validar a assinatura ANTES de fazer o parse
    const rawBody = await request.text();
    const signature = request.headers.get('Asaas-Signature');

    if (!verifyAsaasSignature(rawBody, signature)) {
        console.warn('[Webhook] Assinatura inválida. Requisição bloqueada.');
        return NextResponse.json({ error: 'Assinatura inválida' }, { status: 403 });
    }

    try {
        // Agora que a assinatura é válida, podemos fazer o parse do JSON
        const body = JSON.parse(rawBody);
        const { event, payment } = body;

        // 2. VALIDAÇÃO: Garantir que o payload tem os dados mínimos
        if (!event || !payment?.id || !payment?.checkoutSession) {
            console.warn('[Webhook] Payload inválido ou campos essenciais ausentes:', body);
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

        const asaasPaymentId: string = payment.id;
        const checkoutSessionId: string = payment.checkoutSession;

        console.log(`[Webhook] Evento '${event}' recebido para o pagamento '${asaasPaymentId}'`);

        // 3. FILTRO DE EVENTOS: Processar apenas eventos de pagamento bem-sucedido
        const isPaidEvent = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
        if (!isPaidEvent) {
            console.log(`[Webhook] Evento '${event}' ignorado (não é um evento de pagamento).`);
            return NextResponse.json({ status: 'ignored', event }, { status: 200 });
        }

        // 4. LÓGICA PRINCIPAL: Encontrar o usuário através do checkoutSessionId salvo no DB
        console.log(`[Webhook] Buscando usuário pelo checkoutSessionId: ${checkoutSessionId}`);
        const sessionMapping = await prisma.checkout_sessions.findFirst({
            where: { asaas_checkout_id: checkoutSessionId },
            select: { user_id: true },
        });

        if (!sessionMapping?.user_id) {
            console.error(`[Webhook CRÍTICO] Não foi possível encontrar o usuário para o checkoutSessionId: ${checkoutSessionId}. Pagamento: ${asaasPaymentId}`);
            return NextResponse.json({ error: 'Usuário correspondente não encontrado' }, { status: 404 });
        }

        const userId = sessionMapping.user_id;
        console.log(`[Webhook] Usuário encontrado: ${userId}`);

        // 5. IDEMPOTÊNCIA: Verificar se este pagamento já foi processado
        const alreadyProcessed = await prisma.credit_transactions.findUnique({
            where: { asaas_payment_id: asaasPaymentId }
        });

        if (alreadyProcessed) {
            console.log(`[Webhook] Pagamento ${asaasPaymentId} já processado. Ignorando.`);
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        // 6. PROCESSAMENTO (Job Queue): Enfileirar o trabalho para ser processado de forma assíncrona
        const jobPayload = {
            event,
            payment,
            userId,
            enqueuedAt: new Date().toISOString(),
        };

        let msgId: bigint | number;
        try {
            console.log('[Webhook] Enfileirando job no PGMQ...');
            const result = await prisma.$queryRaw<{ msg_id: bigint }[]>`SELECT pgmq.send('credit_jobs', ${JSON.stringify(jobPayload)}::jsonb) AS msg_id`;
            msgId = result[0].msg_id;
            console.log(`[Webhook] Job enfileirado com sucesso. Msg ID: ${String(msgId)}`);
        } catch (e) {
            console.error('[Webhook] Falha ao enfileirar job no PGMQ:', e);
            return NextResponse.json({ error: 'Falha ao enfileirar job' }, { status: 500 });
        }

        // Opcional: Chamar o worker imediatamente para baixa latência (como no seu código original)
        // Se este processo for demorado, considere removê-lo e deixar apenas um worker rodando em background
        try {
            await prisma.$queryRaw`SELECT public.process_credit_jobs_worker()`;
            console.log(`[Webhook] Worker imediato executado para Msg ID: ${String(msgId)}`);
        } catch (e) {
            console.error('[Webhook] Erro ao executar worker imediato. O job ainda está na fila.', e);
            // Não retornamos um erro aqui, pois o job já foi enfileirado com sucesso.
        }

        // 7. SUCESSO: Responder ao Asaas que recebemos e aceitamos o webhook
        console.log(`[Webhook] Processamento para o pagamento ${asaasPaymentId} concluído.`);
        return NextResponse.json({ status: 'success', queued: true, msgId: String(msgId) }, { status: 200 });

    } catch (error) {
        console.error('[Webhook] Erro inesperado no processamento do webhook:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}