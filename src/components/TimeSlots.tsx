import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimeSlotsProps {
    selectedDate: Date | undefined;
    selectedTime: string | null;
    onSelectTime: (time: string) => void;
    serviceId: number | null;
    professionalId: number | 'any' | null;
    ignoredAppointmentId?: number | string;
}

export function TimeSlots({ selectedDate, selectedTime, onSelectTime, serviceId, professionalId, ignoredAppointmentId }: TimeSlotsProps) {
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        if (selectedDate && serviceId && professionalId) {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
            const params = new URLSearchParams({ date: formattedDate, service_id: String(serviceId), professional_id: String(professionalId) });
            if (ignoredAppointmentId !== undefined) params.set('ignore_appointment_id', String(ignoredAppointmentId));
            fetch(`/api/availability?${params}`, { signal: controller.signal })
                .then(res => res.json())
                .then(data => {
                    setAvailableTimes(Array.isArray(data) ? data : []);
                })
                .catch(err => {
                    if (err.name !== 'AbortError') console.error('Error fetching availability:', err);
                });
        }
        return () => controller.abort();
    }, [selectedDate, serviceId, professionalId, ignoredAppointmentId]);

    const displayedTimes = selectedDate && serviceId && professionalId ? availableTimes : [];

    if (!selectedDate) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center animate-in fade-in duration-500">
                <Clock className="w-12 h-12 mb-4 opacity-20" />
                <p>Por favor, selecione uma data para ver os horários disponíveis</p>
            </div>
        );
    }

    return (
        <div className="animate-in slide-in-from-left-4 duration-500">
            <h3 className="font-medium text-gray-900 mb-4 capitalize">
                Horários disponíveis para {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {displayedTimes.map((time) => {
                    return (
                        <button
                            key={time}
                            onClick={() => onSelectTime(time)}
                            className={cn(
                                "py-2 px-4 text-sm rounded-lg border border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                                selectedTime === time
                                        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                        : "bg-white text-gray-700 hover:border-indigo-600 hover:text-indigo-600"
                            )}
                        >
                            {time}
                        </button>
                    );
                })}
            </div>
            {displayedTimes.length === 0 && <p className="text-sm text-center mt-4 text-gray-500">Nenhum horário disponível para esta seleção.</p>}
        </div>
    );
}
