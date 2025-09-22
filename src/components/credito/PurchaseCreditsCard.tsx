"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import { useSession } from "next-auth/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuCoins } from "react-icons/lu";
import { ToastBus } from "@/lib/toastBus";
import { useRealtimeStore } from "@/store/realtime-store";

type PurchaseCreditsCardProps = {
    currentCredits?: number;
    defaultAmount?: number;
    onHeightReady: (height: number) => void;
};

export default function PurchaseCreditsCard({
    currentCredits = 0,
    defaultAmount = 50,
    onHeightReady,
}: PurchaseCreditsCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const { data: session } = useSession();
    const [amount, setAmount] = useState<string>(String(defaultAmount));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [provider, setProvider] = useState<'infinitepay' | 'asaas'>('infinitepay');
    const realtimeCredits = useRealtimeStore(s => s.userCredits);
    const subscribeToUserCredits = useRealtimeStore(s => s.subscribeToUserCredits);
    const subscribeToUserCreditHolds = useRealtimeStore(s => s.subscribeToUserCreditHolds);

    useEffect(() => {
        if (cardRef.current) {
            const observer = new ResizeObserver(entries => {
                const height = entries[0]?.target?.getBoundingClientRect().height;
                if (height) {
                    onHeightReady(height);
                }
            });
            observer.observe(cardRef.current);
            return () => observer.disconnect();
        }
    }, [onHeightReady]);

    useEffect(() => {
        if (session?.user?.id) {
            subscribeToUserCredits(session.user.id);
            subscribeToUserCreditHolds(session.user.id);
        }
    }, [session?.user?.id, subscribeToUserCredits, subscribeToUserCreditHolds, realtimeCredits]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const onlyNums = /^[0-9]*$/;

        if (value === "") {
            setAmount("");
            return;
        }

        if (onlyNums.test(value)) {
            setAmount(value);
        }
    };

    const handleBuy = async () => {
        if (!session?.user?.email || !session?.user?.name) {
            ToastBus.checkoutLoginRequired();
            return;
        }
        setLoading(true);
        setError(null);

        try {
            if (provider === 'asaas') {
                const response = await fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        amount: Number(amount),
                        customerEmail: session.user.email,
                        customerName: session.user.name,
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao iniciar o checkout.");
                }
                if (data.checkoutUrl) {
                    ToastBus.checkoutRedirecting();
                    window.location.href = data.checkoutUrl;
                }
                return;
            }

            // InfinitePay
            const response = await fetch("/api/infinitepay-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: Number(amount),
                    description: `Compra de ${Number(amount).toLocaleString("pt-BR")} créditos`,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Falha ao iniciar o checkout.");
            }

            if (data.payment_url) {
                ToastBus.checkoutRedirecting();
                window.location.href = data.payment_url;
            }
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : "Ocorreu um erro desconhecido";
            ToastBus.checkoutFailed(errorMessage);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div ref={cardRef}>
            <Card className="lg:min-h-[430px] flex flex-col">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted border">
                            <LuCoins className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Comprar Créditos</CardTitle>
                            <CardDescription>
                                <span className="text-sm font-semibold text-foreground">Saldo atual: {(session?.user?.id ? realtimeCredits : currentCredits).toLocaleString("pt-BR")} créditos</span>
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                    <div className="grid gap-6 lg:mt-4">
                        <label htmlFor="valor" className="text-sm font-medium text-foreground">
                            Valor (R$)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <input
                                id="valor"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={1}
                                max={50000}
                                value={amount}
                                onChange={handleChange}
                                className="flex h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-describedby="valor-help"
                            />
                        </div>
                        <p id="valor-help" className="text-xs text-muted-foreground">
                            Você receberá <span className="font-medium">{(Number(amount) || 0).toLocaleString("pt-BR")} créditos</span>
                        </p>
                        <div className="grid gap-2 mt-4">
                            <span className="text-sm font-medium text-foreground">Forma de pagamento</span>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="provider"
                                        value="infinitepay"
                                        checked={provider === 'infinitepay'}
                                        onChange={() => setProvider('infinitepay')}
                                    />
                                    Cartão de crédito
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="provider"
                                        value="asaas"
                                        checked={provider === 'asaas'}
                                        onChange={() => setProvider('asaas')}
                                    />
                                    PIX
                                </label>
                            </div>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    {!session && <p className="text-xs text-center mt-2 text-muted-foreground">Faça login para poder comprar.</p>}
                </CardContent>
                <CardFooter className="mt-auto">
                    <Button
                        onClick={handleBuy}
                        className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950"
                        disabled={loading || !session}
                    >
                        {loading ? 'Processando...' : 'Comprar créditos'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}