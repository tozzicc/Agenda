import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, Clock3, Edit3, LoaderCircle, Plus, X } from 'lucide-react';
import { AdminCatalogLayout } from '../components/AdminCatalogLayout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { adminRequest, type Professional, type Service, type ServiceInput } from '../lib/admin-api';
import { cn } from '../lib/utils';
import { formatBRL } from '../lib/currency';

const emptyForm: ServiceInput = { name: '', description: '', durationMinutes: 60, price: '0.00', active: true };
const quickDurations = [15, 30, 45, 60, 90, 120];

export function AdminServices() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [services, setServices] = useState<Service[]>([]);
    const [professionalNames, setProfessionalNames] = useState<Record<number, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Service | null | undefined>(undefined);
    const [form, setForm] = useState<ServiceInput>(emptyForm);

    const loadData = useCallback(async () => {
        if (user?.role !== 'admin') return;
        if (settings.demoMode) { setServices([]); setProfessionalNames({}); setLoading(false); return; }
        setLoading(true); setError('');
        try {
            const [serviceList, professionals] = await Promise.all([adminRequest<Service[]>('/api/admin/services'), adminRequest<Professional[]>('/api/admin/professionals')]);
            const associations = await Promise.all(professionals.map(async (professional) => ({ professional, services: await adminRequest<Service[]>(`/api/admin/professionals/${professional.id}/services`) })));
            const names: Record<number, string[]> = {};
            for (const item of associations) for (const service of item.services) (names[service.id] ||= []).push(item.professional.name);
            setServices(serviceList); setProfessionalNames(names);
        } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar serviços.'); }
        finally { setLoading(false); }
    }, [user?.role, settings.demoMode]);

    useEffect(() => { void loadData(); }, [loadData]);
    const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); };
    const openEdit = (service: Service) => { setEditing(service); setForm({ name: service.name, description: service.description || '', durationMinutes: service.duration_minutes, price: service.price, active: service.active }); setError(''); };
    const closeModal = () => { if (!saving) setEditing(undefined); };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const name = form.name.trim();
        if (!name) { setError('Informe o nome do serviço.'); return; }
        if (name.length > 120) { setError('O nome deve ter no máximo 120 caracteres.'); return; }
        if (!Number.isInteger(form.durationMinutes) || form.durationMinutes < 1 || form.durationMinutes > 1440) { setError('A duração deve ser um número inteiro entre 1 e 1440 minutos.'); return; }
        if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(form.price)) { setError('Informe um preço válido com no máximo duas casas decimais.'); return; }
        setSaving(true); setError('');
        try {
            const payload = { ...form, name, description: form.description.trim() };
            await adminRequest(editing ? `/api/admin/services/${editing.id}` : '/api/admin/services', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
            setEditing(undefined); await loadData();
        } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao salvar serviço.'); }
        finally { setSaving(false); }
    };

    const toggleStatus = async (service: Service) => {
        setError('');
        try { await adminRequest(`/api/admin/services/${service.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !service.active }) }); await loadData(); }
        catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao alterar status.'); }
    };

    return (
        <AdminCatalogLayout title="Serviços" subtitle="Organize os serviços oferecidos e suas respectivas durações." action={<button onClick={openCreate} disabled={settings.demoMode} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Novo serviço</button>}>
            {services.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{services.map((service) => <span key={service.id} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{service.name}: {formatBRL(service.price)}</span>)}</div>}
            {editing !== undefined && <label className="fixed bottom-5 right-5 z-[70] rounded-xl bg-white p-4 text-sm font-medium shadow-2xl">Preço (R$)<input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value.replace(',', '.') })} className="mt-2 block w-40 rounded-lg border border-gray-200 px-3 py-2" /></label>}
            {settings.demoMode && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Cadastros operacionais não são exibidos nem alterados no modo demonstração. Desative a demo para gerenciá-los.</div>}
            {error && editing === undefined && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" /></div> : services.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"><BriefcaseBusiness className="mx-auto h-10 w-10 text-indigo-300" /><h2 className="mt-4 font-semibold">Nenhum serviço cadastrado</h2><p className="mt-1 text-sm text-gray-500">Cadastre os serviços oferecidos pelo estabelecimento.</p></div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="hidden grid-cols-[1.2fr_1.5fr_120px_100px_1fr_150px] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400 lg:grid"><span>Nome</span><span>Descrição</span><span>Duração</span><span>Status</span><span>Profissionais</span><span>Ações</span></div><div className="divide-y divide-gray-100">{services.map((service) => <article key={service.id} className="grid gap-3 px-5 py-5 lg:grid-cols-[1.2fr_1.5fr_120px_100px_1fr_150px] lg:items-center lg:gap-4"><div><span className="text-xs font-bold uppercase text-gray-400 lg:hidden">Nome</span><h2 className="font-semibold">{service.name}</h2></div><div><span className="text-xs font-bold uppercase text-gray-400 lg:hidden">Descrição</span><p className="text-sm text-gray-500">{service.description || 'Sem descrição'}</p></div><div className="flex items-center gap-2 text-sm font-medium text-gray-700"><Clock3 className="h-4 w-4 text-indigo-500" />{service.duration_minutes} min</div><div><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', service.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600')}>{service.active ? 'Ativo' : 'Inativo'}</span></div><div><span className="text-xs font-bold uppercase text-gray-400 lg:hidden">Profissionais</span><p className="text-sm text-gray-500">{(professionalNames[service.id] || []).join(', ') || 'Nenhum associado'}</p></div><div className="flex gap-2"><button onClick={() => openEdit(service)} disabled={settings.demoMode} title="Editar" className="rounded-lg border border-indigo-200 p-2 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"><Edit3 className="h-4 w-4" /></button><button onClick={() => void toggleStatus(service)} disabled={settings.demoMode} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">{service.active ? 'Inativar' : 'Ativar'}</button></div></article>)}</div></div>
            )}
            {editing !== undefined && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{editing ? 'Editar serviço' : 'Novo serviço'}</h2><p className="mt-1 text-sm text-gray-500">Configure descrição, duração e disponibilidade administrativa.</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-5"><label className="block text-sm font-medium">Nome<input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" /></label><label className="block text-sm font-medium">Descrição<textarea maxLength={500} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" /></label><label className="block text-sm font-medium">Duração em minutos<input required type="number" min={1} max={1440} step={1} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" /></label><div className="flex flex-wrap gap-2">{quickDurations.map((duration) => <button key={duration} type="button" onClick={() => setForm({ ...form, durationMinutes: duration })} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', form.durationMinutes === duration ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300')}>{duration} min</button>)}</div><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-indigo-600" />Serviço ativo</label></div>{error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar serviço'}</button></div></form></div>}
        </AdminCatalogLayout>
    );
}
