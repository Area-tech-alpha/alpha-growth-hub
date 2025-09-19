import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../auth';
import { prisma } from '@/lib/prisma';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';

const ASAAS_API_URL = process.env.ASAAS_API_URL!;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;
const SITE_URL = process.env.NEXTAUTH_URL!;

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const { amount } = await request.json();

        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!amount || amount < 10 || amount > 50000) {
            return NextResponse.json({ error: 'Valor inválido. Deve ser entre R$ 10,00 e R$ 50.000,00' }, { status: 400 });
        }

        const customer = await fetch(`${ASAAS_API_URL}/customers?email=${session.user.email}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'access_token': ASAAS_API_KEY,
                'content-type': 'application/json',
            },
        }).then((res) => (
            res.ok ? res.json() : console.error('Erro ao buscar cliente no Asaas:', res.statusText)
        ));

        console.log(customer);

        const credits = Math.floor(amount);
        const internalCheckoutId = uuidv4();
        const externalReference = `ck:${internalCheckoutId}|uid:${session.user.id}`;

        const checkoutData = {
            billingTypes: ['CREDIT_CARD', 'PIX'],
            chargeTypes: ['DETACHED', 'INSTALLMENT'],
            customer: customer.data.id ? customer.data.id : null,
            installment: { 'maxInstallmentCount': 3 },
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            externalReference: externalReference,
            minutesToExpire: 60,
            callback: {
                cancelUrl: `${SITE_URL}/comprar-creditos?status=cancelled`,
                expiredUrl: `${SITE_URL}/comprar-creditos?status=expired`,
                successUrl: `${SITE_URL}/obrigado?status=success&checkoutId=${internalCheckoutId}`,
            },
            items: [
                {
                    name: `Créditos Alpha Growth Hub`,
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
            return NextResponse.json({ error: 'Falha ao criar checkout no Asaas', details: errorData }, { status: response.status });
        }

        const asaasResponse = await response.json();

        if (!asaasResponse?.id) {
            return NextResponse.json({ error: 'Resposta inválida do Asaas (sem id do checkout)' }, { status: 502 });
        }
        try {
            const persist = async () => {
                await prisma.checkout_sessions.upsert({
                    where: { asaas_checkout_id: asaasResponse.id },
                    update: {
                        internal_checkout_id: internalCheckoutId,
                        user_id: session.user.id,
                    },
                    create: {
                        asaas_checkout_id: asaasResponse.id,
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
            console.error('[Checkout] Prisma persist failed, trying Supabase upsert:', e);
            try {
                const supabase = await createSupabaseServerClient();
                const { error } = await supabase
                    .from('checkout_sessions')
                    .upsert({
                        asaas_checkout_id: asaasResponse.id,
                        internal_checkout_id: internalCheckoutId,
                        user_id: session.user.id,
                    }, { onConflict: 'asaas_checkout_id' });
                if (error) {
                    console.error('[Checkout] Supabase upsert fallback failed:', error);
                    return NextResponse.json({ error: 'Falha ao persistir mapeamento do checkout' }, { status: 500 });
                }
            } catch (err2) {
                console.error('[Checkout] Supabase client init failed:', err2);
                return NextResponse.json({ error: 'Falha ao persistir mapeamento do checkout' }, { status: 500 });
            }
        }

        const payload = {
            success: true,
            checkoutUrl: asaasResponse.link,
            checkoutId: internalCheckoutId,
            amount: amount,
            credits: credits,
        };
        return NextResponse.json(payload);

    } catch (error) {
        console.error('Erro interno ao criar checkout:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
