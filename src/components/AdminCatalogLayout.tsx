import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, CalendarDays, Settings, Stethoscope } from 'lucide-react';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const links = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { to: '/my-bookings', label: 'Agenda', icon: CalendarDays },
    { to: '/admin/professionals', label: 'Profissionais', icon: Stethoscope },
    { to: '/admin/services', label: 'Serviços', icon: BriefcaseBusiness },
    { to: '/admin/settings', label: 'Configurações', icon: Settings },
];

export function AdminCatalogLayout({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
    const { user } = useAuth();
    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
                    <h1 className="text-xl font-bold text-gray-900">Acesso restrito</h1>
                    <p className="mt-2 text-gray-500">Esta área está disponível somente para administradores.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <Navbar />
            <nav className="border-b border-gray-200 bg-white" aria-label="Navegação administrativa">
                <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-8">
                    {links.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors', isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-indigo-600')}>
                            <Icon className="h-4 w-4" />{label}
                        </NavLink>
                    ))}
                </div>
            </nav>
            <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
                <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-gray-500">{subtitle}</p></div>
                    {action}
                </div>
                {children}
            </main>
        </div>
    );
}
