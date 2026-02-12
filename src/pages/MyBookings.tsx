import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Trash2, Edit2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CalendarView } from '../components/CalendarView';
import { TimeSlots } from '../components/TimeSlots';
import { cn } from '../lib/utils';

interface Appointment {
    id: number;
    date: string;
    time: string;
    name: string;
    notes: string;
    status: string;
}

export function MyBookings() {
    const { isAuthenticated } = useAuth();
    const [bookings, setBookings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBooking, setEditingBooking] = useState<Appointment | null>(null);

    // Edit State
    const [newDate, setNewDate] = useState<Date | undefined>(undefined);
    const [newTime, setNewTime] = useState<string | null>(null);

    useEffect(() => {
        fetchBookings();
    }, [isAuthenticated]);

    const fetchBookings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/my-bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(data); // Show all (active and cancelled)
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: number) => {
        if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bookings/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                fetchBookings(); // Refresh list to show as cancelled
            } else {
                const errData = await response.json();
                alert(errData.error || 'Erro ao cancelar agendamento');
            }
        } catch (error) {
            console.error('Error canceling:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja EXCLUIR PERMANENTEMENTE este agendamento? Esta ação não pode ser desfeita.')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bookings/${id}/force`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setBookings(bookings.filter(b => b.id !== id));
            } else {
                const errData = await response.json();
                alert(errData.error || 'Erro ao excluir agendamento');
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const openEditModal = (booking: Appointment) => {
        setEditingBooking(booking);
        setNewDate(parseISO(booking.date));
        setNewTime(booking.time);
    };

    const closeEditModal = () => {
        setEditingBooking(null);
        setNewDate(undefined);
        setNewTime(null);
    };

    const handleUpdate = async () => {
        if (!editingBooking || !newDate || !newTime) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bookings/${editingBooking.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: format(newDate, 'yyyy-MM-dd'),
                    time: newTime,
                    notes: editingBooking.notes
                })
            });

            if (response.ok) {
                closeEditModal();
                fetchBookings();
            } else {
                const error = await response.json();
                alert(error.error || 'Erro ao atualizar');
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Erro ao atualizar agendamento');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
                <h1 className="text-2xl font-bold mb-6">Gerenciar Meus Agendamentos</h1>

                {bookings.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
                        Você não tem agendamentos registrados.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {bookings.map(booking => (
                            <div key={booking.id} className={cn(
                                "bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all",
                                booking.status === 'cancelled' && "opacity-60 grayscale-[0.5]"
                            )}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                                            <Calendar className="w-5 h-5" />
                                            <span className="capitalize">
                                                {format(parseISO(booking.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                                            </span>
                                        </div>
                                        {booking.status === 'active' ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                                Agendado
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                                Cancelado
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                                        <Clock className="w-4 h-4" />
                                        <span>{booking.time}</span>
                                    </div>
                                    {booking.notes && (
                                        <p className="text-gray-500 text-sm mt-2 italic">"{booking.notes}"</p>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {booking.status === 'active' && (
                                        <>
                                            <button
                                                onClick={() => openEditModal(booking)}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Alterar
                                            </button>
                                            <button
                                                onClick={() => handleCancel(booking.id)}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Cancelar
                                            </button>
                                        </>
                                    )}
                                    {booking.status === 'cancelled' && (
                                        <button
                                            onClick={() => handleDelete(booking.id)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            Excluir
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingBooking && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold">Alterar Agendamento</h2>
                            <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Nova Data</h3>
                                <CalendarView
                                    selectedDate={newDate}
                                    onSelect={(date) => {
                                        setNewDate(date);
                                        setNewTime(null); // Reset time when date changes
                                    }}
                                />
                            </div>

                            {newDate && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Novo Horário</h3>
                                    <TimeSlots
                                        selectedDate={newDate}
                                        selectedTime={newTime}
                                        onSelectTime={setNewTime}
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={closeEditModal}
                                    className="flex-1 py-2.5 bg-gray-100 rounded-lg text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    disabled={!newDate || !newTime}
                                    className="flex-1 py-2.5 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Confirmar Alteração
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
