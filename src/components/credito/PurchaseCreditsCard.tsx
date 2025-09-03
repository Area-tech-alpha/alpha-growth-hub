"use client";

import { useEffect, useState, ChangeEvent } from "react";
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
import { toast } from "sonner";
import { useRealtimeStore } from "@/store/realtime-store";

type PurchaseCreditsCardProps = {
    currentCredits?: number;
    defaultAmount?: number;
};

export default function PurchaseCreditsCard({
    currentCredits = 0,
    defaultAmount = 50,
}: PurchaseCreditsCardProps) {
    const { data: session } = useSession();
    const [amount, setAmount] = useState<number>(defaultAmount);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const realtimeCredits = useRealtimeStore(s => s.userCredits);
    const subscribeToUserCreditsBy = useRealtimeStore(s => s.subscribeToUserCreditsBy);

    useEffect(() => {
        if (session?.user?.id || session?.user?.email) {
            console.log('[PurchaseCreditsCard] Subscribing to user credits', { userId: session?.user?.id, email: session?.user?.email });
            subscribeToUserCreditsBy({ userId: session?.user?.id, email: session?.user?.email || undefined });
        } else {
            console.log('[PurchaseCreditsCard] No session user id for credits subscription');
        }
    }, [session?.user?.id, session?.user?.email, subscribeToUserCreditsBy]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (Number.isNaN(value)) return;
        setAmount(Math.max(10, Math.floor(value)));
    };

    const handleBuy = async () => {
        if (!session?.user?.email || !session?.user?.name) {
            toast.error("Ação necessária", {
                description: "Você precisa estar logado para comprar créditos.",
            });
            return;
        }
        setLoading(true);
        setError(null);

        try {
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
                toast.success("Redirecionando para o pagamento...", {
                    description: "Você será levado para a página de checkout.",
                });
                window.location.href = data.checkoutUrl;
            }
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : "Ocorreu um erro desconhecido";

            toast.error("Falha ao iniciar pagamento", { description: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                            <LuCoins className="h-6 w-6 text-yellow-400 dark:text-yellow-300" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Comprar Créditos</CardTitle>
                            <CardDescription>
                                <span className="text-sm font-semibold text-foreground">Saldo atual: {(session?.user?.id ? realtimeCredits : currentCredits).toLocaleString("pt-BR")} créditos</span>
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3">
                        <label htmlFor="valor" className="text-sm font-medium text-foreground">
                            Valor (R$)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <input
                                id="valor"
                                type="number"
                                min={10}
                                max={50000}
                                step={1}
                                value={amount}
                                onChange={handleChange}
                                className="flex h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-describedby="valor-help"
                            />
                        </div>
                        <p id="valor-help" className="text-xs text-muted-foreground">
                            Você receberá <span className="font-medium">{amount.toLocaleString("pt-BR")} créditos</span>
                        </p>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    {!session && <p className="text-xs text-center mt-2 text-muted-foreground">Faça login para poder comprar.</p>}
                </CardContent>
                <CardFooter>
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


