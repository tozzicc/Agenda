import { Link, useNavigate } from 'react-router-dom';
import { Calendar, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <header className="w-full py-4 px-4 sm:px-8 border-b border-gray-100 bg-white flex items-center justify-between sticky top-0 z-50">
            <Link to="/" className="flex items-center gap-2 text-indigo-600 font-semibold text-lg hover:opacity-80 transition-opacity">
                <Calendar className="w-6 h-6" />
                <span>Agenda</span>
            </Link>
            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-4">
                        {user.role === 'admin' && (
                            <Link to="/my-bookings" className="flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-900 transition-colors bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg border border-amber-200">
                                <UserCircle className="w-4 h-4" />
                                <span>Painel Admin</span>
                            </Link>
                        )}
                        <Link to="/my-bookings" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 hidden sm:block">
                            {user.role === 'admin' ? 'Todos os Agendamentos' : 'Meus Agendamentos'}
                        </Link>
                        <span className="text-sm font-medium text-gray-700">
                            Olá, <span className="text-indigo-600 capitalize">{user.name}</span>
                        </span>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-50"
                            title="Sair"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <Link
                        to="/login"
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-50 bg-transparent border border-transparent hover:border-gray-200"
                    >
                        <UserCircle className="w-5 h-5" />
                        <span>Entrar</span>
                    </Link>
                )}
            </div>
        </header>
    );
}
