"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

type ConversionData = {
    totalLeads: number;
    soldLeads: number;
    conversionRate: number;
};

type ConversionRateProps = {
    conversion: ConversionData;
    loading?: boolean;
};

export default function ConversionRate({ conversion, loading }: ConversionRateProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-yellow-500" />
                        Taxa de Conversão
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-24 bg-muted animate-pulse rounded" />
                </CardContent>
            </Card>
        );
    }

    const percentage = conversion.conversionRate || 0;
    const unsoldLeads = conversion.totalLeads - conversion.soldLeads;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                    Taxa de Conversão de Leads
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Percentage display */}
                <div className="text-center">
                    <div className="text-5xl font-bold text-yellow-600">
                        {percentage.toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        dos leads foram comprados
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-500 transition-all duration-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Stats breakdown */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center">
                        <p className="text-xs uppercase text-muted-foreground">Comprados</p>
                        <p className="text-2xl font-bold text-green-600">{conversion.soldLeads}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs uppercase text-muted-foreground">Não Comprados</p>
                        <p className="text-2xl font-bold text-gray-600">{unsoldLeads}</p>
                    </div>
                </div>

                {/* Total */}
                <div className="text-center border-t pt-3">
                    <p className="text-xs uppercase text-muted-foreground">Total de Leads</p>
                    <p className="text-xl font-semibold">{conversion.totalLeads}</p>
                </div>
            </CardContent>
        </Card>
    );
}
