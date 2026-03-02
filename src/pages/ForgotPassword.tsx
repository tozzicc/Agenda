import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                setSuccess(true);
            } else {
                const data = await response.json();
                setError(data.error || 'Erro ao processar solicitação');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Navbar />

            <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
                    <div className="mb-8">
                        <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 text-sm mb-6">
                            <ArrowLeft className="w-4 h-4" /> Voltar para o login
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Esqueceu a senha?</h1>
                        <p className="text-gray-500 text-sm">Digite seu e-mail e enviaremos instruções para redefinir sua senha.</p>
                    </div>

                    {success ? (
                        <div className="text-center space-y-4 animate-in fade-in duration-500">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">E-mail enviado!</h2>
                            <p className="text-gray-600">
                                Se houver uma conta associada a <strong>{email}</strong>, você receberá um link de recuperação em breve.
                            </p>
                            <p className="text-xs text-gray-400 italic pt-4">
                                * Verifique também sua caixa de spam.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <div className="relative">
                                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        id="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-6 flex items-center justify-center gap-2"
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
