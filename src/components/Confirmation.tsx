import { CheckCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type BookingData } from './BookingForm';

interface ConfirmationProps {
    selectedDate: Date;
    selectedTime: string;
    bookingData: BookingData;
    onReset: () => void;
}

export function Confirmation({ selectedDate, selectedTime, bookingData, onReset }: ConfirmationProps) {
    return (
        <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h2>
            <p className="text-gray-500 mb-8">
                Enviamos um email de confirmação para {bookingData.email}
            </p>

            <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left max-w-sm mx-auto border border-gray-100">
                <div className="flex items-start gap-4 mb-4 pb-4 border-b border-gray-200">
                    <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-gray-900 capitalize">
                            {format(selectedDate, "EEEE, d 'de' MMMM, yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-gray-500">{selectedTime}</p>
                    </div>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Nome</span>
                        <span className="font-medium text-gray-900">{bookingData.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Telefone</span>
                        <span className="font-medium text-gray-900">{bookingData.phone}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onReset}
                className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            >
                Agendar outro horário
            </button>
        </div>
    );
}
