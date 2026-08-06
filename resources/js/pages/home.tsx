import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DayPicker, type DateRange } from 'react-day-picker';
import {
    Activity, AlertTriangle, CalendarDays, CreditCard, Package,
    ShoppingBag, Store, Truck, TrendingUp, Wrench, X,
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip,
    ArcElement,
} from 'chart.js';
import PosShell from '@/components/pos-shell';
import { useAuth } from '@/hooks/use-auth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, ArcElement);

// ─── Types ───────────────────────────────────────────────────────────────────

type DailySale  = { date: string; revenue: string; orders: number };
type TopProduct = { product_id: number; revenue: string; qty: string; orders: number; product: { name: string; model_number: string | null; brand: { name: string } } };
type StockItem  = { id: number; quantity: string; product: { name: string; model_number: string | null }; outlet: { name: string; code: string } };
type Outlet     = { id: number; name: string; code: string };

type Props = {
    from: string;
    to: string;
    outletId: number | null;
    outlets: Outlet[];
    totalRevenue: number;
    totalOrders: number;
    ordersByStatus: Record<string, number>;
    ordersByPayment: Record<string, number>;
    creditCount: number;
    pendingDeliveryCount: number;
    topProducts: TopProduct[];
    dailySales: DailySale[];
    maintTotal: number;
    maintByStatus: Record<string, number>;
    lowStock: StockItem[];
    outOfStock: number;
};

// ─── Color maps ───────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
    pending:    '#f59e0b',
    confirm:    '#3b82f6',
    dispatched: '#6366f1',
    delivered:  '#10b981',
    canceled:   '#f43f5e',
};

const PAYMENT_HEX: Record<string, string> = {
    cash:        '#10b981',
    cheque:      '#3b82f6',
    online:      '#8b5cf6',
    credit:      '#f59e0b',
    installment: '#f97316',
};

const MAINT_HEX: Record<string, string> = {
    received:    '#3b82f6',
    in_progress: '#f59e0b',
    resolved:    '#10b981',
    returned:    '#8b5cf6',
    canceled:    '#f43f5e',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function parseDate(s: string) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(s: string) {
    return parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Revenue line chart ───────────────────────────────────────────────────────

function RevenueLineChart({ data }: { data: DailySale[] }) {
    if (data.length < 2) return null;

    const chartData = {
        labels: data.map(d => formatDisplay(d.date)),
        datasets: [{
            data: data.map(d => Number(d.revenue)),
            borderColor: 'rgba(255,255,255,0.9)',
            borderWidth: 2.5,
            fill: true,
            backgroundColor: (context: { chart: ChartJS }) => {
                const { ctx, chartArea } = context.chart;
                if (!chartArea) return 'rgba(255,255,255,0.1)';
                const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                grad.addColorStop(0, 'rgba(255,255,255,0.28)');
                grad.addColorStop(1, 'rgba(255,255,255,0.02)');
                return grad;
            },
            pointRadius: data.length <= 14 ? 2 : 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: 'white',
            pointHoverBorderColor: 'rgba(99,102,241,0.8)',
            pointHoverBorderWidth: 2,
            pointBackgroundColor: 'rgba(255,255,255,0.7)',
            tension: 0.4,
        }],
    };

    return (
        <div style={{ height: 80 }}>
            <Line
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15,23,42,0.95)',
                            titleColor: '#94a3b8',
                            bodyColor: '#f1f5f9',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 10,
                            z: 999,
                            callbacks: {
                                label: ctx => ` ${fmt(Number(ctx.raw))}`,
                                title: items => items[0]?.label ?? '',
                            },
                        },
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false, beginAtZero: false },
                    },
                }}
            />
        </div>
    );
}

// ─── Donut breakdown card ─────────────────────────────────────────────────────

function DonutCard({ title, data, colorMap, total }: {
    title: string;
    data: Record<string, number>;
    colorMap: Record<string, string>;
    total: number;
}) {
    const keys = Object.keys(data);
    if (!keys.length || total === 0) return null;

    const chartData = {
        labels: keys.map(k => k.replace(/_/g, ' ')),
        datasets: [{
            data: keys.map(k => data[k]),
            backgroundColor: keys.map(k => colorMap[k] ?? '#475569'),
            borderWidth: 2,
            borderColor: '#0f172a',
            hoverOffset: 6,
        }],
    };

    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
            <div className="mx-auto" style={{ height: 120, maxWidth: 120 }}>
                <Doughnut
                    data={chartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15,23,42,0.95)',
                                titleColor: '#94a3b8',
                                bodyColor: '#f1f5f9',
                                borderColor: '#334155',
                                borderWidth: 1,
                                padding: 10,
                                cornerRadius: 10,
                                z: 999,
                                callbacks: {
                                    label: ctx => ` ${ctx.label}: ${ctx.raw}`,
                                    title: () => '',
                                },
                            },
                        },
                    }}
                />
            </div>
            <div className="mt-3 space-y-1.5">
                {keys.map(k => (
                    <div key={k} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorMap[k] ?? '#475569' }} />
                        <span className="text-[10px] capitalize text-slate-400">{k.replace(/_/g, ' ')}</span>
                        <span className="ml-1 text-[10px] font-bold text-slate-200 tabular-nums">{data[k]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home({
    from, to, outletId, outlets,
    totalRevenue, totalOrders,
    ordersByStatus, ordersByPayment,
    creditCount, pendingDeliveryCount,
    topProducts, dailySales,
    maintTotal, maintByStatus,
    lowStock, outOfStock,
}: Props) {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();
    const [showPicker, setShowPicker] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>({
        from: parseDate(from),
        to:   parseDate(to),
    });

    const navigate = (params: Record<string, string | number | null>) => {
        const base: Record<string, string | number> = { from, to };
        if (outletId) base.outlet_id = outletId;
        router.get('/home', { ...base, ...params }, { preserveState: false });
    };

    const applyRange = (r: DateRange | undefined) => {
        if (!r?.from) return;
        const f  = formatDate(r.from);
        const t2 = r.to ? formatDate(r.to) : f;
        navigate({ from: f, to: t2 });
        setShowPicker(false);
    };

    const applyOutlet = (id: number | null) => {
        const params: Record<string, string | number> = { from, to };
        if (id) params.outlet_id = id;
        router.get('/home', params, { preserveState: false });
    };

    const totalMaintOpen = (maintByStatus['received'] ?? 0) + (maintByStatus['in_progress'] ?? 0);
    const maxProductRevenue = topProducts.length > 0 ? Number(topProducts[0].revenue) : 1;

    return (
        <PosShell activeNav="home">
            <Head title={t('tabs.home')} />

            <div className="space-y-4 p-4 pb-10 md:space-y-5 md:p-6 md:pb-14">

                {/* ── Controls ─────────────────────────────────────────── */}
                <div className="space-y-2">
                    {/* Date range pill */}
                    <button
                        onClick={() => setShowPicker(true)}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left transition-all hover:border-indigo-500/40 hover:bg-slate-800/60 active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                                <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-300">
                                <span className="text-sm font-semibold">{formatDisplay(from)}</span>
                                <span className="text-[10px] text-slate-600">→</span>
                                <span className="text-sm font-semibold">{formatDisplay(to)}</span>
                            </div>
                        </div>
                        <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-400">
                            {t('home.change')}
                        </span>
                    </button>

                    {/* Outlet pills — superadmin only */}
                    {isSuperadmin && outlets.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                            <button
                                onClick={() => applyOutlet(null)}
                                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${!outletId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}`}
                            >
                                <Store className="h-3 w-3" /> All Outlets
                            </button>
                            {outlets.map(o => (
                                <button key={o.id} onClick={() => applyOutlet(o.id)}
                                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${outletId === o.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}`}
                                >
                                    {o.code}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Revenue hero ─────────────────────────────────────── */}
                <div className="relative rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 shadow-2xl shadow-indigo-900/40">
                    {/* Decorative blobs — clipped inside their own layer so the chart tooltip can escape */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                        <div className="absolute bottom-0 left-1/4 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />
                    </div>

                    <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(199,210,254,0.7)]">
                                {t('home.revenue')}
                            </p>
                            <p className="mt-1 text-3xl font-black text-[#ffffff] tabular-nums md:text-4xl">
                                {fmt(totalRevenue)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-[rgba(199,210,254,1)]">
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                    {totalOrders} {t('home.orders')}
                                </span>
                                {dailySales.length > 0 && (
                                    <span className="hidden text-[10px] text-[rgba(165,180,252,0.6)] sm:inline">
                                        {formatDisplay(from)} — {formatDisplay(to)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                            <TrendingUp className="h-6 w-6 text-[#ffffff]" />
                        </div>
                    </div>

                    {/* Revenue trend */}
                    {dailySales.length > 1 && (
                        <div className="mt-4 -mx-1">
                            <RevenueLineChart data={dailySales} />
                            <div className="mt-1 flex justify-between px-1">
                                <span className="text-[9px] font-semibold text-[rgba(165,180,252,0.5)]">
                                    {formatDisplay(dailySales[0].date)}
                                </span>
                                <span className="text-[9px] font-semibold text-[rgba(165,180,252,0.5)]">
                                    {formatDisplay(dailySales[dailySales.length - 1].date)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Quick stat cards — clickable, deep-link into the relevant list ── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {/* Orders */}
                    <Link href="/orders"
                        className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-left transition-all hover:border-blue-500/40 hover:bg-blue-500/15 active:scale-[0.98]">
                        <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
                            <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                        <p className="text-2xl font-black leading-none text-blue-300 tabular-nums">{totalOrders}</p>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-400/80">
                            {t('home.orders')}
                        </p>
                        <p className="mt-0.5 text-[10px] text-blue-300/50">
                            {(ordersByStatus['pending'] ?? 0) + (ordersByStatus['confirm'] ?? 0)} pending
                        </p>
                    </Link>

                    {/* Maintenance */}
                    <Link href="/maintenances"
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-left transition-all hover:border-amber-500/40 hover:bg-amber-500/15 active:scale-[0.98]">
                        <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
                            <Wrench className="h-3.5 w-3.5 text-amber-400" />
                        </div>
                        <p className="text-2xl font-black leading-none text-amber-300 tabular-nums">{maintTotal}</p>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400/80">
                            Maintenance
                        </p>
                        <p className="mt-0.5 text-[10px] text-amber-300/50">
                            {totalMaintOpen} active
                        </p>
                    </Link>

                    {/* Out of Stock */}
                    <Link href="/stocks?filter=outOfStock"
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-left transition-all hover:border-rose-500/40 hover:bg-rose-500/15 active:scale-[0.98]">
                        <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20">
                            <Package className="h-3.5 w-3.5 text-rose-400" />
                        </div>
                        <p className="text-2xl font-black leading-none text-rose-300 tabular-nums">{outOfStock}</p>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-400/80">
                            Out of Stock
                        </p>
                        <p className="mt-0.5 text-[10px] text-rose-300/50">
                            {lowStock.length} low stock
                        </p>
                    </Link>

                    {/* Credits */}
                    <Link href="/orders?payment_type=credit"
                        className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3.5 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/15 active:scale-[0.98]">
                        <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
                            <CreditCard className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <p className="text-2xl font-black leading-none text-violet-300 tabular-nums">{creditCount}</p>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-400/80">
                            Credits
                        </p>
                    </Link>

                    {/* Pending Delivery */}
                    <Link href="/orders?status=pending"
                        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/15 active:scale-[0.98]">
                        <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
                            <Truck className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-black leading-none text-emerald-300 tabular-nums">{pendingDeliveryCount}</p>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">
                            Pending Delivery
                        </p>
                    </Link>
                </div>

                {/* ── Order breakdown ───────────────────────────────────── */}
                {(Object.keys(ordersByStatus).length > 0 || Object.keys(ordersByPayment).length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                        {Object.keys(ordersByStatus).length > 0 && (
                            <DonutCard
                                title={t('home.byStatus')}
                                data={ordersByStatus}
                                colorMap={STATUS_HEX}
                                total={totalOrders}
                            />
                        )}
                        {Object.keys(ordersByPayment).length > 0 && (
                            <DonutCard
                                title={t('home.byPayment')}
                                data={ordersByPayment}
                                colorMap={PAYMENT_HEX}
                                total={totalOrders}
                            />
                        )}
                    </div>
                )}

                {/* ── Top products ──────────────────────────────────────── */}
                {topProducts.length > 0 && (
                    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                        <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                <Activity className="h-4 w-4 text-indigo-400" />
                                {t('home.topProducts')}
                            </h3>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                                by revenue
                            </span>
                        </div>
                        <div className="space-y-4">
                            {topProducts.map((tp, i) => {
                                const pct = (Number(tp.revenue) / maxProductRevenue) * 100;
                                const rankCls = i === 0
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : i === 1
                                    ? 'bg-slate-700 text-slate-300'
                                    : i === 2
                                    ? 'bg-orange-900/40 text-orange-500'
                                    : 'bg-slate-800 text-slate-600';
                                const barCls = i === 0
                                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                                    : i === 1
                                    ? 'bg-indigo-600/70'
                                    : 'bg-slate-600';

                                return (
                                    <div key={tp.product_id}>
                                        <div className="mb-2 flex items-center gap-3">
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${rankCls}`}>
                                                {i + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-slate-200">
                                                    {tp.product.brand.name} {tp.product.name}
                                                </p>
                                                {tp.product.model_number && (
                                                    <p className="text-[10px] text-slate-500">{tp.product.model_number}</p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-bold text-indigo-400 tabular-nums">
                                                    {fmt(Number(tp.revenue))}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {Number(tp.qty).toLocaleString()} {t('common.qty').toLowerCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                            <div
                                                className={`h-full rounded-full transition-all ${barCls}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Maintenance + Low stock ───────────────────────────── */}
                <div className="grid gap-3 md:grid-cols-2">
                    {/* Maintenance breakdown */}
                    {Object.keys(maintByStatus).length > 0 && (
                        <DonutCard
                            title={t('home.byMaintenanceStatus')}
                            data={maintByStatus}
                            colorMap={MAINT_HEX}
                            total={maintTotal}
                        />
                    )}

                    {/* Low stock alert */}
                    {lowStock.length > 0 && (
                        <div className="rounded-3xl border border-rose-500/20 bg-slate-900 p-5 shadow-xl">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-800/60 pb-4">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                                    {t('home.lowStockAlert')}
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    {outOfStock > 0 && (
                                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                                            {outOfStock} out
                                        </span>
                                    )}
                                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                        {lowStock.length} low
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {lowStock.map(s => (
                                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 transition-colors hover:border-rose-500/20">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-semibold text-slate-300">
                                                {s.product.name}
                                                {s.product.model_number ? ` (${s.product.model_number})` : ''}
                                            </p>
                                            <p className="text-[10px] text-slate-500">{s.outlet.name} · {s.outlet.code}</p>
                                        </div>
                                        <span className="ml-3 shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                                            {Number(s.quantity).toLocaleString()} {t('common.left')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* ── Date range picker modal ───────────────────────────────── */}
            {showPicker && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-t-3xl border border-slate-700/60 bg-slate-900 shadow-2xl">
                        {/* Handle */}
                        <div className="flex justify-center pb-1 pt-3">
                            <div className="h-1 w-10 rounded-full bg-slate-700" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 px-5 pb-3 pt-2">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('home.filterPeriod')}</p>
                                <h3 className="text-sm font-black text-white">Select Date Range</h3>
                            </div>
                            <button
                                onClick={() => setShowPicker(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-all hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Calendar */}
                        <div className="px-4 py-3">
                            <DayPicker
                                mode="range"
                                selected={range}
                                onSelect={setRange}
                                numberOfMonths={1}
                                disabled={{ after: new Date() }}
                                classNames={{
                                    months:          'flex flex-col',
                                    month:           'w-full',
                                    month_caption:   'flex items-center justify-between px-1 mb-3',
                                    caption_label:   'text-sm font-black text-slate-100',
                                    nav:             'flex items-center gap-1',
                                    button_previous: 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all text-xs',
                                    button_next:     'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all text-xs',
                                    month_grid:      'w-full border-collapse',
                                    weekdays:        'flex mb-1',
                                    weekday:         'flex-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600 py-1',
                                    weeks:           'flex flex-col gap-0.5',
                                    week:            'flex',
                                    day:             'flex-1 flex items-center justify-center p-0',
                                    day_button:      'w-full h-8 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all cursor-pointer',
                                    today:           'font-black text-indigo-400',
                                    selected:        '[&>button]:bg-indigo-600 [&>button]:text-white [&>button]:font-bold',
                                    range_start:     '[&>button]:bg-indigo-600 [&>button]:text-white [&>button]:rounded-l-lg [&>button]:rounded-r-none [&>button]:font-bold',
                                    range_end:       '[&>button]:bg-indigo-600 [&>button]:text-white [&>button]:rounded-r-lg [&>button]:rounded-l-none [&>button]:font-bold',
                                    range_middle:    '[&>button]:bg-indigo-500/15 [&>button]:text-indigo-300 [&>button]:rounded-none hover:[&>button]:bg-indigo-500/25',
                                    disabled:        '[&>button]:opacity-25 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent',
                                    outside:         '[&>button]:text-slate-700',
                                }}
                            />
                        </div>

                        {/* Selected range display */}
                        {range?.from && (
                            <div className="mx-4 mb-3 flex items-center rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{t('home.from')}</p>
                                    <p className="text-sm font-bold text-indigo-400">{formatDisplay(formatDate(range.from))}</p>
                                </div>
                                <div className="h-6 w-px bg-slate-800" />
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{t('home.to')}</p>
                                    <p className="text-sm font-bold text-indigo-400">
                                        {range.to ? formatDisplay(formatDate(range.to)) : '—'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Quick presets */}
                        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                            {[
                                { label: t('common.today'),  days: 0 },
                                { label: t('home.last7d'),  days: 6 },
                                { label: t('home.last30d'), days: 29 },
                            ].map(({ label, days }) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        const to   = new Date();
                                        const from = new Date(); from.setDate(from.getDate() - days);
                                        setRange({ from, to });
                                    }}
                                    className="rounded-xl border border-slate-800 bg-slate-800/60 py-1.5 text-[10px] font-semibold text-slate-400 transition-all hover:border-indigo-500/40 hover:text-indigo-400"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Apply */}
                        <div className="px-4 pb-6">
                            <button
                                onClick={() => applyRange(range)}
                                disabled={!range?.from}
                                className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
                            >
                                Apply Range
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PosShell>
    );
}
