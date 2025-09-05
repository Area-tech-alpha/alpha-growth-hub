"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { BRAZIL_STATES } from "@/lib/br-states";

export type RevenueSort = "none" | "asc" | "desc";

export interface RevenueFilterValue {
    min?: number;
    max?: number;
    sort: RevenueSort;
    locationQuery?: string;
}

function formatBRLCompact(n?: number) {
    const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(v);
}

function parseDigitsToNumber(value: string): number | undefined {
    const digits = value.replace(/\D/g, "");
    if (!digits) return undefined;
    return Number(digits);
}

export default function RevenueFilterSort({
    value,
    onChange,
    availableStateUFs,
    includePaidSort,
    paidSort,
    onPaidSortChange,
}: {
    value: RevenueFilterValue;
    onChange: (next: RevenueFilterValue) => void;
    availableStateUFs: string[];
    includePaidSort?: boolean;
    paidSort?: "none" | "asc" | "desc";
    onPaidSortChange?: (next: "none" | "asc" | "desc") => void;
}) {
    const [minStr, setMinStr] = useState("");
    const [maxStr, setMaxStr] = useState("");

    useEffect(() => {
        setMinStr(value.min != null ? formatBRLCompact(value.min) : "");
    }, [value.min]);
    useEffect(() => {
        setMaxStr(value.max != null ? formatBRLCompact(value.max) : "");
    }, [value.max]);

    const onMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const n = parseDigitsToNumber(raw);
        setMinStr(raw);
        onChange({ ...value, min: n });
    };
    const onMinBlur = () => {
        setMinStr(value.min != null ? formatBRLCompact(value.min) : "");
    };

    const onMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const n = parseDigitsToNumber(raw);
        setMaxStr(raw);
        onChange({ ...value, max: n });
    };
    const onMaxBlur = () => {
        setMaxStr(value.max != null ? formatBRLCompact(value.max) : "");
    };

    const handleSort = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const s = e.target.value as RevenueSort;
        onChange({ ...value, sort: s });
    };

    const containerCls = useMemo(() => {
        const lgCols = includePaidSort ? "lg:grid-cols-6" : "lg:grid-cols-5";
        return `w-full bg-card text-card-foreground border border-border rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 ${lgCols} items-center gap-3`;
    }, [includePaidSort]);

    // Keeping UI simple: dropdown only, no need to normalize here

    // Build options from static states list, filtered to only available states
    const stateOptions = useMemo(() => {
        const allowed = new Set((availableStateUFs || []).map(s => s.toUpperCase()));
        return BRAZIL_STATES
            .filter(s => allowed.has(s.uf))
            .map(s => ({
                uf: s.uf,
                label: `${s.name} - ${s.uf}`,
            }));
    }, [availableStateUFs]);

    const selectedUF = (value.locationQuery || "").toString().toUpperCase();
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextUF = e.target.value;
        onChange({ ...value, locationQuery: nextUF });
    };
    const clearSelection = () => {
        onChange({ ...value, locationQuery: "" });
    };

    return (
        <div className={containerCls}>
            <div className="flex items-center gap-2 lg:flex-col lg:items-start">
                <label htmlFor="rev-min" className="text-sm text-muted-foreground whitespace-nowrap lg:mb-1">
                    Faturamento mín.
                </label>
                <Input
                    id="rev-min"
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0"
                    value={minStr}
                    onChange={onMinChange}
                    onBlur={onMinBlur}
                    aria-label="Faturamento mínimo"
                    className="bg-background text-foreground"
                />
            </div>
            <div className="flex items-center gap-2 lg:flex-col lg:items-start">
                <label htmlFor="rev-max" className="text-sm text-muted-foreground whitespace-nowrap lg:mb-1">
                    Faturamento máx.
                </label>
                <Input
                    id="rev-max"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ilimitado"
                    value={maxStr}
                    onChange={onMaxChange}
                    onBlur={onMaxBlur}
                    aria-label="Faturamento máximo"
                    className="bg-background text-foreground"
                />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-start">
                <label htmlFor="rev-sort" className="text-sm text-muted-foreground whitespace-nowrap lg:mb-1">
                    Ordenar por
                </label>
                <select
                    id="rev-sort"
                    className="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground px-2 py-1 text-sm"
                    value={value.sort}
                    onChange={handleSort}
                    aria-label="Ordenar por"
                >
                    <option value="none">Padrão</option>
                    <option value="asc">Faturamento ↑</option>
                    <option value="desc">Faturamento ↓</option>
                </select>
            </div>
            {/* Localidade - dropdown only with clear (X inside field) */}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2 lg:flex-col lg:items-start">
                <label htmlFor="rev-loc-select" className="text-sm text-muted-foreground whitespace-nowrap lg:mb-1">
                    Localidade
                </label>
                <div className="relative w-full">
                    <select
                        id="rev-loc-select"
                        className="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground pl-2 pr-14 py-1 text-sm"
                        value={selectedUF}
                        onChange={handleSelectChange}
                        aria-label="Selecionar localidade"
                    >
                        <option value="">Todos os estados</option>
                        {stateOptions.map((opt) => (
                            <option value={opt.uf} key={opt.uf}>{opt.label}</option>
                        ))}
                    </select>
                    {selectedUF !== "" && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            aria-label="Limpar localidade"
                            className="absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                            title="Limpar"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
            {includePaidSort && (
                <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-start">
                    <label htmlFor="paid-sort" className="text-sm text-muted-foreground whitespace-nowrap lg:mb-1">Ordenar (valor pago)</label>
                    <select
                        id="paid-sort"
                        className="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground px-2 py-1 text-sm"
                        value={paidSort || "none"}
                        onChange={(e) => onPaidSortChange?.(e.target.value as "none" | "asc" | "desc")}
                        aria-label="Ordenar por valor pago"
                    >
                        <option value="none">Padrão</option>
                        <option value="asc">Valor pago ↑</option>
                        <option value="desc">Valor pago ↓</option>
                    </select>
                </div>
            )}
        </div>
    );
}


