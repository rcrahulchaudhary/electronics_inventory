import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Banknote, ClipboardList, CreditCard, Image, Package,
    ShoppingBag, Wrench, X,
} from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import PosShell from '@/components/pos-shell';
import { useAuth } from '@/hooks/use-auth';
import * as reportsCreditRoute from '@/routes/reports/credit';
import * as ordersRoute from '@/routes/orders';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

// ─── Shared types ───────────────────────────────────────────────────────────────

type Outlet   = { id: number; name: string; code: string };
type Brand     = { id: number; name: string };
type Category  = { id: number; name: string };
type Product   = { id: number; name: string; brand_id: number; category_id: number };
type StaffRef  = { id: number; name: string };

type ReportType = 'sales' | 'inventory' | 'credit' | 'orders' | 'cashflow' | 'maintenance';

const STATUS_LIST = ['pending', 'confirm', 'dispatched', 'delivered', 'canceled'] as const;
const STATUS_COLORS: Record<string, string> = {
    pending:    'bg-amber-500/10   text-amber-400   border border-amber-500/20',
    confirm:    'bg-blue-500/10    text-blue-400    border border-blue-500/20',
    dispatched: 'bg-indigo-500/10  text-indigo-400  border border-indigo-500/20',
    delivered:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    canceled:   'bg-rose-500/10    text-rose-400    border border-rose-500/20',
};

const fmt = (n: number) =>
    `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' });
};

// ─── Report-specific types ───────────────────────────────────────────────────────

type SalesItem = {
    id: number; price: string; quantity: string; warranty_card_url: string | null;
    product: { id: number; name: string; model_number: string | null; brand: { name: string }; category: { name: string } };
    order: { id: number; bill_number: string; customer_name: string | null; customer_mobile: string | null; created_at: string; destination_outlet: Outlet };
};

type StockRow = {
    id: number; quantity: string; updated_at: string;
    product: { name: string; model_number: string | null; brand: { name: string }; category: { name: string } };
    outlet: Outlet;
};

type CreditRow = {
    order: {
        id: number; bill_number: string; customer_name: string | null; customer_mobile: string | null; created_at: string;
        payment_type: string; destination_outlet: Outlet; payment: { id: number; remaining_amount: string; advance_amount: string | null; due_date: string | null } | null;
    };
    remaining: number;
    daysLeft: number | null;
    bucket: 'settled' | 'no_due_date' | 'overdue' | 'due_7' | 'due_14' | 'due_30' | 'due_later';
};

type OrderRow = {
    id: number; bill_number: string; customer_name: string | null; status: string; created_at: string;
    items: { id: number; price: string; quantity: string; product: { name: string; brand: { name: string } } }[];
    origin_outlet: Outlet; destination_outlet: Outlet;
};

type CashflowRow = {
    id: number; sender_type: string; receiver_type: string; amount: string; status: string; remarks: string | null; created_at: string;
    sender: (StaffRef & { outlet: Outlet | null }) | null;
    receiver: (StaffRef & { outlet: Outlet | null }) | null;
};

type MaintenanceRow = {
    id: number; product_name: string; product_model: string | null; customer_name: string; customer_mobile: string;
    case_type: string; status: string; created_at: string; outlet: Outlet;
};

type Props = {
    type: ReportType;
    outletId: number | null;
    outlets: Outlet[];
    products: Product[];
    brands: Brand[];
    categories: Category[];
    staff: StaffRef[];
    flash?: { success?: string };
    sales?: { items: SalesItem[]; totalAmount: number; totalQty: number; count: number };
    inventory?: { items: StockRow[]; totalQty: number; count: number };
    credit?: { rows: CreditRow[]; totalOutstanding: number; count: number };
    orders?: { items: OrderRow[]; count: number };
    cashflow?: { items: CashflowRow[]; count: number };
    maintenance?: { items: MaintenanceRow[]; count: number };
};

const TABS: { key: ReportType; icon: React.ElementType; label: string }[] = [
    { key: 'sales',       icon: ShoppingBag,   label: 'reports.tabSales' },
    { key: 'inventory',   icon: Package,       label: 'reports.tabInventory' },
    { key: 'credit',      icon: CreditCard,    label: 'reports.tabCredit' },
    { key: 'orders',      icon: ClipboardList, label: 'reports.tabOrders' },
    { key: 'cashflow',    icon: Banknote,      label: 'reports.tabCashflow' },
    { key: 'maintenance', icon: Wrench,        label: 'reports.tabMaintenance' },
];

// ─── Small shared UI ─────────────────────────────────────────────────────────────

function FilterShell({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{children}</div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            {children}
        </div>
    );
}

const selectCls = 'w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20';
const inputCls  = selectCls;

const TOOLTIP_STYLE = {
    backgroundColor: 'rgba(15,23,42,0.95)',
    titleColor: '#94a3b8',
    bodyColor: '#f1f5f9',
    borderColor: '#334155',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
};

// ─── Chart components ─────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
            {children}
        </div>
    );
}

function TrendChart({ labels, values, valueFmt }: { labels: string[]; values: number[]; valueFmt: (n: number) => string }) {
    if (labels.length < 2) return null;

    return (
        <div style={{ height: 200 }}>
            <Line
                data={{
                    labels,
                    datasets: [{
                        data: values,
                        borderColor: '#818cf8',
                        borderWidth: 2.5,
                        fill: true,
                        backgroundColor: (context: { chart: ChartJS }) => {
                            const { ctx, chartArea } = context.chart;
                            if (!chartArea) return 'rgba(99,102,241,0.1)';
                            const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            grad.addColorStop(0, 'rgba(99,102,241,0.35)');
                            grad.addColorStop(1, 'rgba(99,102,241,0.02)');
                            return grad;
                        },
                        pointRadius: labels.length <= 20 ? 2.5 : 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#818cf8',
                        pointBackgroundColor: 'rgba(129,140,248,0.7)',
                        tension: 0.35,
                    }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...TOOLTIP_STYLE, callbacks: { label: ctx => ` ${valueFmt(Number(ctx.raw))}` } },
                    },
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.08)' } },
                    },
                }}
            />
        </div>
    );
}

function DonutChart({ labels, values, colors }: { labels: string[]; values: number[]; colors: string[] }) {
    if (values.every(v => v === 0)) return null;

    return (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div style={{ height: 140, width: 140 }} className="shrink-0">
                <Doughnut
                    data={{ labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#0f172a', hoverOffset: 6 }] }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_STYLE, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } },
                    }}
                />
            </div>
            <div className="w-full space-y-1.5">
                {labels.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i] }} />
                        <span className="flex-1 text-xs text-slate-400">{label}</span>
                        <span className="text-xs font-bold text-slate-200 tabular-nums">{values[i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BarChartCard({ labels, values }: { labels: string[]; values: number[] }) {
    if (labels.length === 0) return null;

    return (
        <div style={{ height: 220 }}>
            <Bar
                data={{ labels, datasets: [{ data: values, backgroundColor: '#818cf8', borderRadius: 6, maxBarThickness: 36 }] }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...TOOLTIP_STYLE, callbacks: { label: ctx => ` ${ctx.raw}` } },
                    },
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.08)' } },
                    },
                }}
            />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reports(props: Props) {
    const { type, outletId, outlets, products, brands, categories, staff, flash } = props;
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();

    const qs = new URLSearchParams(window.location.search);
    const [dateFrom, setDateFrom] = useState(qs.get('date_from') ?? '');
    const [dateTo, setDateTo]     = useState(qs.get('date_to') ?? '');
    const [customer, setCustomer] = useState(qs.get('customer') ?? '');
    const [productId, setProductId]   = useState(qs.get('product_id') ?? '');
    const [categoryId, setCategoryId] = useState(qs.get('category_id') ?? '');
    const [brandId, setBrandId]       = useState(qs.get('brand_id') ?? '');
    const [status, setStatus]         = useState(qs.get('status') ?? '');
    const [staffId, setStaffId]       = useState(qs.get('staff_id') ?? '');
    const [productSearch, setProductSearch] = useState(qs.get('product') ?? '');
    const [billId, setBillId]         = useState(qs.get('bill_id') ?? '');
    const [selectedOutlet, setSelectedOutlet] = useState(outletId ?? '');

    const goTo = (nextType: ReportType, extra: Record<string, string> = {}) => {
        const params: Record<string, string> = { type: nextType };
        if (selectedOutlet) params.outlet_id = String(selectedOutlet);
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        router.get('/reports', { ...params, ...extra }, { preserveState: false });
    };

    const applyFilters = () => {
        const params: Record<string, string> = { type };
        if (selectedOutlet) params.outlet_id = String(selectedOutlet);
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (customer) params.customer = customer;
        if (productId) params.product_id = productId;
        if (categoryId) params.category_id = categoryId;
        if (brandId) params.brand_id = brandId;
        if (status) params.status = status;
        if (staffId) params.staff_id = staffId;
        if (productSearch) params.product = productSearch;
        if (billId) params.bill_id = billId;
        router.get('/reports', params, { preserveState: false });
    };

    const resetFilters = () => {
        setDateFrom(''); setDateTo(''); setCustomer(''); setProductId(''); setCategoryId('');
        setBrandId(''); setStatus(''); setStaffId(''); setProductSearch(''); setBillId('');
        router.get('/reports', { type }, { preserveState: false });
    };

    const handleStatusChange = (orderId: number, newStatus: string) => {
        router.put(ordersRoute.update(orderId).url, { status: newStatus }, { preserveScroll: true });
    };

    const handleSettle = (paymentId: number) => {
        router.post(reportsCreditRoute.settle(paymentId).url, {}, { preserveScroll: true });
    };

    return (
        <PosShell title={t('reports.title')} backHref="/menu" activeNav="menu">
            <Head title={t('reports.title')} />

            <div className="space-y-5 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        {flash.success}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => goTo(tab.key)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                                    type === tab.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" /> {t(tab.label)}
                            </button>
                        );
                    })}
                </div>

                {/* Filters */}
                <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                    <FilterShell>
                        {isSuperadmin && (
                            <FilterField label={t('reports.outlet')}>
                                <select className={selectCls} value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)}>
                                    <option value="">{t('stockMgmt.allOutlets')}</option>
                                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                </select>
                            </FilterField>
                        )}
                        <FilterField label={t('reports.startDate')}>
                            <input type="date" className={inputCls} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </FilterField>
                        <FilterField label={t('reports.endDate')}>
                            <input type="date" className={inputCls} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </FilterField>

                        {(type === 'sales' || type === 'credit') && (
                            <FilterField label={t('reports.customer')}>
                                <input className={inputCls} placeholder={t('reports.customerPlaceholder')} value={customer} onChange={e => setCustomer(e.target.value)} />
                            </FilterField>
                        )}

                        {(type === 'sales' || type === 'inventory' || type === 'credit') && (
                            <>
                                <FilterField label={t('reports.product')}>
                                    <select className={selectCls} value={productId} onChange={e => setProductId(e.target.value)}>
                                        <option value="">{t('common.all')}</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </FilterField>
                                <FilterField label={t('reports.category')}>
                                    <select className={selectCls} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                        <option value="">{t('common.all')}</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </FilterField>
                                <FilterField label={t('reports.brand')}>
                                    <select className={selectCls} value={brandId} onChange={e => setBrandId(e.target.value)}>
                                        <option value="">{t('common.all')}</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </FilterField>
                            </>
                        )}

                        {type === 'orders' && (
                            <FilterField label={t('orderMgmt.statusLabel')}>
                                <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="">{t('common.all')}</option>
                                    {STATUS_LIST.map(s => <option key={s} value={s}>{t(`orderMgmt.${s}`)}</option>)}
                                </select>
                            </FilterField>
                        )}

                        {type === 'cashflow' && isSuperadmin && (
                            <FilterField label={t('reports.staff')}>
                                <select className={selectCls} value={staffId} onChange={e => setStaffId(e.target.value)}>
                                    <option value="">{t('common.all')}</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </FilterField>
                        )}

                        {type === 'maintenance' && (
                            <>
                                <FilterField label={t('reports.customer')}>
                                    <input className={inputCls} placeholder={t('reports.customerPlaceholder')} value={customer} onChange={e => setCustomer(e.target.value)} />
                                </FilterField>
                                <FilterField label={t('orderMgmt.product')}>
                                    <input className={inputCls} placeholder={t('reports.productSearchPlaceholder')} value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                </FilterField>
                                <FilterField label={t('reports.billId')}>
                                    <input className={inputCls} placeholder="#" value={billId} onChange={e => setBillId(e.target.value)} />
                                </FilterField>
                            </>
                        )}
                    </FilterShell>

                    <div className="flex gap-2 pt-1">
                        <button onClick={applyFilters} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]">
                            {t('reports.applyFilter')}
                        </button>
                        <button onClick={resetFilters} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-400 transition-all hover:text-white">
                            {t('reports.resetFilter')}
                        </button>
                    </div>
                </div>

                {/* ── Sales ── */}
                {type === 'sales' && props.sales && (
                    <SalesTab data={props.sales} t={t} />
                )}

                {/* ── Inventory ── */}
                {type === 'inventory' && props.inventory && (
                    <InventoryTab data={props.inventory} t={t} />
                )}

                {/* ── Credit ── */}
                {type === 'credit' && props.credit && (
                    <CreditTab data={props.credit} t={t} onSettle={handleSettle} />
                )}

                {/* ── Orders ── */}
                {type === 'orders' && props.orders && (
                    <OrdersTab data={props.orders} t={t} onStatusChange={handleStatusChange} />
                )}

                {/* ── Cashflow ── */}
                {type === 'cashflow' && props.cashflow && (
                    <CashflowTab data={props.cashflow} t={t} />
                )}

                {/* ── Maintenance ── */}
                {type === 'maintenance' && props.maintenance && (
                    <MaintenanceTab data={props.maintenance} t={t} />
                )}
            </div>
        </PosShell>
    );
}

// ─── Sales tab ───────────────────────────────────────────────────────────────

function SalesTab({ data, t }: { data: NonNullable<Props['sales']>; t: (k: string, opts?: Record<string, unknown>) => string }) {
    const trend = useMemo(() => {
        const byDay = new Map<string, number>();
        for (const item of data.items) {
            const day = item.order.created_at.slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + Number(item.price) * Number(item.quantity));
        }
        const days = [...byDay.keys()].sort();
        return { labels: days, values: days.map(d => byDay.get(d)!) };
    }, [data.items]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <StatCard label={t('reports.totalSales')} value={fmt(data.totalAmount)} color="emerald" />
                <StatCard label={t('reports.totalQty')} value={String(data.totalQty)} color="indigo" />
                <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            </div>
            {trend.labels.length >= 2 && (
                <ChartCard title={t('reports.chartSalesTrend')}>
                    <TrendChart labels={trend.labels} values={trend.values} valueFmt={fmt} />
                </ChartCard>
            )}
            <div className="space-y-2">
                {data.items.length === 0 ? <EmptyState t={t} /> : data.items.map(item => (
                    <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500">{item.order.bill_number}</p>
                            <p className="text-xs text-slate-500">{fmtDate(item.order.created_at)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">
                                    {item.product.brand.name} {item.product.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {item.product.category.name} · {item.order.customer_name || t('common.walkIn')} · {item.order.destination_outlet.code}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-black text-white">{fmt(Number(item.price) * Number(item.quantity))}</p>
                                <p className="text-[10px] text-slate-500">{item.quantity} × {fmt(Number(item.price))}</p>
                            </div>
                        </div>
                        {item.warranty_card_url && (
                            <a href={item.warranty_card_url} target="_blank" rel="noreferrer"
                                className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">
                                <Image className="h-3 w-3" /> {t('reports.downloadWarranty')}
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Inventory tab ───────────────────────────────────────────────────────────

function InventoryTab({ data, t }: { data: NonNullable<Props['inventory']>; t: (k: string, opts?: Record<string, unknown>) => string }) {
    const byCategory = useMemo(() => {
        const totals = new Map<string, number>();
        for (const s of data.items) {
            totals.set(s.product.category.name, (totals.get(s.product.category.name) ?? 0) + Number(s.quantity));
        }
        const labels = [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)!);
        return { labels, values: labels.map(l => totals.get(l)!) };
    }, [data.items]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <StatCard label={t('reports.totalQty')} value={String(data.totalQty)} color="indigo" />
                <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            </div>
            {byCategory.labels.length > 0 && (
                <ChartCard title={t('reports.chartQtyByCategory')}>
                    <BarChartCard labels={byCategory.labels} values={byCategory.values} />
                </ChartCard>
            )}
            <div className="space-y-2">
                {data.items.length === 0 ? <EmptyState t={t} /> : data.items.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{s.product.brand.name} {s.product.name}</p>
                            <p className="text-xs text-slate-500">{s.product.category.name} · {s.outlet.code}{s.product.model_number ? ` · ${s.product.model_number}` : ''}</p>
                        </div>
                        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-black ${Number(s.quantity) > 2 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {Number(s.quantity).toLocaleString()} {t('stock.pcs')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Credit tab ───────────────────────────────────────────────────────────────

const BUCKET_LABEL: Record<string, string> = {
    settled: 'reports.bucketSettled',
    no_due_date: 'reports.bucketNoDueDate',
    overdue: 'reports.bucketOverdue',
    due_7: 'reports.bucketDue7',
    due_14: 'reports.bucketDue14',
    due_30: 'reports.bucketDue30',
    due_later: 'reports.bucketDueLater',
};
const BUCKET_COLOR: Record<string, string> = {
    settled: 'bg-emerald-500/10 text-emerald-400',
    no_due_date: 'bg-slate-700 text-slate-300',
    overdue: 'bg-rose-500/10 text-rose-400',
    due_7: 'bg-rose-500/10 text-rose-400',
    due_14: 'bg-amber-500/10 text-amber-400',
    due_30: 'bg-amber-500/10 text-amber-400',
    due_later: 'bg-blue-500/10 text-blue-400',
};
const BUCKET_HEX: Record<string, string> = {
    settled: '#10b981',
    no_due_date: '#64748b',
    overdue: '#f43f5e',
    due_7: '#fb7185',
    due_14: '#f59e0b',
    due_30: '#fbbf24',
    due_later: '#3b82f6',
};

function CreditTab({ data, t, onSettle }: { data: NonNullable<Props['credit']>; t: (k: string, opts?: Record<string, unknown>) => string; onSettle: (id: number) => void }) {
    const buckets = useMemo(() => {
        const counts = new Map<string, number>();
        for (const row of data.rows) counts.set(row.bucket, (counts.get(row.bucket) ?? 0) + 1);
        const keys = [...counts.keys()];
        return { labels: keys.map(k => t(BUCKET_LABEL[k])), values: keys.map(k => counts.get(k)!), colors: keys.map(k => BUCKET_HEX[k]) };
    }, [data.rows, t]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <StatCard label={t('reports.totalDue')} value={fmt(data.totalOutstanding)} color="rose" />
                <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            </div>
            {buckets.labels.length > 0 && (
                <ChartCard title={t('reports.chartDueBuckets')}>
                    <DonutChart labels={buckets.labels} values={buckets.values} colors={buckets.colors} />
                </ChartCard>
            )}
            <div className="space-y-2">
                {data.rows.length === 0 ? <EmptyState t={t} /> : data.rows.map(row => (
                    <div key={row.order.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500">{row.order.bill_number}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BUCKET_COLOR[row.bucket]}`}>
                                {t(BUCKET_LABEL[row.bucket])}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{row.order.customer_name || t('common.walkIn')}</p>
                                <p className="text-xs text-slate-500">
                                    {row.order.destination_outlet.code} · {fmtDate(row.order.created_at)}
                                    {row.order.payment?.due_date && ` · ${t('orderMgmt.dueDateLabel')}: ${row.order.payment.due_date}`}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-black text-white">{fmt(row.remaining)}</p>
                                {row.daysLeft !== null && row.remaining > 0 && (
                                    <p className="text-[10px] text-slate-500">
                                        {row.daysLeft < 0 ? t('reports.daysOverdue', { count: Math.abs(row.daysLeft) } as never) : t('reports.daysLeft', { count: row.daysLeft } as never)}
                                    </p>
                                )}
                            </div>
                        </div>
                        {row.remaining > 0 && row.order.payment && (
                            <button onClick={() => onSettle(row.order.payment!.id)}
                                className="mt-3 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98]">
                                {t('reports.markSettled')}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Orders tab ───────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
    pending: '#f59e0b', confirm: '#3b82f6', dispatched: '#6366f1', delivered: '#10b981', canceled: '#f43f5e',
};

function OrdersTab({ data, t, onStatusChange }: { data: NonNullable<Props['orders']>; t: (k: string, opts?: Record<string, unknown>) => string; onStatusChange: (id: number, status: string) => void }) {
    const byStatus = useMemo(() => {
        const counts = new Map<string, number>();
        for (const o of data.items) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
        const keys = [...counts.keys()];
        return { labels: keys.map(k => t(`orderMgmt.${k}`)), values: keys.map(k => counts.get(k)!), colors: keys.map(k => STATUS_HEX[k] ?? '#475569') };
    }, [data.items, t]);

    return (
        <div className="space-y-4">
            <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            {byStatus.labels.length > 0 && (
                <ChartCard title={t('reports.chartOrdersByStatus')}>
                    <DonutChart labels={byStatus.labels} values={byStatus.values} colors={byStatus.colors} />
                </ChartCard>
            )}
            <div className="space-y-2">
                {data.items.length === 0 ? <EmptyState t={t} /> : data.items.map(order => (
                    <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500">{order.bill_number}</p>
                            <p className="text-xs text-slate-500">{fmtDate(order.created_at)}</p>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-white">{order.customer_name || t('common.walkIn')}</p>
                        <p className="text-xs text-slate-500">{order.origin_outlet.code} → {order.destination_outlet.code}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {STATUS_LIST.map(s => (
                                <button key={s} onClick={() => onStatusChange(order.id, s)}
                                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${order.status === s ? STATUS_COLORS[s] : 'border border-slate-800 text-slate-500 hover:text-white'}`}>
                                    {t(`orderMgmt.${s}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Cashflow tab (timeline) ──────────────────────────────────────────────────

function partyLine(type: string, ref: (StaffRef & { outlet: Outlet | null }) | null, t: (k: string, opts?: Record<string, unknown>) => string) {
    if (type === 'bank') return t('cashMgmt.bank');
    return ref?.name ?? t('cashMgmt.pendingAdmin');
}

function CashflowTab({ data, t }: { data: NonNullable<Props['cashflow']>; t: (k: string, opts?: Record<string, unknown>) => string }) {
    const trend = useMemo(() => {
        const byDay = new Map<string, number>();
        for (const tr of data.items) {
            const day = tr.created_at.slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + Number(tr.amount));
        }
        const days = [...byDay.keys()].sort();
        return { labels: days, values: days.map(d => byDay.get(d)!) };
    }, [data.items]);

    return (
        <div className="space-y-4">
            <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            {trend.labels.length >= 2 && (
                <ChartCard title={t('reports.chartCashflowTrend')}>
                    <TrendChart labels={trend.labels} values={trend.values} valueFmt={fmt} />
                </ChartCard>
            )}
            {data.items.length === 0 ? <EmptyState t={t} /> : (
                <div className="relative space-y-4 border-l-2 border-dashed border-slate-800 pl-6">
                    {data.items.map(tr => (
                        <div key={tr.id} className="relative rounded-2xl border border-slate-800 bg-slate-900 p-4">
                            <span className="absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-white">
                                    {partyLine(tr.sender_type, tr.sender, t)} → {partyLine(tr.receiver_type, tr.receiver, t)}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tr.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {t(`cashMgmt.status_${tr.status}`)}
                                </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <p className="text-xs text-slate-500">{fmtDate(tr.created_at)}</p>
                                <p className="text-sm font-black text-white">{fmt(Number(tr.amount))}</p>
                            </div>
                            {tr.remarks && <p className="mt-1 text-xs text-slate-500">{tr.remarks}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Maintenance tab ──────────────────────────────────────────────────────────

const CASE_TYPE_KEY: Record<string, string> = {
    warranty_repair: 'maintenance.warrantyRepairLabel',
    exchange_return: 'maintenance.exchangeReturnLabel',
    paid_service:    'maintenance.paidServiceLabel',
};
const MAINT_STATUS_KEY: Record<string, string> = {
    received:    'maintenance.received',
    in_progress: 'maintenance.inProgress',
    resolved:    'maintenance.resolved',
    returned:    'maintenance.returned',
    canceled:    'maintenance.canceled',
};
const MAINT_STATUS_HEX: Record<string, string> = {
    received: '#3b82f6', in_progress: '#f59e0b', resolved: '#10b981', returned: '#8b5cf6', canceled: '#f43f5e',
};

function MaintenanceTab({ data, t }: { data: NonNullable<Props['maintenance']>; t: (k: string, opts?: Record<string, unknown>) => string }) {
    const byStatus = useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of data.items) counts.set(m.status, (counts.get(m.status) ?? 0) + 1);
        const keys = [...counts.keys()];
        return { labels: keys.map(k => t(MAINT_STATUS_KEY[k] ?? k)), values: keys.map(k => counts.get(k)!), colors: keys.map(k => MAINT_STATUS_HEX[k] ?? '#475569') };
    }, [data.items, t]);

    return (
        <div className="space-y-4">
            <StatCard label={t('reports.recordsCount')} value={String(data.count)} color="slate" />
            {byStatus.labels.length > 0 && (
                <ChartCard title={t('reports.chartMaintByStatus')}>
                    <DonutChart labels={byStatus.labels} values={byStatus.values} colors={byStatus.colors} />
                </ChartCard>
            )}
            <div className="space-y-2">
                {data.items.length === 0 ? <EmptyState t={t} /> : data.items.map(m => (
                    <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500">#{m.id}</p>
                            <p className="text-xs text-slate-500">{fmtDate(m.created_at)}</p>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-white">{m.customer_name} · {m.customer_mobile}</p>
                        <p className="text-xs text-slate-500">
                            {m.product_name}{m.product_model ? ` (${m.product_model})` : ''} · {m.outlet.code}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                {t(CASE_TYPE_KEY[m.case_type] ?? m.case_type)}
                            </span>
                            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                                {t(MAINT_STATUS_KEY[m.status] ?? m.status)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Shared small components ──────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        indigo:  'border-indigo-500/20 bg-indigo-500/10 text-indigo-400',
        rose:    'border-rose-500/20 bg-rose-500/10 text-rose-400',
        slate:   'border-slate-800 bg-slate-900 text-slate-300',
    };
    return (
        <div className={`rounded-2xl border p-4 ${colorMap[color]}`}>
            <p className="text-lg font-black">{value}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        </div>
    );
}

function EmptyState({ t }: { t: (k: string, opts?: Record<string, unknown>) => string }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
                <X className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-500">{t('reports.noRecords')}</p>
        </div>
    );
}
