// app/api/create-payment/route.ts

import { NextResponse } from 'next/server';
import { authOptions } from '../../../../auth';
import { getServerSession } from 'next-auth/next';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    try {
        const body = await request.json();
        const { amount, description } = body;

        // Validação dos dados recebidos
        if (!amount || !description) {
            return NextResponse.json(
                { error: 'Amount and description are required' },
                { status: 400 }
            );
        }

        const infiniteTag = process.env.INFINITE_TAG;
        if (!infiniteTag) {
            return NextResponse.json(
                { error: 'InfinitePay handle is not configured' },
                { status: 500 }
            );
        }

        const SITE_URL = process.env.NEXTAUTH_URL!;

        const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                handle: infiniteTag, // Valor sempre em centavos
                order_nsu: `pedido-${Date.now()}`, // Gerar um número de pedido único
                redirect_url: `${SITE_URL}/obrigado`,
                webhook_url: `${SITE_URL}/webhook/infinitepay-payment`,
                items: [
                    {
                        quantity: 1,
                        price: Math.round(amount * 100),
                        description: description,
                    }
                ],
                customer: {
                    name: session.user.name ?? '',
                    email: session.user.email ?? '',
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('InfinitePay API error response:', errorData);
            return NextResponse.json(
                { error: errorData.message || 'Failed to create payment link' },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('InfinitePay API response:', data);
        return NextResponse.json({ payment_url: data.url });

    } catch (error) {
        console.error('Internal server error:', error);
        return NextResponse.json(
            { error: 'An internal error occurred' },
            { status: 500 }
        );
    }
}