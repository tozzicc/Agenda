import React from 'react';
import { Hero } from '../components/Hero';
import { CalendarView } from '../components/CalendarView';
import { TimeSlots } from '../components/TimeSlots';
import { BookingForm, type BookingData } from '../components/BookingForm';
import { Confirmation } from '../components/Confirmation';
import { cn } from '../lib/utils';
import { ChevronRight } from 'lucide-react';

import { Navbar } from '../components/Navbar';

export function Home() {
    const [step, setStep] = React.useState<'date' | 'time' | 'form' | 'success'>('date');
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = React.useState<string | null>(null);
    const [bookingData, setBookingData] = React.useState<BookingData | null>(null);

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        if (date) {
            setStep('time');
            setSelectedTime(null);
        }
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        setStep('form');
    };

    const handleFormSubmit = (data: BookingData) => {
        setBookingData(data);
        setStep('success');
    };

    const handleReset = () => {
        setStep('date');
        setSelectedDate(undefined);
        setSelectedTime(null);
        setBookingData(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Navbar />
            <main className="flex-grow flex flex-col items-center justify-start pt-8 pb-12 px-4 sm:px-6">
                {step !== 'success' && <Hero />}

                <div className="w-full max-w-7xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-500 ease-in-out">
                    {step === 'success' && bookingData && selectedDate && selectedTime ? (
                        <div className="p-12 flex justify-center items-center h-full min-h-[400px]">
                            <Confirmation
                                selectedDate={selectedDate}
                                selectedTime={selectedTime}
                                bookingData={bookingData}
                                onReset={handleReset}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row h-full">
                            {/* Left Panel - Calendar */}
                            <div className="w-full lg:w-1/2 p-6 md:p-8 bg-white border-b lg:border-b-0 lg:border-r border-gray-100">
                                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                    <span className={cn(
                                        "w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm",
                                        step === 'date' ? "bg-indigo-600 text-white" : ""
                                    )}>1</span>
                                    Selecione a Data
                                </h2>
                                <CalendarView
                                    selectedDate={selectedDate}
                                    onSelect={handleDateSelect}
                                />
                            </div>

                            {/* Right Panel - Dynamic Content */}
                            <div className="w-full lg:w-1/2 p-6 md:p-8 bg-gray-50/50">
                                {step === 'date' && (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8">
                                        <div className="w-16 h-16 rounded-full bg-gray-100 mb-4 flex items-center justify-center">
                                            <ChevronRight className="w-8 h-8 opacity-20" />
                                        </div>
                                        <p>Escolha uma data para continuar</p>
                                    </div>
                                )}

                                {step === 'time' && (
                                    <div>
                                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                            <span className={cn(
                                                "w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm",
                                                "bg-indigo-600 text-white"
                                            )}>2</span>
                                            Selecione o Horário
                                        </h2>
                                        <TimeSlots
                                            selectedDate={selectedDate}
                                            selectedTime={selectedTime}
                                            onSelectTime={handleTimeSelect}
                                        />
                                    </div>
                                )}

                                {step === 'form' && selectedDate && selectedTime && (
                                    <div>
                                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                            <span className={cn(
                                                "w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm",
                                                "bg-indigo-600 text-white"
                                            )}>3</span>
                                            Seus Dados
                                        </h2>
                                        <BookingForm
                                            selectedDate={selectedDate}
                                            selectedTime={selectedTime}
                                            onSubmit={handleFormSubmit}
                                            onBack={() => setStep('time')}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
