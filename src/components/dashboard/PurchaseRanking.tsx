"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

type TopBuyer = {
    userId: string | null;
    name: string | null;
    email: string | null;
    count: number;
};

type PurchaseRankingProps = {
    topBuyers: TopBuyer[];
    loading?: boolean;
};

export default function PurchaseRanking({ topBuyers, loading }: PurchaseRankingProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Compradores de Leads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="divide-y">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <li key={`skeleton-${i}`} className="py-3">
                                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Compradores de Leads
                </CardTitle>
            </CardHeader>
            <CardContent>
                {topBuyers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhum dado disponível</p>
                ) : (
                    <ul className="divide-y">
                        {topBuyers.map((buyer, index) => (
                            <li key={buyer.userId || index} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-sm font-semibold text-yellow-700">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm truncate max-w-[200px]">
                                        {buyer.name || buyer.email || 'Usuário'}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold">{buyer.count} leads</span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
