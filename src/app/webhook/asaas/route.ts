import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const event: string | undefined = body?.event;
        const payment = body?.payment;

        const asaasPaymentId: string | undefined = payment?.id;
        const externalReference: string | undefined = payment?.externalReference ?? payment?.external_reference;
        const paidValue: number | undefined = typeof payment?.value === 'number' ? payment.value : Number(payment?.value);

        console.log('Webhook do Asaas recebido:', { event, paymentId: asaasPaymentId, externalReference });

        if (!event || !asaasPaymentId) {
            return NextResponse.json({ ok: true }, { status: 200 });
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

        // Extract userId from externalReference: format set in checkout as `ck:<id>|uid:<userId>`
        const uidMatch = typeof externalReference === 'string' ? externalReference.match(/uid:([^|]+)/) : null;
        const userId = uidMatch?.[1];

        if (!userId) {
            console.warn(`[Asaas Webhook] externalReference sem uid para pagamento ${asaasPaymentId}:`, externalReference);
            return NextResponse.json({ ok: true }, { status: 200 });
        }

        if (paidValue === undefined || Number.isNaN(paidValue)) {
            console.warn(`[Asaas Webhook] valor inválido no pagamento ${asaasPaymentId}:`, payment?.value);
            return NextResponse.json({ ok: true }, { status: 200 });
        }

        const creditsToAdd = Math.floor(paidValue);

        // Idempotent processing using unique asaas_payment_id
        const alreadyProcessed = await prisma.credit_transactions.findUnique({
            where: { asaas_payment_id: asaasPaymentId }
        });
        if (alreadyProcessed) {
            console.log(`[Asaas Webhook] Pagamento ${asaasPaymentId} já processado. Ignorando.`);
            return NextResponse.json({ ok: true, alreadyProcessed: true }, { status: 200 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.credit_transactions.create({
                data: {
                    asaas_payment_id: asaasPaymentId,
                    user_id: userId,
                    amount_paid: paidValue.toFixed(2),
                    credits_purchased: creditsToAdd.toFixed(2),
                    metadata: payment ?? {},
                    status: 'completed',
                }
            });

            // Increment user's credit balance
            await tx.users.update({
                where: { id: userId },
                data: {
                    credit_balance: {
                        // Decimal increment accepts number for Prisma Decimal
                        increment: creditsToAdd
                    },
                    updated_at: new Date()
                }
            });
        });

        console.log(`[Asaas Webhook] Créditos adicionados (${creditsToAdd}) para userId=${userId} pagamento=${asaasPaymentId}`);

        return NextResponse.json({ ok: true }, { status: 200 });

    } catch (error) {
        console.error('Erro no processamento do webhook do Asaas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
