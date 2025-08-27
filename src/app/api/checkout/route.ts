import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '@/lib/memory-store';

const ASAAS_API_URL = process.env.ASAAS_API_URL!;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;
const SITE_URL = process.env.NEXTAUTH_URL!;

export async function POST(request: Request) {
    try {
        const { amount, customerEmail, customerName } = await request.json();

        if (!amount || amount < 10 || amount > 50000) {
            return NextResponse.json({ error: 'Valor inválido. Deve ser entre R$ 10,00 e R$ 50.000,00' }, { status: 400 });
        }
        if (!customerEmail || !customerName) {
            return NextResponse.json({ error: 'Email e nome do cliente são obrigatórios' }, { status: 400 });
        }

        const credits = Math.floor(amount * 2);
        const internalCheckoutId = uuidv4();
        const externalReference = `${internalCheckoutId}|${customerEmail}`;

        const checkoutData = {
            billingTypes: ['CREDIT_CARD', 'PIX'],
            chargeTypes: ['DETACHED'],
            name: customerName.substring(0, 30),
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            externalReference: externalReference,
            callback: {
                successUrl: `${SITE_URL}/obrigado?status=success&checkoutId=${internalCheckoutId}`,
                cancelUrl: `${SITE_URL}/comprar-creditos?status=cancelled`,
                expireUrl: `${SITE_URL}/comprar-creditos?status=expired`,
                autoRedirect: true,
            },
            items: [
                {
                    name: `Créditos Alpha Lead Broker`,
                    description: `Compra de ${credits.toLocaleString()} créditos`,
                    quantity: 1,
                    value: amount
                }
            ]
        };

        const response = await fetch(`${ASAAS_API_URL}/checkouts`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'access_token': ASAAS_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify(checkoutData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro da API Asaas:', errorData);
            return NextResponse.json({ error: 'Falha ao criar checkout no Asaas', details: errorData }, { status: response.status });
        }

        const asaasResponse = await response.json();

        if (asaasResponse.id) {
            memoryStore.checkoutToEmail[asaasResponse.id] = customerEmail;
        }

        return NextResponse.json({
            success: true,
            checkoutUrl: asaasResponse.link,
            checkoutId: internalCheckoutId,
            amount: amount,
            credits: credits,
        });

    } catch (error) {
        console.error('Erro interno ao criar checkout:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
