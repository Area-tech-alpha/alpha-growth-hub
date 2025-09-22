// app/api/create-payment/route.ts

import { NextResponse } from 'next/server';
import { authOptions } from '../../../../auth';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';

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
        const WEBHOOK_SECRET = process.env.APP_WEBHOOK_SECRET;

        // Gera um ID interno e persiste o mapeamento com o usuário antes de criar o link
        const internalCheckoutId = uuidv4();
        try {
            const persist = async () => {
                await prisma.checkout_sessions.create({
                    data: {
                        internal_checkout_id: internalCheckoutId,
                        user_id: session.user.id,
                    }
                });
            };
            let lastErr: unknown = null;
            for (let i = 0; i < 2; i++) {
                try { await persist(); lastErr = null; break; } catch (err) {
                    lastErr = err; await new Promise(r => setTimeout(r, 300 * (i + 1)));
                }
            }
            if (lastErr) throw lastErr;
        } catch (e) {
            console.log('[InfinitePay Checkout] Prisma persist failed, trying Supabase upsert:', e);
            // Fallback para Supabase caso Prisma falhe
            try {
                const supabase = await createSupabaseServerClient();
                const { error } = await supabase
                    .from('checkout_sessions')
                    .insert({ internal_checkout_id: internalCheckoutId, user_id: session.user.id });
                if (error) {
                    console.error('[InfinitePay Checkout] Supabase insert fallback failed:', error);
                    return NextResponse.json({ error: 'Falha ao persistir mapeamento do checkout' }, { status: 500 });
                }
            } catch (err2) {
                console.error('[InfinitePay Checkout] Supabase client init failed:', err2);
                return NextResponse.json({ error: 'Falha ao persistir mapeamento do checkout' }, { status: 500 });
            }
        }

        const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                handle: infiniteTag,
                // Usa o ID interno como order_nsu para casar no webhook
                order_nsu: internalCheckoutId,
                // Obrigado precisa do checkoutId para consultar status
                redirect_url: `${SITE_URL}/obrigado?checkoutId=${internalCheckoutId}`,
                // Aponta para o endpoint correto do webhook e inclui secret se disponível
                webhook_url: WEBHOOK_SECRET
                    ? `${SITE_URL}/webhook/infinitePay?secret=${encodeURIComponent(WEBHOOK_SECRET)}`
                    : `${SITE_URL}/webhook/infinitePay`,
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
        return NextResponse.json({ payment_url: data.url, checkoutId: internalCheckoutId });

    } catch (error) {
        console.error('Internal server error:', error);
        return NextResponse.json(
            { error: 'An internal error occurred' },
            { status: 500 }
        );
    }
}