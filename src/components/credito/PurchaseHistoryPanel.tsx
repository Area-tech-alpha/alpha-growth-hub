"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, History as LuHistory } from "lucide-react";

type Purchase = {
    id: string | number;
    created_at: string;
    amount_credits?: number;
    credits_purchased?: number;
    amount_paid?: number;
    status?: "completed" | "pending" | "failed";
};

type RealtimeStoreState = {
    userPurchases: Purchase[];
};

const useRealtimeStore = (
    selector: (state: RealtimeStoreState) => Purchase[]
) => {
    const mockState: RealtimeStoreState = {
        userPurchases: [
            { id: 1, created_at: "2023-10-27T10:00:00Z", credits_purchased: 150, amount_paid: 150, status: "completed" },
            { id: 2, created_at: "2023-10-25T14:30:00Z", credits_purchased: 50, amount_paid: 50, status: "completed" },
            { id: 3, created_at: "2023-10-22T09:15:00Z", credits_purchased: 100, amount_paid: 100, status: "completed" },
            { id: 4, created_at: "2023-10-20T18:00:00Z", credits_purchased: 200, amount_paid: 200, status: "completed" },
            { id: 5, created_at: "2023-10-18T11:45:00Z", credits_purchased: 75, amount_paid: 75, status: "completed" },
            { id: 6, created_at: "2023-10-15T20:00:00Z", credits_purchased: 120, amount_paid: 120, status: "completed" },
        ],
    };
    return selector(mockState);
};

// Componentes locais para corresponder à sua estrutura original
const Card = ({ children, className, style }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) => (
    <div className={`mx-auto w-full max-w-2xl rounded-xl border bg-[#1a1a1a] text-white shadow-lg ${className}`} style={style}>
        {children}
    </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="p-6">{children}</div>
);

const CardTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xl font-bold text-white">{children}</h2>
);

const CardDescription = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-gray-400">{children}</p>
);

const CardContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-gray-700 ${className}`} />
);

type PurchaseHistoryPanelProps = {
    targetHeight?: number;
};

export default function PurchaseHistoryPanel({ targetHeight }: PurchaseHistoryPanelProps) {
    const [loading, setLoading] = useState(true);
    const purchases = useRealtimeStore((s) => s.userPurchases);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (Array.isArray(purchases)) {
                setLoading(false);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [purchases]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    const cardStyle: React.CSSProperties = targetHeight 
        ? { height: `${targetHeight}px`, visibility: 'visible' }
        : { visibility: 'hidden' }; // Esconde o card até a altura ser definida para evitar "pulo"

    return (
        <Card style={cardStyle} className="flex flex-col">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-yellow-80 bg-yellow-900/20">
                        <LuHistory className="h-6 w-6 text-yellow-400 dark:text-yellow-300" />
                    </div>
                    <div>
                        <CardTitle>Histórico de Compras</CardTitle>
                        <CardDescription>
                            As suas últimas transações de créditos
                        </CardDescription>
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
                    <p className="py-4 text-center text-sm text-gray-400">
                        Nenhuma compra realizada ainda.
                    </p>
                ) : (
                    <ul className="h-full space-y-3 overflow-y-auto pr-3">
                        {purchases.map((purchase) => (
                            <li
                                key={purchase.id}
                               className="flex items-center justify-between text-sm p-3 rounded-lg bg-yellow-900/30 hover:bg-yellow-900/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                                    <div>
                                        <p className="font-semibold text-white">
                                            {(
                                                purchase.amount_credits ??
                                                purchase.credits_purchased ??
                                                0
                                            ).toLocaleString("pt-BR")}{" "}
                                            créditos
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {formatDate(purchase.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="pl-2 text-right font-medium text-white">
                                    R$ {(purchase.amount_paid ?? 0).toLocaleString("pt-BR")}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}