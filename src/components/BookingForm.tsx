import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

interface BookingFormProps {
    selectedDate: Date;
    selectedTime: string;
    onSubmit: (data: BookingData) => void;
    onBack: () => void;
}

export interface BookingData {
    name: string;
    email: string;
    phone: string;
    notes?: string;
}

export function BookingForm({ selectedDate, selectedTime, onSubmit, onBack }: BookingFormProps) {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = React.useState<BookingData>({
        name: '',
        email: '',
        phone: '',
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    time: selectedTime,
                    ...formData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 409) {
                    alert('Este horário acabou de ser reservado por outra pessoa. Por favor, escolha outro.');
                    onBack(); // Go back to time selection
                    return;
                }
                throw new Error(errorData.error || 'Erro ao agendar');
            }

            onSubmit(formData);
        } catch (error) {
            console.error('Booking error:', error);
            alert('Ocorreu um erro ao realizar o agendamento. Tente novamente.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-right-8 duration-500">
            <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-sm text-indigo-900 border border-indigo-100">
                Você está agendando para <span className="font-semibold capitalize">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</span> às <span className="font-semibold">{selectedTime}</span>
            </div>

            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input
                    type="text"
                    id="name"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                    type="email"
                    id="email"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
            </div>
            <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                <input
                    type="tel"
                    id="phone"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
            </div>
            <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
                <textarea
                    id="notes"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Alguma informação extra?"
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
            </div>

            <div className="flex gap-4 pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                    Voltar
                </button>
                {isAuthenticated ? (
                    <button
                        type="submit"
                        className="flex-1 py-2.5 px-4 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                        Confirmar Agendamento
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="flex-1 py-2.5 px-4 bg-gray-900 rounded-lg text-white font-medium hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Entre para Confirmar</span>
                    </button>
                )}
            </div>
        </form>
    );
}
