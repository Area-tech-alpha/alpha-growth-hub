export type MarketingBand = {
    label: string;
    min: number; // inclusive
    max: number; // inclusive (Infinity when open upper bound)
};

export const MARKETING_BANDS: MarketingBand[] = [
    { label: '0 a 600 reais por mês', min: 0, max: 600 },
    { label: '601 a 1200 por mês', min: 601, max: 1200 },
    { label: '1.201 a 2.500 por mês', min: 1201, max: 2500 },
    { label: '2.500 a 4.000 por mês', min: 2500, max: 4000 },
    { label: '4.001 a 10.000 por mês', min: 4001, max: 10000 },
    { label: 'Mais de 10 mil por mês', min: 10000, max: Infinity },
];

const labelToBand = new Map<string, MarketingBand>(MARKETING_BANDS.map(b => [b.label, b]));

export function getMarketingBandByLabel(label: string | null | undefined): MarketingBand | undefined {
    if (!label) return undefined;
    return labelToBand.get(String(label));
}

export function getMarketingBandIndex(label: string | null | undefined): number {
    const band = getMarketingBandByLabel(label);
    if (!band) return -1;
    return MARKETING_BANDS.findIndex(b => b.label === band.label);
}

export function compareMarketingBands(aLabel: string, bLabel: string): number {
    const ai = getMarketingBandIndex(aLabel);
    const bi = getMarketingBandIndex(bLabel);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
}

export function marketingBandOverlapsRange(label: string, min?: number | null, max?: number | null): boolean {
    const band = getMarketingBandByLabel(label);
    if (!band) return false;
    const hasMin = typeof min === 'number' && Number.isFinite(min);
    const hasMax = typeof max === 'number' && Number.isFinite(max);
    if (!hasMin && !hasMax) return true;
    if (hasMin && !hasMax) return band.max >= (min as number);
    if (!hasMin && hasMax) return band.min <= (max as number);
    return band.max >= (min as number) && band.min <= (max as number);
}


