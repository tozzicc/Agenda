import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface Settings {
    start: string;
    end: string;
    interval: number;
    allow_saturday: boolean;
    allow_sunday: boolean;
    blockedPeriods: { start: string; end: string }[];
    adminEmail: string;
    enable_lunch: boolean;
    lunch_start: string;
    lunch_end: string;
    appLogo: string;
    companyName: string;
    whatsappNumber: string;
    demoMode: boolean;
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
    start: '09:00',
    end: '17:00',
    interval: 30,
    allow_saturday: false,
    allow_sunday: false,
    blockedPeriods: [],
    adminEmail: '',
    enable_lunch: false,
    lunch_start: '12:00',
    lunch_end: '13:00',
    appLogo: '',
    companyName: 'Agenda',
    whatsappNumber: '',
    demoMode: false
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings/schedule');
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    start: data.start,
                    end: data.end,
                    interval: data.interval,
                    allow_saturday: data.allow_saturday,
                    allow_sunday: data.allow_sunday,
                    blockedPeriods: data.blockedPeriods || [],
                    adminEmail: data.adminEmail || '',
                    enable_lunch: data.enable_lunch,
                    lunch_start: data.lunch_start || '12:00',
                    lunch_end: data.lunch_end || '13:00',
                    appLogo: data.appLogo || '',
                    companyName: data.companyName?.trim() || 'Agenda',
                    whatsappNumber: data.whatsappNumber || '',
                    demoMode: data.demoMode === true
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        document.title = settings.companyName || 'Agenda';
    }, [settings.companyName]);

    const refreshSettings = async () => {
        await fetchSettings();
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
