interface HeroProps {
    logo?: string;
}

export function Hero({ logo }: HeroProps) {
    return (
        <div className="flex flex-col items-center py-12 px-4">
            <div className="flex flex-col sm:flex-row items-center gap-8 max-w-4xl w-full">
                {logo && (
                    <div className="w-48 h-48 flex-shrink-0 bg-white p-4 rounded-3xl shadow-lg border border-gray-100 flex items-center justify-center animate-in fade-in slide-in-from-left duration-700">
                        <img
                            src={logo}
                            alt="Company Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                )}
                <div className={logo ? "text-center sm:text-left" : "text-center w-full"}>
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                        Agende Seu Horário
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto sm:mx-0">
                        Escolha o melhor horário para você. Nosso processo de agendamento é simples e leva menos de um minuto.
                    </p>
                </div>
            </div>
        </div>
    );
}
