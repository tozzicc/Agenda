import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

const bookingSteps = [
    { id: 'service', label: 'Serviço', instruction: 'Escolha o serviço' },
    { id: 'professional', label: 'Profissional', instruction: 'Escolha o profissional' },
    { id: 'date', label: 'Data', instruction: 'Escolha a data' },
    { id: 'time', label: 'Horário', instruction: 'Escolha o horário' },
    { id: 'form', label: 'Dados', instruction: 'Informe seus dados' },
    { id: 'success', label: 'Confirmação', instruction: 'Agendamento confirmado' },
] as const;

export type BookingStep = typeof bookingSteps[number]['id'];

export function BookingStepper({ current }: { current: BookingStep }) {
    const currentIndex = bookingSteps.findIndex((step) => step.id === current);
    const step = bookingSteps[currentIndex];
    return <nav aria-label="Progresso do agendamento" className="mb-8">
        <div className="sm:hidden" aria-live="polite">
            <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Etapa {currentIndex + 1} de {bookingSteps.length}</p><p className="mt-1 font-semibold text-gray-900">{step.instruction}</p></div><span className="text-sm font-medium text-gray-400">{Math.round((currentIndex + 1) / bookingSteps.length * 100)}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${(currentIndex + 1) / bookingSteps.length * 100}%` }} /></div>
        </div>
        <ol className="hidden items-start sm:flex">{bookingSteps.map((item, index) => {
            const completed = index < currentIndex, active = index === currentIndex;
            return <li key={item.id} className="flex min-w-0 flex-1 items-start last:flex-none" aria-current={active ? 'step' : undefined}>
                <div className="flex min-w-0 flex-col items-center"><span className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold', completed && 'border-indigo-200 bg-indigo-50 text-indigo-700', active && 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200', !completed && !active && 'border-gray-200 bg-white text-gray-400')}>{completed ? <Check className="h-4 w-4" aria-label="Concluída" /> : index + 1}</span><span className={cn('mt-2 hidden text-center text-xs font-medium md:block', active ? 'text-indigo-700' : completed ? 'text-gray-600' : 'text-gray-400')}>{item.label}</span></div>
                {index < bookingSteps.length - 1 && <span className={cn('mx-2 mt-4 h-0.5 min-w-3 flex-1', index < currentIndex ? 'bg-indigo-200' : 'bg-gray-200')} />}
            </li>;
        })}</ol>
    </nav>;
}
