export function parsePositiveId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeOptionalText(value, maxLength, field) {
    if (value === undefined || value === null || value === '') return { value: null };
    if (typeof value !== 'string') return { error: `${field} deve ser texto` };
    const normalized = value.trim();
    if (normalized.length > maxLength) return { error: `${field} deve ter no máximo ${maxLength} caracteres` };
    return { value: normalized || null };
}

function normalizeName(value) {
    if (typeof value !== 'string' || !value.trim()) return { error: 'Nome é obrigatório' };
    const name = value.trim();
    if (name.length > 120) return { error: 'Nome deve ter no máximo 120 caracteres' };
    return { value: name };
}

function normalizeActive(value, defaultValue = true) {
    if (value === undefined) return { value: defaultValue };
    if (typeof value !== 'boolean') return { error: 'Status ativo deve ser booleano' };
    return { value };
}

export function validateProfessional(input = {}) {
    const name = normalizeName(input.name);
    if (name.error) return { error: name.error };
    const specialty = normalizeOptionalText(input.specialty, 300, 'Especialidade');
    if (specialty.error) return { error: specialty.error };
    const active = normalizeActive(input.active);
    if (active.error) return { error: active.error };
    return { value: { name: name.value, specialty: specialty.value, active: active.value } };
}

export function validateService(input = {}) {
    const name = normalizeName(input.name);
    if (name.error) return { error: name.error };
    const description = normalizeOptionalText(input.description, 500, 'Descrição');
    if (description.error) return { error: description.error };
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes > 1440) {
        return { error: 'Duração deve ser um número inteiro entre 1 e 1440 minutos' };
    }
    const priceText = typeof input.price === 'number' || typeof input.price === 'string' ? String(input.price) : '';
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(priceText)) return { error: 'Preço deve ser um valor entre 0,00 e 9.999.999.999,99, com no máximo duas casas decimais' };
    const price = `${priceText.split('.')[0]}.${(priceText.split('.')[1] || '').padEnd(2, '0')}`;
    const active = normalizeActive(input.active);
    if (active.error) return { error: active.error };
    return { value: { name: name.value, description: description.value, durationMinutes: input.durationMinutes, price, active: active.value } };
}

export function validateActiveStatus(input = {}) {
    if (typeof input.active !== 'boolean') return { error: 'Status ativo deve ser booleano' };
    return { value: input.active };
}
