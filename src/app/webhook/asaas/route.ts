import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function POST(request: Request) {
    try {
        const { event, payment } = await request.json();

        console.log('Webhook do Asaas recebido:', { event, paymentId: payment?.id });

        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const asaasPaymentId = payment.id;
            const userEmail = memoryStore.checkoutToEmail[asaasPaymentId];

            if (userEmail) {
                const amount = payment.value;
                const creditsToAdd = Math.floor(amount * 2);

                memoryStore.userCredits[userEmail] = (memoryStore.userCredits[userEmail] || 0) + creditsToAdd;

                console.log(`PAGAMENTO CONFIRMADO: Adicionados ${creditsToAdd} créditos para ${userEmail}. Total: ${memoryStore.userCredits[userEmail]}`);

            } else {
                console.warn(`Webhook recebido para pagamento ${asaasPaymentId}, mas nenhum email correspondente foi encontrado.`);
            }
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error('Erro no processamento do webhook do Asaas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
