"use client";

import { useCallback, useEffect, useState } from "react";
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
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [monthOptions, setMonthOptions] = useState<string[]>([]);

    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const response = await fetch("/api/user/available-months");
                if (response.ok) {
                    const data = await response.json();
                    setMonthOptions(data.months || []);
                }
            } catch (err) {
                console.error("Error fetching months:", err);
            }
        };
        fetchMonths();
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const query = selectedMonth ? `?month=${selectedMonth}` : "";
            const response = await fetch(`/api/user/stats${query}`, { cache: "no-store" });

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
    }, [selectedMonth]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatMonthLabel = (yyyyMm: string) => {
        const [yyyy, mm] = yyyyMm.split("-");
        const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const idx = parseInt(mm, 10) - 1;
        return `${monthNames[idx] ?? mm}/${yyyy.slice(2)}`;
    };

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
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Estatísticas do Growth Hub</h2>
                    <p className="text-muted-foreground">
                        Veja o desempenho geral do Growth Hub
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm">Mês</label>
                    <select
                        className="h-9 rounded-md border px-2 text-sm bg-background text-foreground"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        disabled={loading}
                    >
                        <option value="">Geral</option>
                        {monthOptions.map((m) => (
                            <option key={m} value={m}>
                                {formatMonthLabel(m)}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="h-9 px-3 rounded-md border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="Atualizar dados"
                    >
                        ↻
                    </button>
                </div>
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
