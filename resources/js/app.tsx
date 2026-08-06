import i18n from '@/i18n';
import { createInertiaApp } from '@inertiajs/react';
import { I18nextProvider } from 'react-i18next';
import { type ReactNode, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import PosLayout from '@/layouts/pos-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

function I18nApp({ children }: { children: ReactNode }) {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const handler = () => forceUpdate((n) => n + 1);
        i18n.on('languageChanged', handler);
        return () => i18n.off('languageChanged', handler);
    }, []);
    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
            case name === 'pos':
            case name === 'bill':
            case name.startsWith('auth/'):
                return null;
            default:
                return PosLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <I18nApp>
                <TooltipProvider delayDuration={0}>
                    {app}
                    <Toaster />
                </TooltipProvider>
            </I18nApp>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
