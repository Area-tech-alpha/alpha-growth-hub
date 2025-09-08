"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, History as LuHistory } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRealtimeStore } from "@/store/realtime-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Purchase = {
    id: string | number;
    created_at: string;
    amount_credits?: number;
    credits_purchased?: number;
    amount_paid?: number | string;
    status?: "completed" | "pending" | "failed";
};

type PurchaseHistoryPanelProps = {
    targetHeight?: number;
};

export default function PurchaseHistoryPanel({ targetHeight }: PurchaseHistoryPanelProps) {
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();
    const purchases = useRealtimeStore((s) => s.userPurchases as Purchase[]);
    const fetchLatestUserPurchases = useRealtimeStore((s) => s.fetchLatestUserPurchases);
    const subscribeToUserPurchases = useRealtimeStore((s) => s.subscribeToUserPurchases);
    const unsubscribeFromUserPurchases = useRealtimeStore((s) => s.unsubscribeFromUserPurchases);

    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;
        let cancelled = false;
        (async () => {
            await fetchLatestUserPurchases({ userId, limit: 20 });
            if (!cancelled) setLoading(false);
        })();
        subscribeToUserPurchases({ userId });
        return () => {
            cancelled = true;
            unsubscribeFromUserPurchases();
        };
    }, [session?.user?.id, fetchLatestUserPurchases, subscribeToUserPurchases, unsubscribeFromUserPurchases]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    const cardStyle: React.CSSProperties = targetHeight
        ? { height: `${targetHeight}px`, visibility: 'visible' }
        : { visibility: 'hidden' };

    return (
        <Card style={cardStyle} className="flex flex-col lg:min-h-[430px]">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border bg-muted">
                        <LuHistory className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                        <CardTitle>Histórico de Compras</CardTitle>
                        <CardDescription>As suas últimas transações de créditos</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : purchases.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhuma compra realizada ainda.
                    </p>
                ) : (
                    <ul className="h-full space-y-3 overflow-y-auto pr-3">
                        {purchases.map((purchase) => (
                            <li
                                key={purchase.id}
                                className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                                    <div>
                                        <p className="font-semibold text-foreground">
                                            {(
                                                purchase.amount_credits ??
                                                purchase.credits_purchased ??
                                                0
                                            ).toLocaleString("pt-BR")} {""}
                                            créditos
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDate(purchase.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="pl-2 text-right font-medium text-foreground">
                                    R$ {(
                                        typeof purchase.amount_paid === 'string'
                                            ? parseFloat(purchase.amount_paid)
                                            : (purchase.amount_paid ?? 0)
                                    ).toLocaleString("pt-BR")}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}