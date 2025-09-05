"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

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
    availableLocations = [],
}: {
    value: RevenueFilterValue;
    onChange: (next: RevenueFilterValue) => void;
    availableLocations?: string[];
}) {
    const [minStr, setMinStr] = useState("");
    const [maxStr, setMaxStr] = useState("");
    const [locStr, setLocStr] = useState(value.locationQuery ?? "");

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

    const containerCls = useMemo(
        () =>
            "w-full bg-card text-card-foreground border border-border rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-center gap-3",
        []
    );

    const normalize = (s: string) => s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    // Map canonical labels and their normalized values
    const locationOptions = useMemo(() => {
        const set = new Set<string>();
        availableLocations.forEach((loc) => {
            const trimmed = String(loc || '').trim();
            if (trimmed) set.add(trimmed);
        });
        const list = Array.from(set.values());
        return list.map(label => ({ label, value: normalize(label) }));
    }, [availableLocations]);

    // Sync external value to local input
    useEffect(() => {
        setLocStr(value.locationQuery ?? "");
    }, [value.locationQuery]);

    const onLocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocStr(raw);
        onChange({ ...value, locationQuery: raw });
    };

    const onLocBlur = () => {
        const norm = normalize(locStr);
        const match = locationOptions.find(opt => opt.value === norm);
        if (match) {
            setLocStr(match.label);
            onChange({ ...value, locationQuery: match.label });
        }
    };

    // Filter dropdown options accent-insensitively by current input
    const filteredOptions = useMemo(() => {
        const q = normalize(locStr);
        if (!q) return locationOptions;
        return locationOptions.filter(opt => opt.value.startsWith(q));
    }, [locStr, locationOptions]);

    return (
        <div className={containerCls}>
            <div className="flex items-center gap-2">
                <label htmlFor="rev-min" className="text-sm text-muted-foreground whitespace-nowrap">
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
            <div className="flex items-center gap-2">
                <label htmlFor="rev-max" className="text-sm text-muted-foreground whitespace-nowrap">
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
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
                <label htmlFor="rev-sort" className="text-sm text-muted-foreground whitespace-nowrap">
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
            {/* Localidade */}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                <label htmlFor="rev-loc" className="text-sm text-muted-foreground whitespace-nowrap">
                    Localidade
                </label>
                <Input
                    id="rev-loc"
                    type="text"
                    placeholder="Pesquisar localização"
                    value={locStr}
                    onChange={onLocChange}
                    onBlur={onLocBlur}
                    list="locations-datalist"
                    aria-label="Pesquisar localidade"
                    className="bg-background text-foreground"
                />
                <datalist id="locations-datalist">
                    {filteredOptions.map((opt) => (
                        <option value={opt.label} key={opt.label} />
                    ))}
                </datalist>
            </div>
        </div>
    );
}


