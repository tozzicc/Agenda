export function formatBRL(value: string | number): string {
    const normalized = typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : value;
    if (typeof normalized !== 'number' || !Number.isFinite(normalized) || normalized < 0) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(normalized);
}
