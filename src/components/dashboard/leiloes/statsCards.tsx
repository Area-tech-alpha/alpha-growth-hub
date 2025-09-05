import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, { cloneElement, isValidElement } from "react";

export type StatItem = {
    title: string;
    icon: React.ReactNode;
    contentTitle: string;
    contentDescription: string;
};

export default function StatsCards({ items }: { items: StatItem[] }) {
    const safeItems = Array.isArray(items) ? items : [];
    return (
        <div className="w-full">
            {/* Single compact card on small screens */}
            <Card className="md:hidden">
                <CardHeader className="space-y-2">
                    <CardTitle className="text-sm font-medium">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {safeItems.map((it, idx) => (
                        <div key={`${it.title}-${idx}`} className="flex items-center gap-3">
                            <div className="shrink-0 text-yellow-600">
                                {isValidElement(it.icon)
                                    ? cloneElement(it.icon as React.ReactElement<{ className?: string }>, { className: "h-5 w-5" })
                                    : it.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xl font-bold text-yellow-600 leading-tight">{it.contentTitle}</div>
                                <p className="text-xs text-muted-foreground leading-snug">{it.contentDescription}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Three separate cards on md+ */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
                {safeItems.map((it, idx) => (
                    <Card key={`${it.title}-md-${idx}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{it.title}</CardTitle>
                            {it.icon}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{it.contentTitle}</div>
                            <p className="text-xs text-muted-foreground">{it.contentDescription}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}