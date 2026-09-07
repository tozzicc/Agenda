import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, LoaderCircle, Plus, Stethoscope, X } from 'lucide-react';
import { AdminCatalogLayout } from '../components/AdminCatalogLayout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { adminRequest, type Professional, type ProfessionalInput, type Service } from '../lib/admin-api';
import { cn } from '../lib/utils';

const emptyForm: ProfessionalInput = { name: '', specialty: '', active: true };

export function AdminProfessionals() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [associations, setAssociations] = useState<Record<number, Service[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Professional | null | undefined>(undefined);
    const [form, setForm] = useState<ProfessionalInput>(emptyForm);
    const [selectedServices, setSelectedServices] = useState<number[]>([]);

    const loadData = useCallback(async () => {
        if (user?.role !== 'admin') return;
        if (settings.demoMode) { setProfessionals([]); setServices([]); setAssociations({}); setLoading(false); return; }
        setLoading(true); setError('');
        try {
            const [professionalList, serviceList] = await Promise.all([
                adminRequest<Professional[]>('/api/admin/professionals'),
                adminRequest<Service[]>('/api/admin/services'),
            ]);
            const entries = await Promise.all(professionalList.map(async (professional) => [professional.id, await adminRequest<Service[]>(`/api/admin/professionals/${professional.id}/services`)] as const));
            setProfessionals(professionalList); setServices(serviceList); setAssociations(Object.fromEntries(entries));
        } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar profissionais.'); }
        finally { setLoading(false); }
    }, [user?.role, settings.demoMode]);

    useEffect(() => { void loadData(); }, [loadData]);

    const openCreate = () => { setEditing(null); setForm(emptyForm); setSelectedServices([]); setError(''); };
    const openEdit = (professional: Professional) => { setEditing(professional); setForm({ name: professional.name, specialty: professional.specialty || '', active: professional.active }); setSelectedServices((associations[professional.id] || []).map((service) => service.id)); setError(''); };
    const closeModal = () => { if (!saving) setEditing(undefined); };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const name = form.name.trim();
        if (!name) { setError('Informe o nome do profissional.'); return; }
        if (name.length > 120) { setError('O nome deve ter no máximo 120 caracteres.'); return; }
        setSaving(true); setError('');
        try {
            const payload = { ...form, name, specialty: form.specialty.trim() };
            const professional = editing
                ? await adminRequest<Professional>(`/api/admin/professionals/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
                : await adminRequest<Professional>('/api/admin/professionals', { method: 'POST', body: JSON.stringify(payload) });
            const currentIds = new Set((editing ? associations[editing.id] || [] : []).map((service) => service.id));
            const desiredIds = new Set(selectedServices);
            await Promise.all([
                ...selectedServices.filter((id) => !currentIds.has(id)).map((id) => adminRequest(`/api/admin/professionals/${professional.id}/services/${id}`, { method: 'POST', body: '{}' })),
                ...[...currentIds].filter((id) => !desiredIds.has(id)).map((id) => adminRequest(`/api/admin/professionals/${professional.id}/services/${id}`, { method: 'DELETE' })),
            ]);
            setEditing(undefined); await loadData();
        } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao salvar profissional.'); }
        finally { setSaving(false); }
    };

    const toggleStatus = async (professional: Professional) => {
        setError('');
        try { await adminRequest(`/api/admin/professionals/${professional.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !professional.active }) }); await loadData(); }
        catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Erro ao alterar status.'); }
    };

    return (
        <AdminCatalogLayout title="Profissionais" subtitle="Gerencie a equipe e os serviços realizados por cada profissional." action={<button onClick={openCreate} disabled={settings.demoMode} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Novo profissional</button>}>
            {settings.demoMode && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Cadastros operacionais ficam somente para consulta fora do modo demonstração. Desative a demo para gerenciá-los.</div>}
            {error && editing === undefined && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" /></div> : professionals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"><Stethoscope className="mx-auto h-10 w-10 text-indigo-300" /><h2 className="mt-4 font-semibold">Nenhum profissional cadastrado</h2><p className="mt-1 text-sm text-gray-500">Cadastre o primeiro profissional para começar.</p></div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">{professionals.map((professional) => (
                    <article key={professional.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-gray-900">{professional.name}</h2><p className="mt-1 text-sm text-gray-500">{professional.specialty || 'Especialidade não informada'}</p></div><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', professional.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600')}>{professional.active ? 'Ativo' : 'Inativo'}</span></div>
                        <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Serviços atendidos</p><div className="mt-2 flex min-h-7 flex-wrap gap-2">{(associations[professional.id] || []).length ? associations[professional.id].map((service) => <span key={service.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{service.name}</span>) : <span className="text-sm text-gray-400">Nenhum serviço associado</span>}</div></div>
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4"><button onClick={() => openEdit(professional)} disabled={settings.demoMode} className="flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"><Edit3 className="h-4 w-4" />Editar</button><button onClick={() => void toggleStatus(professional)} disabled={settings.demoMode} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">{professional.active ? 'Inativar' : 'Ativar'}</button></div>
                    </article>
                ))}</div>
            )}
            {editing !== undefined && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{editing ? 'Editar profissional' : 'Novo profissional'}</h2><p className="mt-1 text-sm text-gray-500">Preencha os dados e selecione os serviços atendidos.</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
                <div className="mt-6 space-y-5"><label className="block text-sm font-medium">Nome<input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" /></label><label className="block text-sm font-medium">Especialidade ou descrição curta<textarea maxLength={300} rows={3} value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" /></label><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-indigo-600" />Profissional ativo</label>
                    <fieldset><legend className="text-sm font-medium">Serviços atendidos</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{services.length ? services.map((service) => <label key={service.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm"><input type="checkbox" checked={selectedServices.includes(service.id)} onChange={(event) => setSelectedServices(event.target.checked ? [...selectedServices, service.id] : selectedServices.filter((id) => id !== service.id))} className="h-4 w-4 accent-indigo-600" /><span>{service.name}{!service.active && <span className="ml-1 text-xs text-gray-400">(inativo)</span>}</span></label>) : <p className="text-sm text-gray-400">Cadastre serviços antes de criar associações.</p>}</div></fieldset>
                </div>{error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar profissional'}</button></div></form></div>}
        </AdminCatalogLayout>
    );
}