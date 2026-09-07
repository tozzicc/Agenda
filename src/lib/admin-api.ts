export interface Professional {
    id: number;
    name: string;
    specialty: string | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Service {
    id: number;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ProfessionalInput {
    name: string;
    specialty: string;
    active: boolean;
}

export interface ServiceInput {
    name: string;
    description: string;
    durationMinutes: number;
    price: string;
    active: boolean;
}

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const response = await fetch(path, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof data.error === 'string' ? data.error : 'Não foi possível concluir a operação.';
        throw new Error(message);
    }
    return data as T;
}
