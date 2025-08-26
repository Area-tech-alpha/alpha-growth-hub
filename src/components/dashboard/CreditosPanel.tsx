"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LuCoins } from "react-icons/lu";

type CreditosPanelProps = {
    currentCredits?: number;
    defaultAmount?: number;
    onBuy?: (amount: number) => void;
};

export default function CreditosPanel({
    currentCredits = 0,
    defaultAmount = 50,
    onBuy,
}: CreditosPanelProps) {
    const [amount, setAmount] = React.useState<number>(defaultAmount);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (Number.isNaN(value)) return;
        setAmount(Math.max(1, Math.floor(value)));
    };

    const handleBuy = () => {
        onBuy?.(amount);
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
                                <span className="text-sm font-semibold text-foreground">Saldo atual: {currentCredits.toLocaleString("pt-BR")} créditos</span>
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
                                min={1}
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
                        <p className="text-xs text-muted-foreground">R$ 1,00 = 1 crédito</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleBuy} className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950">
                        Comprar créditos
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


