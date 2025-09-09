export type RevenueBand = {
    label: string;
    min: number; // inclusive
    max: number; // inclusive (use Infinity for open upper bound)
};

export const REVENUE_BANDS: RevenueBand[] = [
    { label: 'Até 20 mil', min: 0, max: 20_000 },
    { label: 'De 20 mil até 40 mil', min: 20_000, max: 40_000 },
    { label: 'De 40 mil até 60 mil', min: 40_000, max: 60_000 },
    { label: 'De 60 mil até 80 mil', min: 60_000, max: 80_000 },
    { label: 'De 80 mil até 100 mil', min: 80_000, max: 100_000 },
    { label: 'De 100 mil até 150 mil', min: 100_000, max: 150_000 },
    { label: 'De 150 mil até 250 mil', min: 150_000, max: 250_000 },
    { label: 'De 250 mil até 400 mil', min: 250_000, max: 400_000 },
    { label: 'De 400 mil até 600 mil', min: 400_000, max: 600_000 },
    { label: 'De 600 mil até 1 milhão', min: 600_000, max: 1_000_000 },
    { label: 'Mais de 1 milhão', min: 1_000_000, max: Infinity },
];

const labelToBand = new Map<string, RevenueBand>(REVENUE_BANDS.map(b => [b.label, b]));

export function getRevenueBandByLabel(label: string | null | undefined): RevenueBand | undefined {
    if (!label) return undefined;
    return labelToBand.get(String(label));
}

export function getBandIndex(label: string | null | undefined): number {
    const band = getRevenueBandByLabel(label);
    if (!band) return -1;
    return REVENUE_BANDS.findIndex(b => b.label === band.label);
}

export function compareBands(aLabel: string, bLabel: string): number {
    const ai = getBandIndex(aLabel);
    const bi = getBandIndex(bLabel);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
}

export function bandOverlapsRange(label: string, min?: number | null, max?: number | null): boolean {
    const band = getRevenueBandByLabel(label);
    if (!band) return false;
    const hasMin = typeof min === 'number' && Number.isFinite(min);
    const hasMax = typeof max === 'number' && Number.isFinite(max);
    if (!hasMin && !hasMax) return true;
    if (hasMin && !hasMax) return band.max >= (min as number);
    if (!hasMin && hasMax) return band.min <= (max as number);
    return band.max >= (min as number) && band.min <= (max as number);
}


