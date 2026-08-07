import { Link } from '@inertiajs/react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Banknote, Home, Menu, Power, ShoppingCart, Warehouse, Wrench,
    Store, Tag, Award, Package, ClipboardList, Settings, Sun, Moon, Users,
} from 'lucide-react';
import LanguageSwitcher from '@/components/language-switcher';
import { logout } from '@/routes';
import { useAuth } from '@/hooks/use-auth';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useAppearance } from '@/hooks/use-appearance';

type ActiveNav = 'home' | 'store' | 'pos' | 'maintenance' | 'menu';

type Props = {
    children: ReactNode;
    title?: string;
    backHref?: string;
    activeNav?: ActiveNav;
};

const NAV_ITEMS = (t: (k: string) => string) => [
    { href: '/home',         nav: 'home'        as ActiveNav, icon: Home,         label: () => t('tabs.home') },
    { href: '/stocks',       nav: 'store'       as ActiveNav, icon: Warehouse,    label: () => t('tabs.store') },
    { href: '/pos',          nav: 'pos'         as ActiveNav, icon: ShoppingCart, label: () => t('tabs.pos') },
    { href: '/maintenances', nav: 'maintenance' as ActiveNav, icon: Wrench,       label: () => t('tabs.maintenance') },
    { href: '/menu',         nav: 'menu'        as ActiveNav, icon: Menu,         label: () => t('tabs.menu') },
];

const MENU_SUB_ITEMS = (t: (k: string) => string, isSuperadmin: boolean) =>
    [
        { href: '/outlets',         icon: Store,         label: () => t('menu.outletManagement'),  superadminOnly: true },
        { href: '/users',           icon: Users,         label: () => t('menu.userManagement'),    superadminOnly: true },
        { href: '/categories',      icon: Tag,           label: () => t('menu.categoryManagement') },
        { href: '/brands',          icon: Award,         label: () => t('menu.brandManagement') },
        { href: '/products',        icon: Package,       label: () => t('menu.productManagement') },
        { href: '/orders',          icon: ClipboardList, label: () => t('menu.orderManagement') },
        { href: '/cash-transfers',  icon: Banknote,      label: () => t('menu.cashTransfers') },
        { href: '/settings/profile',icon: Settings,      label: () => t('settings.title') },
    ].filter(item => !('superadminOnly' in item && item.superadminOnly && !isSuperadmin));

export default function PosShell({ children, title, backHref, activeNav = 'menu' }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    const { resolvedAppearance, updateAppearance } = useAppearance();
    const navItems = NAV_ITEMS(t);
    const menuSubItems = MENU_SUB_ITEMS(t, isSuperadmin);
    const roleLabel = isSuperadmin ? t('auth.superadmin') : t('auth.outletAdmin');

    return (
        <div className="flex h-full w-full overflow-hidden">

            {/* ── Sidebar — hidden below md, icon-only on md, full on lg ── */}
            <aside className="hidden md:flex w-14 shrink-0 flex-col border-r border-slate-800 bg-slate-900 lg:w-60">

                {/* Brand */}
                <div className="flex items-center gap-3 border-b border-slate-800 px-3 py-4 lg:px-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white shadow-lg shadow-indigo-600/30">
                        SE
                    </div>
                    <div className="hidden lg:block">
                        <h1 className="text-sm font-black leading-none text-white">
                            {t('common.appName')}
                        </h1>
                        <span className="mt-1 inline-block rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-indigo-300">
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 space-y-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}>
                    {navItems.map(({ href, nav, icon: Icon, label }) => (
                        <Link
                            key={nav}
                            href={href}
                            title={label()}
                            className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-all lg:px-3 ${nav === 'menu' ? 'lg:hidden' : ''} ${
                                activeNav === nav
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <Icon className="h-[18px] w-[18px] shrink-0" />
                            <span className="hidden text-sm font-semibold lg:block">{label()}</span>
                        </Link>
                    ))}

                    {/* Menu sub-items — lg screens only */}
                    <div className="hidden lg:block">
                        <p className="mt-3 mb-1 px-3 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                            {t('tabs.menu')}
                        </p>
                        {menuSubItems.map(({ href, icon: Icon, label }) => (
                            <Link
                                key={href}
                                href={href}
                                title={label()}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
                                    isCurrentOrParentUrl(href)
                                        ? 'bg-slate-800 font-semibold text-white'
                                        : 'font-medium text-slate-500 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {label()}
                            </Link>
                        ))}
                    </div>
                </nav>
            </aside>

            {/* ── Main area ────────────────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

                {/* Header */}
                <header className="z-30 flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-3.5 backdrop-blur-lg">
                    <div className="flex items-center gap-3">
                        {backHref && (
                            <Link
                                href={backHref}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/60 text-slate-400 transition-all hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        )}
                        <h2 className={`text-sm font-bold text-white ${!title ? 'lg:hidden' : ''}`}>
                            {title ?? t('common.appName')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')}
                            title={resolvedAppearance === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/60 text-slate-400 transition-all hover:text-white"
                        >
                            {resolvedAppearance === 'dark'
                                ? <Sun className="h-4 w-4" />
                                : <Moon className="h-4 w-4" />}
                        </button>
                        <LanguageSwitcher />
                        <Link
                            href={logout()}
                            as="button"
                            method="post"
                            title={t('common.logout')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/60 text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
                        >
                            <Power className="h-4 w-4" />
                        </Link>
                    </div>
                </header>

                {/* Scrollable content */}
                <main
                    className="flex-1 overflow-y-auto"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}
                >
                    {children}
                </main>

                {/* Footer nav — below md only */}
                <nav className="z-30 flex h-16 shrink-0 items-stretch border-t border-slate-800 bg-slate-900 shadow-2xl md:hidden">
                    {navItems.map(({ href, nav, icon: Icon, label }) => (
                        <Link
                            key={nav}
                            href={href}
                            className={`flex flex-1 flex-col items-center justify-center border-t-2 transition-all ${
                                activeNav === nav
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Icon className="h-[18px] w-[18px]" />
                            <span className="mt-0.5 text-[9px] font-bold tracking-tight">{label()}</span>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}
