"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

type TopInvestor = {
    userId: string | null;
    name: string | null;
    email: string | null;
    totalInvested: number;
};

type InvestmentRankingProps = {
    topInvestors: TopInvestor[];
    loading?: boolean;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export default function InvestmentRanking({ topInvestors, loading }: InvestmentRankingProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        Top Investidores em Leads
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
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Top Investidores em Leads
                </CardTitle>
            </CardHeader>
            <CardContent>
                {topInvestors.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhum dado disponível</p>
                ) : (
                    <ul className="divide-y">
                        {topInvestors.map((investor, index) => (
                            <li key={investor.userId || index} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm truncate max-w-[200px]">
                                        {investor.name || investor.email || 'Usuário'}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-green-700">
                                    {formatCurrency(investor.totalInvested)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
