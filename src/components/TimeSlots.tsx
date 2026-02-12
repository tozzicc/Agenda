import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimeSlotsProps {
    selectedDate: Date | undefined;
    selectedTime: string | null;
    onSelectTime: (time: string) => void;
}

const AVAILABLE_TIMES = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30"
];

export function TimeSlots({ selectedDate, selectedTime, onSelectTime }: TimeSlotsProps) {
    const [bookedTimes, setBookedTimes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedDate) {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
            setLoading(true);
            fetch(`/api/bookings?date=${formattedDate}`)
                .then(res => res.json())
                .then(data => {
                    setBookedTimes(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching bookings:', err);
                    setLoading(false);
                });
        }
    }, [selectedDate]);

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
                {AVAILABLE_TIMES.map((time) => {
                    const isBooked = bookedTimes.includes(time);
                    return (
                        <button
                            key={time}
                            onClick={() => onSelectTime(time)}
                            disabled={isBooked || loading}
                            className={cn(
                                "py-2 px-4 text-sm rounded-lg border border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                                isBooked
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100 decoration-slice line-through"
                                    : selectedTime === time
                                        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                        : "bg-white text-gray-700 hover:border-indigo-600 hover:text-indigo-600"
                            )}
                        >
                            {time}
                        </button>
                    );
                })}
            </div>
            {loading && <p className="text-xs text-center mt-2 text-gray-400">Carregando disponibilidade...</p>}
        </div>
    );
}
