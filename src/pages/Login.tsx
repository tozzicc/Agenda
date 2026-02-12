import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Navbar />

            <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h1>
                        <p className="text-gray-500">Entre na sua conta para gerenciar agendamentos</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                id="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
                                <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Esqueceu a senha?</a>
                            </div>
                            <input
                                type="password"
                                id="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-2.5 px-4 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-6"
                        >
                            Entrar
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        Não tem uma conta?{' '}
                        <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
                            Cadastre-se
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
