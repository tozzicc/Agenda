import { Calendar } from 'lucide-react';

export function Header() {
    return (
        <header className="w-full py-6 px-4 sm:px-8 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-lg">
                <Calendar className="w-6 h-6" />
                <span>Agenda</span>
            </div>
            <a href="#" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">Help</a>
        </header>
    );
}
