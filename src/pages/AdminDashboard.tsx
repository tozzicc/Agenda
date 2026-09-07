import { useEffect, useMemo, useState } from 'react';
import { Activity, BriefcaseBusiness, CalendarCheck, CalendarX, RefreshCw, Stethoscope, Users } from 'lucide-react';
import { AdminCatalogLayout } from '../components/AdminCatalogLayout';
import { adminRequest } from '../lib/admin-api';

interface Item { label: string; count: number }
interface DashboardData {
    period: { start: string; end: string };
    kpis: { appointmentsToday: number; appointmentsInPeriod: number; cancellationsInPeriod: number; clientsInPeriod: number; activeProfessionals: number; activeServices: number; cancellationRate: number };
    appointmentsByDay: Item[];
    appointmentsByProfessional: Item[];
    appointmentsByService: Item[];
    appointmentsByWeekday: Item[];
    appointmentsByTime: Item[];
    topClients: Item[];
    statusDistribution: { status: string; count: number }[];
}

const presets = [{ id: 'today', label: 'Hoje' }, { id: '7d', label: '7 dias' }, { id: '30d', label: '30 dias' }, { id: 'month', label: 'Este mês' }];

function Ranking({ title, subtitle, items }: { title: string; subtitle: string; items: Item[] }) {
    const max = Math.max(1, ...items.map((item) => item.count));
    return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">{title}</h2><p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        <div className="mt-5 space-y-4">{items.slice(0, 10).map((item) => <div key={item.label}>
            <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate text-gray-600">{item.label}</span><strong>{item.count}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(4, item.count / max * 100)}%` }} /></div>
        </div>)}</div>
        {items.length === 0 && <p className="mt-5 text-sm text-gray-400">Sem dados neste período.</p>}
    </section>;
}

export function AdminDashboard() {
    const [preset, setPreset] = useState('30d');
    const [custom, setCustom] = useState({ start: '', end: '' });
    const [query, setQuery] = useState('preset=30d');
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        adminRequest<DashboardData>(`/api/admin/dashboard?${query}`, { signal: controller.signal })
            .then((result) => { setData(result); setError(''); })
            .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [query]);

    const selectPreset = (id: string) => { setPreset(id); setLoading(true); setQuery(`preset=${id}`); };
    const applyCustom = () => { setPreset('custom'); setLoading(true); setQuery(new URLSearchParams(custom).toString()); };
    const refresh = () => { setLoading(true); setQuery((current) => `${current}&refresh=${Date.now()}`); };
    const dateLabel = useMemo(() => data ? `${data.period.start.split('-').reverse().join('/')} — ${data.period.end.split('-').reverse().join('/')}` : '', [data]);
    const kpis = data ? [
        ['Agendamentos hoje', data.kpis.appointmentsToday, CalendarCheck],
        ['No período', data.kpis.appointmentsInPeriod, Activity],
        ['Cancelamentos', data.kpis.cancellationsInPeriod, CalendarX],
        ['Clientes', data.kpis.clientsInPeriod, Users],
        ['Profissionais ativos', data.kpis.activeProfessionals, Stethoscope],
        ['Serviços ativos', data.kpis.activeServices, BriefcaseBusiness],
    ] as const : [];

    return <AdminCatalogLayout title="Dashboard" subtitle="Visão gerencial da operação e da demanda da agenda.">
        <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Período</p><div className="mt-2 flex flex-wrap gap-2">{presets.map((item) => <button key={item.id} onClick={() => selectPreset(item.id)} className={`rounded-lg px-3 py-2 text-sm font-medium ${preset === item.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-indigo-50'}`}>{item.label}</button>)}</div></div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="text-xs font-medium text-gray-500">Data inicial<input type="date" value={custom.start} onChange={(event) => setCustom({ ...custom, start: event.target.value })} className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" /></label><label className="text-xs font-medium text-gray-500">Data final<input type="date" value={custom.end} onChange={(event) => setCustom({ ...custom, end: event.target.value })} className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" /></label><button onClick={applyCustom} disabled={!custom.start || !custom.end} className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-40">Aplicar</button><button onClick={refresh} title="Atualizar" className="rounded-lg border border-gray-200 p-2.5 text-gray-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
            </div>
            {dateLabel && <p className="mt-3 text-xs text-gray-400">Dados de {dateLabel}</p>}
        </section>

        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading && !data && <div className="py-20 text-center text-gray-400">Carregando indicadores...</div>}
        {data && <>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">{kpis.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-indigo-500" /><strong className="mt-4 block text-2xl text-gray-900">{value}</strong><span className="mt-1 block text-xs text-gray-500">{label}</span></article>)}<article className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm"><CalendarX className="h-5 w-5 text-indigo-200" /><strong className="mt-4 block text-2xl">{data.kpis.cancellationRate}%</strong><span className="mt-1 block text-xs text-indigo-100">Taxa de cancelamento</span></article></div>
            {data.kpis.appointmentsInPeriod === 0 && <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">Nenhum agendamento encontrado neste período.</div>}
            <div className="mt-6 grid gap-5 lg:grid-cols-2"><Ranking title="Agendamentos por dia" subtitle="Volume total ao longo do período" items={data.appointmentsByDay} /><Ranking title="Por profissional" subtitle="Ativos e cancelados, incluindo registros legados" items={data.appointmentsByProfessional} /><Ranking title="Por serviço" subtitle="Distribuição histórica da demanda" items={data.appointmentsByService} /><Ranking title="Dias mais movimentados" subtitle="Distribuição por dia da semana" items={data.appointmentsByWeekday} /><Ranking title="Horários mais procurados" subtitle="Faixas com maior volume" items={data.appointmentsByTime} /><Ranking title="Clientes com mais agendamentos" subtitle="Agrupamento por usuário/cliente, sem dados de contato" items={data.topClients} /></div>
            <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-semibold">Distribuição por status</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.statusDistribution.map((item) => <div key={item.status} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"><span className="capitalize text-sm text-gray-600">{item.status === 'active' ? 'Ativos' : item.status === 'cancelled' ? 'Cancelados' : item.status}</span><strong className="text-lg text-indigo-700">{item.count}</strong></div>)}</div></section>
        </>}
    </AdminCatalogLayout>;
}
