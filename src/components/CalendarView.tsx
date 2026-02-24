import { useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    isSameDay,
    startOfMonth,
    startOfToday,
    subMonths,
    isBefore,
    isWithinInterval,
    parseISO,
    getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
    selectedDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    settings?: {
        allow_saturday: boolean;
        allow_sunday: boolean;
        blockedPeriods: { start: string; end: string }[];
    };
}

export function CalendarView({ selectedDate, onSelect, settings }: CalendarViewProps) {
    const today = startOfToday();
    const [currentMonth, setCurrentMonth] = useState(today);

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const isCurrentMonth = isSameDay(startOfMonth(today), startOfMonth(currentMonth));

    return (
        <div className="animate-in slide-in-from-left-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={prevMonth}
                    disabled={isCurrentMonth}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <button
                    onClick={nextMonth}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {days.map((date) => {
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const isPast = isBefore(date, today);

                    // Check weekend restriction
                    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
                    const isWeekendDisabled =
                        (dayOfWeek === 0 && settings && !settings.allow_sunday) ||
                        (dayOfWeek === 6 && settings && !settings.allow_saturday);

                    // Check blackout periods
                    const isBlackedOut = settings?.blockedPeriods?.some(period => {
                        if (!period.start || !period.end) return false;
                        try {
                            return isWithinInterval(date, {
                                start: parseISO(period.start),
                                end: parseISO(period.end)
                            });
                        } catch {
                            return false;
                        }
                    });

                    const isDisabled = isPast || isWeekendDisabled || isBlackedOut;

                    return (
                        <button
                            key={date.toString()}
                            onClick={() => !isDisabled && onSelect(date)}
                            disabled={isDisabled}
                            className={cn(
                                "flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                                isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-[1.02]"
                                    : isDisabled
                                        ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                                        : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:shadow-sm hover:bg-indigo-50/30"
                            )}
                        >
                            <span className="text-xs font-medium uppercase opacity-80 mb-1">
                                {format(date, 'EEE', { locale: ptBR })}
                            </span>
                            <span className="text-xl font-bold">
                                {format(date, 'd')}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
