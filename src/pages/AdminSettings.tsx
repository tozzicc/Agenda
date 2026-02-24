import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Settings, Clock, Save, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScheduleConfig {
    start: string;
    end: string;
    interval: number;
    allow_saturday: boolean;
    allow_sunday: boolean;
    blockedPeriods: { start: string; end: string }[];
}

function generateTimeOptions() {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    return options;
}

function generatePreviewSlots(start: string, end: string, interval: number): string[] {
    const slots: string[] = [];
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let current = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    while (current < endMin) {
        const h = Math.floor(current / 60);
        const m = current % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        current += interval;
    }
    return slots;
}

const TIME_OPTIONS = generateTimeOptions();

export function AdminSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState<ScheduleConfig>({
        start: '09:00',
        end: '17:00',
        interval: 30,
        allow_saturday: false,
        allow_sunday: false,
        blockedPeriods: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/settings/schedule')
            .then(res => res.json())
            .then(data => {
                setConfig({
                    start: data.start,
                    end: data.end,
                    interval: data.interval,
                    allow_saturday: data.allow_saturday,
                    allow_sunday: data.allow_sunday,
                    blockedPeriods: data.blockedPeriods || []
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const previewSlots = useMemo(() => {
        return generatePreviewSlots(config.start, config.end, config.interval);
    }, [config.start, config.end, config.interval]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/settings/schedule', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                const data = await response.json();
                setError(data.error || 'Erro ao salvar');
            }
        } catch {
            setError('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Navbar />
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-500">Acesso restrito a administradores.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Navbar />
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-400">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Navbar />
            <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 pb-12">
                <div className="w-full max-w-2xl">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Settings className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Configurações de Horário</h1>
                            <p className="text-sm text-gray-500">Defina os horários disponíveis para agendamento</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        {/* Form */}
                        <div className="p-6 sm:p-8 space-y-6">
                            {/* Start and End Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Clock className="w-4 h-4 inline mr-1.5 text-indigo-500" />
                                        Horário de Início
                                    </label>
                                    <select
                                        value={config.start}
                                        onChange={(e) => setConfig(prev => ({ ...prev, start: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-gray-800"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Clock className="w-4 h-4 inline mr-1.5 text-indigo-500" />
                                        Horário de Fim
                                    </label>
                                    <select
                                        value={config.end}
                                        onChange={(e) => setConfig(prev => ({ ...prev, end: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-gray-800"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Interval */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Intervalo entre horários
                                </label>
                                <div className="flex gap-3">
                                    {[
                                        { value: 15, label: '15 min' },
                                        { value: 30, label: '30 min' },
                                        { value: 60, label: '1 hora' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setConfig(prev => ({ ...prev, interval: opt.value }))}
                                            className={cn(
                                                "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all",
                                                config.interval === opt.value
                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                                                    : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Weekend Toggles */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-700 mb-4">Funcionamento no Fim de Semana</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={config.allow_saturday}
                                            onChange={(e) => setConfig(prev => ({ ...prev, allow_saturday: e.target.checked }))}
                                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="block text-sm font-medium text-gray-800">Abrir aos Sábados</span>
                                            <span className="text-xs text-gray-500">Permitir agendamentos para sábados</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={config.allow_sunday}
                                            onChange={(e) => setConfig(prev => ({ ...prev, allow_sunday: e.target.checked }))}
                                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="block text-sm font-medium text-gray-800">Abrir aos Domingos</span>
                                            <span className="text-xs text-gray-500">Permitir agendamentos para domingos</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Blackout Periods */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center justify-between">
                                    Bloqueio de Períodos
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, blockedPeriods: [...prev.blockedPeriods, { start: '', end: '' }] }))}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        + Adicionar Período
                                    </button>
                                </h3>

                                <div className="space-y-3">
                                    {config.blockedPeriods.map((period, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Início</label>
                                                <input
                                                    type="date"
                                                    value={period.start}
                                                    onChange={(e) => {
                                                        const newPeriods = [...config.blockedPeriods];
                                                        newPeriods[index].start = e.target.value;
                                                        setConfig(prev => ({ ...prev, blockedPeriods: newPeriods }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Fim</label>
                                                <input
                                                    type="date"
                                                    value={period.end}
                                                    onChange={(e) => {
                                                        const newPeriods = [...config.blockedPeriods];
                                                        newPeriods[index].end = e.target.value;
                                                        setConfig(prev => ({ ...prev, blockedPeriods: newPeriods }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newPeriods = config.blockedPeriods.filter((_, i) => i !== index);
                                                    setConfig(prev => ({ ...prev, blockedPeriods: newPeriods }));
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remover período"
                                            >
                                                <CheckCircle className="w-5 h-5 rotate-45" />
                                            </button>
                                        </div>
                                    ))}
                                    {config.blockedPeriods.length === 0 && (
                                        <p className="text-xs text-gray-400 italic">Nenhum período de bloqueio configurado.</p>
                                    )}
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving || previewSlots.length === 0}
                                className={cn(
                                    "w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                                    saved
                                        ? "bg-green-600 text-white"
                                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200",
                                    (saving || previewSlots.length === 0) && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {saved ? (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        Salvo com sucesso!
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {saving ? 'Salvando...' : 'Salvar Configurações'}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Preview */}
                        <div className="border-t border-gray-100 bg-gray-50/50 p-6 sm:p-8">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                Pré-visualização dos horários ({previewSlots.length} slots)
                            </h3>
                            {previewSlots.length === 0 ? (
                                <p className="text-sm text-red-500">
                                    Configuração inválida. O horário de início deve ser antes do horário de fim.
                                </p>
                            ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                    {previewSlots.map(time => (
                                        <div
                                            key={time}
                                            className="py-1.5 px-2 text-xs text-center rounded-md bg-white border border-gray-200 text-gray-600 font-medium"
                                        >
                                            {time}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
