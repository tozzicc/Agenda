export function requireEnvironmentVariables(env, names) {
    const missing = names.filter((name) => typeof env[name] !== 'string' || env[name].trim() === '');
    if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente obrigatórias não configuradas: ${missing.join(', ')}`);
    }
}
