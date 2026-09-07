import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, Calendar, LogOut, Settings, Stethoscope, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export function Navbar() {
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const handleLogout = () => { logout(); navigate('/'); };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
                <Link to="/" className="flex min-w-0 items-center gap-2 text-lg font-semibold text-indigo-600 transition-opacity hover:opacity-80">
                    {settings.appLogo ? <img src={settings.appLogo} alt="Logo" className="h-8 w-8 object-contain" /> : <Calendar className="h-6 w-6 shrink-0" />}
                    <span className="truncate">{settings.companyName}</span>
                    {settings.demoMode && user?.role === 'admin' && <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 sm:inline">Modo Demonstração</span>}
                </Link>
                <div className="flex items-center gap-1 sm:gap-2">
                    {user ? (
                        <>
                            {user.role === 'admin' ? (
                                <>
                                    <Link to="/admin/dashboard" title="Dashboard" className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><BarChart3 className="h-5 w-5" /></Link>
                                    <Link to="/my-bookings" title="Agenda" className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><UserCircle className="h-5 w-5" /></Link>
                                    <Link to="/admin/professionals" title="Profissionais" className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><Stethoscope className="h-5 w-5" /></Link>
                                    <Link to="/admin/services" title="Serviços" className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><BriefcaseBusiness className="h-5 w-5" /></Link>
                                    <Link to="/admin/settings" title="Configurações" className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><Settings className="h-5 w-5" /></Link>
                                </>
                            ) : <Link to="/my-bookings" className="hidden rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100 sm:block">Meus Agendamentos</Link>}
                            <span className="hidden text-sm font-medium text-gray-700 lg:block">Olá, <span className="capitalize text-indigo-600">{user.name}</span></span>
                            <button onClick={handleLogout} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-500" title="Sair"><LogOut className="h-5 w-5" /></button>
                        </>
                    ) : <Link to="/login" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600"><UserCircle className="h-5 w-5" /><span>Entrar</span></Link>}
                </div>
            </div>
        </header>
    );
}
