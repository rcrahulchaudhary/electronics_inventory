import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { CheckCircle2, Image, Package, Pencil, Search, X } from 'lucide-react';
import PosShell from '@/components/pos-shell';
import Pagination from '@/components/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { useAuth } from '@/hooks/use-auth';
import * as ordersRoute from '@/routes/orders';

// ─── Types ───────────────────────────────────────────────────────────────────

type Outlet  = { id: number; name: string; code: string };
type Brand   = { id: number; name: string };
type Product = { id: number; name: string; model_number: string | null; brand: Brand };

type OrderItem = {
    id: number;
    product_id: number;
    price: string;
    quantity: string;
    warranty_card_url: string | null;
    product: Product;
};

type Payment = {
    id: number;
    advance_amount: string | null;
    remaining_amount: string | null;
    due_date: string | null;
    down_payment: string | null;
    installment_months: number | null;
    monthly_installment: string | null;
};

type Order = {
    id: number;
    customer_name: string | null;
    customer_mobile: string | null;
    customer_address: string | null;
    payment_type: 'cash' | 'cheque' | 'online' | 'credit' | 'installment';
    status: 'pending' | 'confirm' | 'dispatched' | 'delivered' | 'canceled';
    created_at: string;
    origin_outlet: Outlet;
    destination_outlet: Outlet;
    items: OrderItem[];
    payment: Payment | null;
};

type Props = {
    orders: Order[];
    outlets: Outlet[];
    flash?: { success?: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LIST = ['pending', 'confirm', 'dispatched', 'delivered', 'canceled'] as const;

const STATUS_COLORS: Record<string, string> = {
    pending:    'bg-amber-500/10   text-amber-400   border border-amber-500/20',
    confirm:    'bg-blue-500/10    text-blue-400    border border-blue-500/20',
    dispatched: 'bg-indigo-500/10  text-indigo-400  border border-indigo-500/20',
    delivered:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    canceled:   'bg-rose-500/10    text-rose-400    border border-rose-500/20',
};

const PAYMENT_COLORS: Record<string, string> = {
    cash:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cheque:      'bg-blue-500/10    text-blue-400    border-blue-500/20',
    online:      'bg-violet-500/10  text-violet-400  border-violet-500/20',
    credit:      'bg-amber-500/10   text-amber-400   border-amber-500/20',
    installment: 'bg-orange-500/10  text-orange-400  border-orange-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' });
};

const orderTotal = (o: Order) =>
    o.items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);

// ─── Main component ───────────────────────────────────────────────────────────

export default function Orders({ orders, outlets, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();

    // Deep-linked filters (e.g. from the Home dashboard cards) are seeded
    // from the URL on first render: ?status=pending, ?payment_type=credit
    const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

    const [search, setSearch]             = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(() => initialParams.get('status') ?? 'all');
    const [paymentFilter, setPaymentFilter] = useState<string>(() => initialParams.get('payment_type') ?? '');
    const [outletFilter, setOutletFilter] = useState<number | ''>('');
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [newStatus, setNewStatus]       = useState<string>('');

    const filtered = useMemo(() =>
        orders.filter(o => {
            const matchStatus = statusFilter === 'all' || o.status === statusFilter;
            const matchPayment = !paymentFilter || o.payment_type === paymentFilter;
            const matchOutlet = !outletFilter ||
                o.origin_outlet.id === outletFilter ||
                o.destination_outlet.id === outletFilter;
            const q = search.toLowerCase();
            const matchSearch = !q ||
                (o.customer_name ?? '').toLowerCase().includes(q) ||
                (o.customer_mobile ?? '').includes(q) ||
                o.items.some(i =>
                    i.product.name.toLowerCase().includes(q) ||
                    i.product.brand.name.toLowerCase().includes(q)
                ) ||
                String(o.id).includes(q);
            return matchStatus && matchPayment && matchOutlet && matchSearch;
        }),
    [orders, search, statusFilter, paymentFilter, outletFilter]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 10);

    const stats = useMemo(() => ({
        yetToDeliver: orders.filter(o => o.status === 'pending' || o.status === 'confirm').length,
        onProcess:    orders.filter(o => o.status === 'dispatched').length,
        delivered:    orders.filter(o => o.status === 'delivered').length,
    }), [orders]);

    const openStatusEdit = (order: Order) => {
        setEditingOrder(order);
        setNewStatus(order.status);
    };

    const handleStatusSave = () => {
        if (!editingOrder) return;
        router.put(ordersRoute.update(editingOrder.id).url, { status: newStatus }, {
            preserveScroll: true,
            onSuccess: () => setEditingOrder(null),
        });
    };

    return (
        <PosShell title={t('orderMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('orderMgmt.title')} />

            <div className="space-y-4 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setStatusFilter(s => s === 'pending' ? 'all' : 'pending')}
                        className={`rounded-2xl border p-3 text-center transition-all ${statusFilter === 'pending' ? 'border-amber-500/50 bg-amber-500/20' : 'border-amber-500/20 bg-amber-500/10 hover:border-amber-500/40'}`}>
                        <p className="text-lg font-black text-amber-400">{stats.yetToDeliver}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/70">{t('orderMgmt.yetToDeliver')}</p>
                    </button>
                    <button onClick={() => setStatusFilter(s => s === 'dispatched' ? 'all' : 'dispatched')}
                        className={`rounded-2xl border p-3 text-center transition-all ${statusFilter === 'dispatched' ? 'border-indigo-500/50 bg-indigo-500/20' : 'border-indigo-500/20 bg-indigo-500/10 hover:border-indigo-500/40'}`}>
                        <p className="text-lg font-black text-indigo-400">{stats.onProcess}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500/70">{t('orderMgmt.onProcess')}</p>
                    </button>
                    <button onClick={() => setStatusFilter(s => s === 'delivered' ? 'all' : 'delivered')}
                        className={`rounded-2xl border p-3 text-center transition-all ${statusFilter === 'delivered' ? 'border-emerald-500/50 bg-emerald-500/20' : 'border-emerald-500/20 bg-emerald-500/10 hover:border-emerald-500/40'}`}>
                        <p className="text-lg font-black text-emerald-400">{stats.delivered}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500/70">{t('orderMgmt.delivered')}</p>
                    </button>
                </div>

                {/* Filters */}
                <div className="space-y-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder={t('orderMgmt.searchPlaceholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3 text-xs text-slate-300 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {/* Status pills + outlet filter */}
                    <div className="flex items-center gap-2">
                        <div className="flex flex-1 space-x-1.5 overflow-x-auto pb-1">
                            {(['all', ...STATUS_LIST] as const).map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${statusFilter === s ? 'bg-indigo-600 text-white' : 'border border-slate-800 text-slate-400 hover:text-white'}`}>
                                    {s === 'all' ? t('common.all') : t(`orderMgmt.${s}`)}
                                </button>
                            ))}
                        </div>
                        {isSuperadmin && outlets.length > 0 && (
                            <select
                                value={outletFilter}
                                onChange={e => setOutletFilter(e.target.value ? Number(e.target.value) : '')}
                                className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 outline-none">
                                <option value="">{t('stockMgmt.allOutlets')}</option>
                                {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                            </select>
                        )}
                    </div>

                    {/* Active payment-type filter — set via deep link from Home's Credits card */}
                    {paymentFilter && (
                        <button onClick={() => setPaymentFilter('')}
                            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                            {t('orderMgmt.paymentType')}: {t(`orderMgmt.${paymentFilter}`)}
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Order list */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{t('orderMgmt.orderList')}</h3>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">{total}</span>
                </div>

                <div className="space-y-3">
                    {total === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
                                <Search className="h-5 w-5 text-slate-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">{t('orderMgmt.noOrders')}</p>
                        </div>
                    ) : paged.map(o => (
                        <div key={o.id} className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden">
                            {/* Card header */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-500">#{o.id}</span>
                                    <span className="text-slate-700">·</span>
                                    <span className="text-xs text-slate-500">{fmtDate(o.created_at)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYMENT_COLORS[o.payment_type]}`}>
                                        {t(`orderMgmt.${o.payment_type}`)}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[o.status]}`}>
                                        {t(`orderMgmt.${o.status}`)}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {/* Customer + outlet row */}
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {o.customer_name || <span className="font-normal italic text-slate-500">Walk-in customer</span>}
                                        </p>
                                        {(o.customer_mobile || o.customer_address) && (
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                {[o.customer_mobile, o.customer_address].filter(Boolean).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-right">
                                        <p className="text-[10px] font-semibold text-slate-400">
                                            {o.origin_outlet.code} → {o.destination_outlet.code}
                                        </p>
                                        <p className="text-[10px] text-slate-600 truncate max-w-[140px]">
                                            {o.destination_outlet.name}
                                        </p>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 divide-y divide-slate-800/60">
                                    {o.items.map(item => (
                                        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                                                <Package className="h-3.5 w-3.5 text-slate-500" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-slate-200">
                                                    {item.product.brand.name} {item.product.name}
                                                    {item.product.model_number && <span className="ml-1 text-slate-500">({item.product.model_number})</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {fmt(Number(item.price))} × {Number(item.quantity).toLocaleString()} {t('common.qty').toLowerCase()}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                {item.warranty_card_url && (
                                                    <a href={item.warranty_card_url} target="_blank" rel="noreferrer"
                                                        className="flex items-center gap-1 rounded-lg border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-indigo-400 transition-colors">
                                                        <Image className="h-2.5 w-2.5" /> {t('orderMgmt.warranty')}
                                                    </a>
                                                )}
                                                <p className="text-xs font-bold text-indigo-400 tabular-nums">
                                                    {fmt(Number(item.price) * Number(item.quantity))}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Payment details */}
                                {o.payment && o.payment_type === 'credit' && (
                                    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 space-y-0.5">
                                        <p>
                                            {t('orderMgmt.advance')}: <span className="font-semibold">{fmt(Number(o.payment.advance_amount ?? 0))}</span>
                                            {' · '}
                                            {t('orderMgmt.due')}: <span className="font-semibold">{fmt(Number(o.payment.remaining_amount ?? 0))}</span>
                                        </p>
                                        {o.payment.due_date && (
                                            <p>{t('orderMgmt.dueDateLabel')}: <span className="font-semibold">{o.payment.due_date}</span></p>
                                        )}
                                    </div>
                                )}
                                {o.payment && o.payment_type === 'installment' && (
                                    <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 px-3 py-2 text-xs text-orange-400 space-y-0.5">
                                        <p>
                                            {t('orderMgmt.down')}: <span className="font-semibold">{fmt(Number(o.payment.down_payment ?? 0))}</span>
                                            {' · '}
                                            {o.payment.installment_months}mo × <span className="font-semibold">{fmt(Number(o.payment.monthly_installment ?? 0))}/mo</span>
                                        </p>
                                    </div>
                                )}

                                {/* Footer: total + action */}
                                <div className="flex items-center justify-between pt-1">
                                    <div>
                                        <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold">
                                            {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                                        </p>
                                        <p className="text-base font-black text-white tabular-nums">{fmt(orderTotal(o))}</p>
                                    </div>
                                    <button onClick={() => openStatusEdit(o)}
                                        className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-700 hover:text-indigo-400">
                                        <Pencil className="h-3 w-3" /> {t('orderMgmt.updateStatus')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Pagination page={page} totalPages={totalPages} total={total} perPage={10} onPage={goTo} />
            </div>

            {/* Status edit modal */}
            {editingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                                    <Pencil className="h-4 w-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="font-black text-white">{t('orderMgmt.updateStatus')}</h2>
                                    <p className="text-xs text-slate-500">
                                        #{editingOrder.id} · {editingOrder.items.length} {editingOrder.items.length === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setEditingOrder(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3 px-6 py-5">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                                <p className="font-semibold text-white">
                                    {editingOrder.customer_name || <span className="font-normal italic text-slate-500">Walk-in customer</span>}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {editingOrder.origin_outlet.code} → {editingOrder.destination_outlet.code}
                                    {' · '}{fmt(orderTotal(editingOrder))}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                                {STATUS_LIST.map(s => (
                                    <button key={s} onClick={() => setNewStatus(s)}
                                        className={`flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all ${newStatus === s ? 'bg-indigo-600 text-white' : 'border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-white'}`}>
                                        <span>{t(`orderMgmt.${s}`)}</span>
                                        {newStatus === s && <span className="h-1.5 w-1.5 rounded-full bg-white/60" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-800 px-6 py-4">
                            <button onClick={handleStatusSave}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98]">
                                {t('orderMgmt.updateStatus')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PosShell>
    );
}
