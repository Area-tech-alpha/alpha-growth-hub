export type BrazilState = { name: string; uf: string };

export const BRAZIL_STATES: BrazilState[] = [
    { name: 'Acre', uf: 'AC' },
    { name: 'Alagoas', uf: 'AL' },
    { name: 'Amapá', uf: 'AP' },
    { name: 'Amazonas', uf: 'AM' },
    { name: 'Bahia', uf: 'BA' },
    { name: 'Ceará', uf: 'CE' },
    { name: 'Distrito Federal', uf: 'DF' },
    { name: 'Espírito Santo', uf: 'ES' },
    { name: 'Goiás', uf: 'GO' },
    { name: 'Maranhão', uf: 'MA' },
    { name: 'Mato Grosso', uf: 'MT' },
    { name: 'Mato Grosso do Sul', uf: 'MS' },
    { name: 'Minas Gerais', uf: 'MG' },
    { name: 'Pará', uf: 'PA' },
    { name: 'Paraíba', uf: 'PB' },
    { name: 'Paraná', uf: 'PR' },
    { name: 'Pernambuco', uf: 'PE' },
    { name: 'Piauí', uf: 'PI' },
    { name: 'Rio de Janeiro', uf: 'RJ' },
    { name: 'Rio Grande do Norte', uf: 'RN' },
    { name: 'Rio Grande do Sul', uf: 'RS' },
    { name: 'Rondônia', uf: 'RO' },
    { name: 'Roraima', uf: 'RR' },
    { name: 'Santa Catarina', uf: 'SC' },
    { name: 'São Paulo', uf: 'SP' },
    { name: 'Sergipe', uf: 'SE' },
    { name: 'Tocantins', uf: 'TO' },
];

// Helpers to normalize between full state name and UF (sigla)
const UF_SET = new Set(BRAZIL_STATES.map((s) => s.uf.toUpperCase()));

function normalizeDiacritics(input: string): string {
    return String(input || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

/**
 * Given a value that may be a UF (e.g., "SP") or a full state name (e.g., "São Paulo"),
 * returns the corresponding UF in uppercase, or undefined if not recognized.
 */
export function stateToUf(value: string | undefined | null): string | undefined {
    if (!value) return undefined;
    const trimmed = String(value).trim();
    const upper = trimmed.toUpperCase();
    if (UF_SET.has(upper)) return upper;
    const norm = normalizeDiacritics(trimmed);
    const match = BRAZIL_STATES.find((s) => normalizeDiacritics(s.name) === norm);
    return match?.uf;
}

/**
 * Returns the full state name for a given UF, or undefined if not found.
 */
export function ufToStateName(uf: string | undefined | null): string | undefined {
    if (!uf) return undefined;
    const upper = String(uf).toUpperCase();
    return BRAZIL_STATES.find((s) => s.uf === upper)?.name;
}