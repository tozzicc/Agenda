import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();

                if (!response.ok) {
                    const detailedError = data.message ? `${data.error}: ${data.message}` : data.error;
                    throw new Error(detailedError || 'Falha no login');
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
            } else {
                // If not JSON, it might be a server error text or HTML
                const text = await response.text();
                console.error("Received non-JSON response:", text);
                throw new Error(`Erro no servidor: ${response.status} ${response.statusText}. Resposta: ${text.substring(0, 100)}`);
            }
        } catch (error: any) {
            console.error("Login error:", error);
            throw new Error(error.message || 'Erro ao conectar com o servidor');
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();

                if (!response.ok) {
                    const detailedError = data.message ? `${data.error}: ${data.message}` : data.error;
                    throw new Error(detailedError || 'Falha no cadastro');
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
            } else {
                const text = await response.text();
                console.error("Received non-JSON response:", text);
                throw new Error(`Erro no servidor: ${response.status} ${response.statusText}. Resposta: ${text.substring(0, 100)}`);
            }
        } catch (error: any) {
            console.error("Register error:", error);
            throw new Error(error.message || 'Erro ao conectar com o servidor');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
