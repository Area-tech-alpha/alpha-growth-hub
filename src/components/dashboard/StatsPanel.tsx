"use client";

import { useEffect, useState } from "react";
import PurchaseRanking from "./PurchaseRanking";
import InvestmentRanking from "./InvestmentRanking";
import ConversionRate from "./ConversionRate";

type TopBuyer = {
    userId: string | null;
    name: string | null;
    email: string | null;
    count: number;
};

type TopInvestor = {
    userId: string | null;
    name: string | null;
    email: string | null;
    totalInvested: number;
};

type ConversionData = {
    totalLeads: number;
    soldLeads: number;
    conversionRate: number;
};

type StatsData = {
    topBuyers: TopBuyer[];
    topInvestors: TopInvestor[];
    conversion: ConversionData;
};

export default function StatsPanel() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch("/api/user/stats", { cache: "no-store" });

                if (!response.ok) {
                    throw new Error("Erro ao carregar estatísticas");
                }

                const data = await response.json();
                setStats(data);
            } catch (err) {
                console.error("Error fetching stats:", err);
                setError("Não foi possível carregar as estatísticas");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (error) {
        return (
            <div className="space-y-4">
                <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">Estatísticas do Marketplace</h2>
                <p className="text-muted-foreground">
                    Veja o desempenho geral do marketplace de leads
                </p>
            </div>

            {/* Conversion Rate - Full width */}
            <div className="w-full">
                <ConversionRate
                    conversion={
                        stats?.conversion || {
                            totalLeads: 0,
                            soldLeads: 0,
                            conversionRate: 0,
                        }
                    }
                    loading={loading}
                />
            </div>

            {/* Rankings - Side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PurchaseRanking
                    topBuyers={stats?.topBuyers || []}
                    loading={loading}
                />
                <InvestmentRanking
                    topInvestors={stats?.topInvestors || []}
                    loading={loading}
                />
            </div>
        </div>
    );
}
