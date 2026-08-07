import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import PosShell from '@/components/pos-shell';
import { Store, Tag, Award, Package, ClipboardList, Settings, ChevronRight, Users, Banknote, BarChart3 } from 'lucide-react';

type MenuCard = {
    href: string;
    icon: React.ElementType;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    superadminOnly?: boolean;
};

export default function Menu() {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();

    const cards: MenuCard[] = [
        {
            href: '/outlets',
            icon: Store,
            label: t('menu.outletManagement'),
            description: t('menu.outletManagementDesc'),
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20 hover:border-emerald-500/50',
            superadminOnly: true,
        },
        {
            href: '/users',
            icon: Users,
            label: t('menu.userManagement'),
            description: t('menu.userManagementDesc'),
            color: 'text-rose-400',
            bgColor: 'bg-rose-500/10',
            borderColor: 'border-rose-500/20 hover:border-rose-500/50',
            superadminOnly: true,
        },
        {
            href: '/categories',
            icon: Tag,
            label: t('menu.categoryManagement'),
            description: t('menu.categoryManagementDesc'),
            color: 'text-violet-400',
            bgColor: 'bg-violet-500/10',
            borderColor: 'border-violet-500/20 hover:border-violet-500/50',
        },
        {
            href: '/brands',
            icon: Award,
            label: t('menu.brandManagement'),
            description: t('menu.brandManagementDesc'),
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/20 hover:border-amber-500/50',
        },
        {
            href: '/products',
            icon: Package,
            label: t('menu.productManagement'),
            description: t('menu.productManagementDesc'),
            color: 'text-sky-400',
            bgColor: 'bg-sky-500/10',
            borderColor: 'border-sky-500/20 hover:border-sky-500/50',
        },
        {
            href: '/orders',
            icon: ClipboardList,
            label: t('menu.orderManagement'),
            description: t('menu.orderManagementDesc'),
            color: 'text-teal-400',
            bgColor: 'bg-teal-500/10',
            borderColor: 'border-teal-500/20 hover:border-teal-500/50',
        },
        {
            href: '/cash-transfers',
            icon: Banknote,
            label: t('menu.cashTransfers'),
            description: t('menu.cashTransfersDesc'),
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20 hover:border-emerald-500/50',
        },
        {
            href: '/reports',
            icon: BarChart3,
            label: t('menu.reports'),
            description: t('menu.reportsDesc'),
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/20 hover:border-cyan-500/50',
        },
        {
            href: '/settings/profile',
            icon: Settings,
            label: t('settings.title'),
            description: t('menu.settingsDesc'),
            color: 'text-slate-300',
            bgColor: 'bg-slate-500/10',
            borderColor: 'border-slate-700 hover:border-slate-500',
        },
    ];

    const visibleCards = cards.filter(c => !c.superadminOnly || isSuperadmin);

    return (
        <PosShell activeNav="menu">
            <Head title={t('tabs.menu')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                <div>
                    <h2 className="text-base font-bold text-white">{t('tabs.menu')}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{t('menu.subtitle')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {visibleCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Link
                                key={card.href}
                                href={card.href}
                                className={`flex flex-col gap-3 rounded-3xl border bg-slate-900 p-5 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98] ${card.borderColor}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.bgColor}`}>
                                        <Icon className={`h-6 w-6 ${card.color}`} />
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-600 mt-1" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{card.description}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <div className="pt-2 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700">
                        {t('common.appName')} • {t('common.enterprisePos')}
                    </p>
                </div>
            </div>
        </PosShell>
    );
}
