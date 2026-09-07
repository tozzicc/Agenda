import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Hero } from '../components/Hero';
import { CalendarView } from '../components/CalendarView';
import { TimeSlots } from '../components/TimeSlots';
import { BookingForm, type BookingData } from '../components/BookingForm';
import { Confirmation } from '../components/Confirmation';
import { Navbar } from '../components/Navbar';
import { useSettings } from '../context/SettingsContext';
import type { Professional, Service } from '../lib/admin-api';
import { formatBRL } from '../lib/currency';
import { BookingStepper, type BookingStep } from '../components/BookingStepper';

type ProfessionalSelection = Professional | { id: 'any'; name: string; specialty: string };

export function Home() {
    const { settings } = useSettings();
    const [step, setStep] = React.useState<BookingStep>('service');
    const [services, setServices] = React.useState<Service[]>([]);
    const [professionals, setProfessionals] = React.useState<Professional[]>([]);
    const [selectedService, setSelectedService] = React.useState<Service | null>(null);
    const [selectedProfessional, setSelectedProfessional] = React.useState<ProfessionalSelection | null>(null);
    const [selectedDate, setSelectedDate] = React.useState<Date>();
    const [selectedTime, setSelectedTime] = React.useState<string | null>(null);
    const [bookingData, setBookingData] = React.useState<BookingData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        fetch('/api/services').then(async (response) => {
            if (!response.ok) throw new Error('Não foi possível carregar os serviços.');
            setServices(await response.json());
        }).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
    }, []);

    const chooseService = async (service: Service) => {
        setSelectedService(service);
        setSelectedProfessional(null);
        setSelectedDate(undefined); setSelectedTime(null); setBookingData(null);
        setError('');
        setLoading(true);
        try {
            const response = await fetch(`/api/services/${service.id}/professionals`);
            if (!response.ok) throw new Error('Não foi possível carregar os profissionais.');
            setProfessionals(await response.json());
            setStep('professional');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar profissionais.'); }
        finally { setLoading(false); }
    };

    const reset = () => {
        setStep('service'); setSelectedService(null); setSelectedProfessional(null);
        setSelectedDate(undefined); setSelectedTime(null); setBookingData(null);
    };

    const optionButton = (title: string, subtitle: string | null, onClick: () => void, price?: string) => (
        <button onClick={onClick} className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow-sm">
            <span className="block font-semibold text-gray-900">{title}</span>
            {price !== undefined && <span className="mt-1 block font-semibold text-indigo-700">{formatBRL(price)}</span>}
            {subtitle && <span className="mt-1 block text-sm text-gray-500">{subtitle}</span>}
        </button>
    );

    return <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center pb-12 px-4 sm:px-6">
            {step !== 'success' && <Hero logo={settings?.appLogo} />}
            <div className="w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-6 shadow-xl md:p-8">
                <BookingStepper current={step} />
                {step === 'success' && bookingData && selectedDate && selectedTime && selectedService && selectedProfessional ?
                    <Confirmation selectedDate={selectedDate} selectedTime={selectedTime} bookingData={bookingData} serviceName={selectedService.name} professionalName={bookingData.assignedProfessionalName || selectedProfessional.name} servicePrice={selectedService.price} serviceDuration={selectedService.duration_minutes} onReset={reset} /> : <>
                    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    {loading && <p className="py-10 text-center text-gray-500">Carregando...</p>}
                    {!loading && step === 'service' && <section><h2 className="mb-5 text-xl font-semibold">1. Escolha o serviço</h2><div className="grid gap-3 sm:grid-cols-2">{services.map((item) => <React.Fragment key={item.id}>{optionButton(item.name, `${item.duration_minutes} min${item.description ? ` · ${item.description}` : ''}`, () => void chooseService(item), item.price)}</React.Fragment>)}</div>{services.length === 0 && <p className="text-gray-500">Nenhum serviço disponível no momento.</p>}</section>}
                    {!loading && step === 'professional' && <section><h2 className="mb-5 text-xl font-semibold">2. Escolha o profissional</h2><div className="grid gap-3 sm:grid-cols-2">{professionals.length > 0 && optionButton('Qualquer profissional disponível', 'Escolheremos automaticamente quem estiver livre primeiro.', () => { setSelectedProfessional({ id: 'any', name: 'Qualquer profissional disponível', specialty: '' }); setStep('date'); })}{professionals.map((item) => <React.Fragment key={item.id}>{optionButton(item.name, item.specialty, () => { setSelectedProfessional(item); setStep('date'); })}</React.Fragment>)}</div>{professionals.length === 0 && <p className="text-gray-500">Nenhum profissional disponível para este serviço.</p>}<button onClick={() => setStep('service')} className="mt-6 text-sm font-medium text-indigo-600">Voltar</button></section>}
                    {step === 'date' && <section><h2 className="mb-5 text-xl font-semibold">3. Escolha a data</h2><CalendarView selectedDate={selectedDate} onSelect={(date) => { setSelectedDate(date); if (date) { setSelectedTime(null); setStep('time'); } }} /><button onClick={() => setStep('professional')} className="mt-6 text-sm font-medium text-indigo-600">Voltar</button></section>}
                    {step === 'time' && <section><h2 className="mb-5 text-xl font-semibold">4. Escolha o horário</h2><TimeSlots selectedDate={selectedDate} selectedTime={selectedTime} serviceId={selectedService?.id ?? null} professionalId={selectedProfessional?.id ?? null} onSelectTime={(time) => { setSelectedTime(time); setStep('form'); }} /><button onClick={() => setStep('date')} className="mt-6 text-sm font-medium text-indigo-600">Voltar</button></section>}
                    {step === 'form' && selectedDate && selectedTime && selectedService && selectedProfessional && <section><h2 className="mb-5 text-xl font-semibold">5. Informe seus dados</h2><BookingForm selectedDate={selectedDate} selectedTime={selectedTime} serviceId={selectedService.id} professionalId={selectedProfessional.id} serviceName={selectedService.name} professionalName={selectedProfessional.name} onSubmit={(data) => { setBookingData(data); setStep('success'); }} onBack={() => setStep('time')} /></section>}
                    {step !== 'service' && <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500"><ChevronRight className="h-4 w-4" />{selectedService?.name}{selectedProfessional ? ` · ${selectedProfessional.name}` : ''}</div>}
                </>}
            </div>
        </main>
    </div>;
}
