import { Head, Link, router } from '@inertiajs/react';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, CheckCircle2, ChevronDown, ChevronUp,
    Image, Mail, Minus, Moon, Package, Plus, Printer, Search,
    Share2, ShoppingCart, Store, Sun, Trash2, User, X, Zap,
} from 'lucide-react';
import LanguageSwitcher from '@/components/language-switcher';
import { useAuth } from '@/hooks/use-auth';
import { useAppearance } from '@/hooks/use-appearance';
import { initializeTheme } from '@/hooks/use-appearance';
import * as ordersRoute from '@/routes/orders';
import BillCard, { type BillOrder } from '@/components/bill-card';

initializeTheme();

// ─── Types ───────────────────────────────────────────────────────────────────

type Outlet   = { id: number; name: string; code: string };
type Brand    = { id: number; name: string };
type Category = { id: number; name: string };
type Product  = { id: number; name: string; model_number: string | null; brand: Brand; category: Category; image_url: string | null };
type StockRow = { id: number; outlet_id: number; product_id: number; quantity: string; product: Product };

type CartItem = {
    stockRow:  StockRow;
    qty:       number;
    price:     string;
    warrantyFile: File | null;
    warrantyPreview: string | null;
};

type CompletedOrder = BillOrder & { bill_url: string };

type Props = {
    outlets: Outlet[];
    stocks:  StockRow[];
    flash?:  { success?: string; completedOrder?: CompletedOrder | null };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TYPES = ['cash', 'cheque', 'online', 'credit', 'installment'] as const;
const STATUS_LIST   = ['pending', 'confirm', 'dispatched', 'delivered', 'canceled'] as const;
const EMI_MONTHS    = [3, 6, 9, 12, 18, 24, 36];

const PAY_STYLE: Record<string, { active: string; idle: string }> = {
    cash:        { active: 'bg-emerald-600 border-emerald-600 text-white', idle: 'border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400' },
    cheque:      { active: 'bg-blue-600    border-blue-600    text-white', idle: 'border-slate-700 text-slate-400 hover:border-blue-500/50    hover:text-blue-400'    },
    online:      { active: 'bg-violet-600  border-violet-600  text-white', idle: 'border-slate-700 text-slate-400 hover:border-violet-500/50  hover:text-violet-400'  },
    credit:      { active: 'bg-amber-600   border-amber-600   text-white', idle: 'border-slate-700 text-slate-400 hover:border-amber-500/50   hover:text-amber-400'   },
    installment: { active: 'bg-orange-600  border-orange-600  text-white', idle: 'border-slate-700 text-slate-400 hover:border-orange-500/50  hover:text-orange-400'  },
};

const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20';

// ─── Main component ───────────────────────────────────────────────────────────

export default function Pos({ outlets, stocks, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin, outletId: userOutletId } = useAuth();
    const { resolvedAppearance, updateAppearance }  = useAppearance();
    const storeName = t('common.appName');

    const defaultOutletId = isSuperadmin ? '' : (userOutletId ?? '');

    // ── Outlet state ──────────────────────────────────────────────────────────
    const [destOutletId, setDestOutletId] = useState<number | ''>(defaultOutletId);
    const [originOutletId, setOriginOutletId] = useState<number | ''>(defaultOutletId);

    // ── Success / bill screen ─────────────────────────────────────────────────
    const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);

    useEffect(() => {
        if (flash?.completedOrder) setCompletedOrder(flash.completedOrder);
    }, [flash?.completedOrder]);

    // ── Product browser ───────────────────────────────────────────────────────
    const [search, setSearch] = useState('');

    // ── Cart ──────────────────────────────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([]);

    // ── Payment / customer state ──────────────────────────────────────────────
    const [paymentType, setPaymentType] = useState<string>('cash');
    const [status, setStatus]           = useState<string>('pending');
    const [customerName, setCustomerName]     = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [advanceAmount, setAdvanceAmount]   = useState('');
    const [dueDate, setDueDate]               = useState('');
    const [downPayment, setDownPayment]       = useState('');
    const [emiMonths, setEmiMonths]           = useState<number | ''>('');
    const [showCustomer, setShowCustomer]     = useState(false);
    const [showAdvanced, setShowAdvanced]     = useState(false);
    const [processing, setProcessing]         = useState(false);

    // ── Filtered stock ────────────────────────────────────────────────────────
    const outletStocks = useMemo(() =>
        destOutletId ? stocks.filter(s => s.outlet_id === destOutletId) : [],
    [stocks, destOutletId]);

    const filteredStocks = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return outletStocks;
        return outletStocks.filter(s =>
            s.product.name.toLowerCase().includes(q) ||
            s.product.brand.name.toLowerCase().includes(q) ||
            s.product.category.name.toLowerCase().includes(q) ||
            (s.product.model_number ?? '').toLowerCase().includes(q)
        );
    }, [outletStocks, search]);

    // ── Cart helpers ──────────────────────────────────────────────────────────
    const cartHasProduct = (productId: number) =>
        cart.some(c => c.stockRow.product_id === productId);

    const addToCart = (s: StockRow) => {
        if (cartHasProduct(s.product_id)) return;
        setCart(prev => [...prev, { stockRow: s, qty: 1, price: '', warrantyFile: null, warrantyPreview: null }]);
        setSearch('');
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(c => c.stockRow.product_id !== productId));
    };

    const updateCartItem = (productId: number, patch: Partial<CartItem>) => {
        setCart(prev => prev.map(c =>
            c.stockRow.product_id === productId ? { ...c, ...patch } : c
        ));
    };

    const adjustQty = (productId: number, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.stockRow.product_id !== productId) return c;
            const maxQty = Number(c.stockRow.quantity);
            const next   = Math.min(maxQty, Math.max(1, c.qty + delta));
            return { ...c, qty: next };
        }));
    };

    // ── Totals ────────────────────────────────────────────────────────────────
    const cartTotal = cart.reduce((sum, c) => sum + (parseFloat(c.price) || 0) * c.qty, 0);
    const advance   = parseFloat(advanceAmount) || 0;
    const down      = parseFloat(downPayment)   || 0;
    const months    = Number(emiMonths)          || 0;
    const loan      = paymentType === 'installment'
        ? Math.max(0, cartTotal - down)
        : Math.max(0, cartTotal - advance);
    const monthlyEmi = months > 0 ? loan / months : 0;

    const fmt = (n: number) =>
        `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ── Warranty file helpers ─────────────────────────────────────────────────
    const warrantyRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const handleWarrantyFile = (productId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        updateCartItem(productId, {
            warrantyFile:    file,
            warrantyPreview: file ? URL.createObjectURL(file) : null,
        });
    };

    const clearWarranty = (productId: number) => {
        updateCartItem(productId, { warrantyFile: null, warrantyPreview: null });
        const ref = warrantyRefs.current[productId];
        if (ref) ref.value = '';
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const canSubmit = cart.length > 0 && cart.every(c => parseFloat(c.price) > 0) && !processing;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setProcessing(true);

        const fd = new FormData();
        fd.append('origin_outlet_id',      String(originOutletId));
        fd.append('destination_outlet_id', String(destOutletId));
        fd.append('payment_type',          paymentType);
        fd.append('status',                status);
        if (customerName)    fd.append('customer_name',    customerName);
        if (customerMobile)  fd.append('customer_mobile',  customerMobile);
        if (customerAddress) fd.append('customer_address', customerAddress);
        if (paymentType === 'credit') {
            if (advanceAmount) fd.append('advance_amount', advanceAmount);
            if (dueDate)       fd.append('due_date',       dueDate);
        }
        if (paymentType === 'installment') {
            if (downPayment) fd.append('down_payment',      downPayment);
            if (emiMonths)   fd.append('installment_months', String(emiMonths));
        }

        cart.forEach((c, i) => {
            fd.append(`items[${i}][product_id]`, String(c.stockRow.product_id));
            fd.append(`items[${i}][price]`,      c.price);
            fd.append(`items[${i}][quantity]`,   String(c.qty));
            if (c.warrantyFile) fd.append(`items[${i}][warranty_card]`, c.warrantyFile);
        });

        router.post(ordersRoute.store().url, fd, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            only: ['stocks', 'flash'],
            onSuccess: () => {
                setCart([]);
                setPaymentType('cash');
                setStatus('pending');
                setCustomerName(''); setCustomerMobile(''); setCustomerAddress('');
                setAdvanceAmount(''); setDueDate(''); setDownPayment(''); setEmiMonths('');
                setShowCustomer(false); setShowAdvanced(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    const startNewSale = () => setCompletedOrder(null);

    const [linkCopied, setLinkCopied] = useState(false);

    const handlePrintBill = () => window.print();

    const handleShareBill = async (order: CompletedOrder) => {
        const text = `${t('orderMgmt.billNumber')} ${order.bill_number} — ${fmt(order.grand_total)}`;
        if (navigator.share) {
            try { await navigator.share({ title: order.bill_number, text, url: order.bill_url }); } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(order.bill_url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2500);
        }
    };

    const handleEmailBill = (order: CompletedOrder) => {
        const subject = encodeURIComponent(`${t('orderMgmt.billNumber')} ${order.bill_number}`);
        const body = encodeURIComponent(
            `${t('orderMgmt.totalPayable')}: ${fmt(order.grand_total)}\n${order.bill_url}`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    const destOutlet = outlets.find(o => o.id === destOutletId);

    // mobile tab: 'products' | 'cart'
    const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');

    // auto-switch to cart when first item added on mobile
    const addToCartAndSwitch = (s: StockRow) => {
        addToCart(s);
    };

    // ── Render: initial outlet-selection screen (superadmin, multi-outlet) ─────
    if (isSuperadmin && !destOutletId) {
        return (
            <div className="flex h-screen flex-col overflow-y-auto bg-slate-950 text-slate-100 antialiased">
                <Head title={t('tabs.pos')} />

                <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3">
                    <div className="flex items-center gap-2">
                        <Link href="/home" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </Link>
                        <span className="text-sm font-black text-white">{t('tabs.pos')}</span>
                    </div>
                    <LanguageSwitcher />
                </header>

                <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900">
                        <Store className="h-7 w-7 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-lg font-black text-white">{t('common.selectOutletFirst')}</p>
                        <p className="mt-1 text-xs text-slate-500">{t('orderMgmt.stockDeductNote')}</p>
                    </div>
                    <div className="w-full space-y-2">
                        {outlets.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => { setDestOutletId(o.id); setOriginOutletId(o.id); }}
                                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-left transition-colors hover:border-indigo-500/50 hover:bg-slate-800/80"
                            >
                                <span className="font-bold text-white">{o.name}</span>
                                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{o.code}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 antialiased">
            <Head title={t('tabs.pos')} />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3">
                <div className="flex items-center gap-2">
                    <Link href="/home" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-sm font-black text-white">{t('tabs.pos')}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Outlet selector */}
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5">
                        <Store className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {isSuperadmin ? (
                            <select
                                className="max-w-[120px] bg-transparent text-xs font-semibold text-slate-200 outline-none sm:max-w-none"
                                value={destOutletId}
                                onChange={e => {
                                    const id = Number(e.target.value);
                                    setDestOutletId(id);
                                    setOriginOutletId(id);
                                    setCart([]);
                                }}
                            >
                                <option value="">{t('orderMgmt.selectDestination')}</option>
                                {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                            </select>
                        ) : (
                            <span className="max-w-[120px] truncate text-xs font-semibold text-slate-200 sm:max-w-none">
                                {outlets.find(o => o.id === userOutletId)?.name ?? '—'}
                            </span>
                        )}
                    </div>
                    <button onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        {resolvedAppearance === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* ── Flash ───────────────────────────────────────────────────── */}
            {flash?.success && (
                <div className="mx-3 mt-2 flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {flash.success}
                </div>
            )}

            {/* ── Body ────────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 overflow-hidden">

                {/* ══ LEFT — Product catalog ══════════════════════════════════ */}
                <div className={`min-w-0 flex-1 flex-col border-r border-slate-800 bg-slate-950 ${mobileTab === 'products' ? 'flex' : 'hidden'} md:flex`}>

                    {/* Search */}
                    <div className="shrink-0 border-b border-slate-800 p-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                disabled={!destOutletId}
                                placeholder={destOutletId ? t('orderMgmt.searchPlaceholder') : t('common.selectOutletFirst')}
                                className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40"
                            />
                        </div>
                    </div>

                    {/* Product grid */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        {!destOutletId ? (
                            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900">
                                    <Store className="h-7 w-7 text-slate-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-400">{t('common.selectOutletFirst')}</p>
                                    <p className="mt-1 text-xs text-slate-600">{t('orderMgmt.stockDeductNote')}</p>
                                </div>
                            </div>
                        ) : filteredStocks.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900">
                                    <Package className="h-7 w-7 text-slate-600" />
                                </div>
                                <p className="font-bold text-slate-500">{search ? t('common.noResults') : t('orderMgmt.noProductsInStock')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {filteredStocks.map(s => {
                                    const inCart   = cartHasProduct(s.product_id);
                                    const stockQty = Number(s.quantity);
                                    return (
                                        <button
                                            key={s.product_id}
                                            type="button"
                                            onClick={() => { addToCartAndSwitch(s); }}
                                            disabled={stockQty <= 0 || inCart}
                                            title={inCart ? 'Already in cart' : undefined}
                                            className={`relative flex flex-col rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                                                inCart
                                                    ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/25 cursor-default'
                                                    : stockQty <= 0
                                                    ? 'border-slate-800 bg-slate-900 opacity-40 cursor-not-allowed'
                                                    : 'border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/80 cursor-pointer'
                                            }`}
                                        >
                                            <div className={`mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl ${inCart ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                                                {s.product.image_url ? (
                                                    <img src={s.product.image_url} alt={s.product.name} className="h-full w-full object-cover rounded-xl" />
                                                ) : (
                                                    <Package className={`h-6 w-6 ${inCart ? 'text-indigo-400' : 'text-slate-500'}`} />
                                                )}
                                            </div>

                                            <p className={`text-[10px] font-bold uppercase tracking-wide ${inCart ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                {s.product.brand.name} → {s.product.category.name}
                                            </p>
                                            <p className={`mt-0.5 text-sm font-bold leading-snug ${inCart ? 'text-slate-100' : 'text-slate-200'}`}>
                                                {s.product.name}
                                            </p>
                                            {s.product.model_number && (
                                                <p className="mt-0.5 text-[10px] text-slate-500">{s.product.model_number}</p>
                                            )}

                                            <div className={`mt-2.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                stockQty <= 0 ? 'bg-rose-500/15 text-rose-400' :
                                                stockQty <= 3 ? 'bg-amber-500/15 text-amber-400' :
                                                               'bg-emerald-500/15 text-emerald-400'
                                            }`}>
                                                {stockQty <= 0 ? t('home.outOfStock') : `${stockQty} ${t('common.left')}`}
                                            </div>

                                            {inCart && (
                                                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/40">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ RIGHT — Cart + Checkout ══════════════════════════════════ */}
                <div className={`w-full flex-col overflow-hidden bg-slate-900 md:flex md:w-80 md:shrink-0 xl:w-96 ${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex`}>

                    {/* Cart header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-black text-white">{t('orderMgmt.orderList')}</span>
                            {cart.length > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button type="button" onClick={() => setCart([])}
                                className="text-[10px] font-semibold text-slate-500 hover:text-rose-400 transition-colors">
                                {t('common.clearAll')}
                            </button>
                        )}
                    </div>

                    {/* Scrollable cart + options */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                                <ShoppingCart className="h-8 w-8 text-slate-700" />
                                <p className="text-sm text-slate-600">{t('orderMgmt.selectProduct')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {cart.map((c) => (
                                    <div key={c.stockRow.product_id} className="p-4 space-y-3">
                                        {/* Item header */}
                                        <div className="flex items-start gap-2">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-500/10">
                                                {c.stockRow.product.image_url ? (
                                                    <img src={c.stockRow.product.image_url} alt={c.stockRow.product.name} className="h-full w-full object-cover rounded-lg" />
                                                ) : (
                                                    <Package className="h-4 w-4 text-indigo-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-bold uppercase text-indigo-400">{c.stockRow.product.brand.name} → {c.stockRow.product.category.name}</p>
                                                <p className="truncate text-sm font-black text-white">{c.stockRow.product.name}</p>
                                                {c.stockRow.product.model_number && (
                                                    <p className="text-[10px] text-slate-500">{c.stockRow.product.model_number}</p>
                                                )}
                                            </div>
                                            <button type="button" onClick={() => removeFromCart(c.stockRow.product_id)}
                                                className="shrink-0 rounded-lg p-1 text-slate-600 hover:text-rose-400 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        {/* Price + Qty row */}
                                        <div className="flex items-center gap-2">
                                            {/* Price */}
                                            <div className="relative flex-1">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">रू</span>
                                                <input
                                                    type="number" min={0} step="0.01" placeholder="0.00"
                                                    value={c.price}
                                                    onChange={e => updateCartItem(c.stockRow.product_id, { price: e.target.value })}
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2 pl-7 pr-2 text-right text-sm font-black text-white outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </div>

                                            {/* Qty stepper */}
                                            <div className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                                                <button type="button" onClick={() => adjustQty(c.stockRow.product_id, -1)}
                                                    className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                                                    <Minus className="h-3 w-3" />
                                                </button>
                                                <input
                                                    type="number" min={1} step={1}
                                                    value={c.qty}
                                                    onChange={e => {
                                                        const v = Math.min(Number(c.stockRow.quantity), Math.max(1, parseInt(e.target.value) || 1));
                                                        updateCartItem(c.stockRow.product_id, { qty: v });
                                                    }}
                                                    className="w-9 bg-transparent text-center text-sm font-black text-white outline-none"
                                                />
                                                <button type="button" onClick={() => adjustQty(c.stockRow.product_id, 1)}
                                                    className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Item subtotal */}
                                        {parseFloat(c.price) > 0 && (
                                            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs">
                                                <span className="text-slate-500">
                                                    {fmt(parseFloat(c.price))} × {c.qty}
                                                </span>
                                                <span className="font-bold text-indigo-400">{fmt(parseFloat(c.price) * c.qty)}</span>
                                            </div>
                                        )}

                                        {/* Warranty photo per item */}
                                        <div>
                                            {c.warrantyPreview ? (
                                                <div className="relative">
                                                    <img src={c.warrantyPreview} alt="Warranty" className="h-16 w-full rounded-xl border border-slate-700 object-cover" />
                                                    <button type="button" onClick={() => clearWarranty(c.stockRow.product_id)}
                                                        className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/80 p-0.5 text-slate-400 hover:text-rose-400">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => warrantyRefs.current[c.stockRow.product_id]?.click()}
                                                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 text-slate-600 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors">
                                                    <Image className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-semibold">{t('orderMgmt.warrantyCard')}</span>
                                                </button>
                                            )}
                                            <input
                                                ref={el => { warrantyRefs.current[c.stockRow.product_id] = el; }}
                                                type="file" accept="image/*" className="hidden"
                                                onChange={e => handleWarrantyFile(c.stockRow.product_id, e)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Options below cart ── */}
                        <div className="space-y-3 border-t border-slate-800 p-4">

                            {/* Payment type */}
                            <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('orderMgmt.paymentType')}</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {PAYMENT_TYPES.map(pt => {
                                        const s = PAY_STYLE[pt];
                                        const active = paymentType === pt;
                                        return (
                                            <button key={pt} type="button" onClick={() => setPaymentType(pt)}
                                                className={`rounded-xl border py-2 text-[10px] font-bold transition-all ${active ? s.active : s.idle}`}>
                                                {t(`orderMgmt.${pt}`)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Credit */}
                            {paymentType === 'credit' && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400">{t('orderMgmt.creditDueDetails')}</p>
                                    <div>
                                        <p className="mb-1 text-[10px] text-slate-500">{t('orderMgmt.advanceAmount')}</p>
                                        <input type="number" min={0} step="0.01" placeholder="0.00" value={advanceAmount}
                                            onChange={e => setAdvanceAmount(e.target.value)} className={inputCls} />
                                    </div>
                                    {advance > 0 && cartTotal > 0 && (
                                        <div className="flex justify-between rounded-lg bg-amber-500/10 px-3 py-2 text-xs">
                                            <span className="text-amber-500/70">{t('orderMgmt.remainingAmount')}</span>
                                            <span className="font-bold text-amber-400">{fmt(loan)}</span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="mb-1 text-[10px] text-slate-500">{t('orderMgmt.dueDate')}</p>
                                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                                    </div>
                                </div>
                            )}

                            {/* EMI */}
                            {paymentType === 'installment' && (
                                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="h-3.5 w-3.5 text-orange-400" />
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-orange-400">{t('orderMgmt.emiCalculator')}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="mb-1 text-[10px] text-slate-500">{t('orderMgmt.downPayment')}</p>
                                            <input type="number" min={0} step="0.01" placeholder="0.00" value={downPayment}
                                                onChange={e => setDownPayment(e.target.value)} className={inputCls} />
                                        </div>
                                        <div>
                                            <p className="mb-1 text-[10px] text-slate-500">{t('orderMgmt.months')}</p>
                                            <select value={emiMonths} onChange={e => setEmiMonths(Number(e.target.value) as any)} className={inputCls}>
                                                <option value="">— mo</option>
                                                {EMI_MONTHS.map(m => <option key={m} value={m}>{m} mo</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {cartTotal > 0 && (
                                        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500">{t('orderMgmt.loanAmount')}</span>
                                                <span className="font-semibold text-slate-300">{fmt(loan)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500">{t('orderMgmt.monthlyEmi')}</span>
                                                <span className="font-black text-orange-400">{months > 0 ? fmt(monthlyEmi) : '—'}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-700 pt-1.5 text-xs">
                                                <span className="text-slate-400">{t('orderMgmt.totalPayable')}</span>
                                                <span className="font-black text-white">{months > 0 ? fmt(down + monthlyEmi * months) : fmt(cartTotal)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer — collapsible */}
                            <div className="overflow-hidden rounded-xl border border-slate-800">
                                <button type="button" onClick={() => setShowCustomer(v => !v)}
                                    className="flex w-full items-center justify-between bg-slate-800/40 px-4 py-2.5 transition-colors hover:bg-slate-800">
                                    <div className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-300">{t('orderMgmt.customer')}</span>
                                        <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{t('common.optional')}</span>
                                    </div>
                                    {showCustomer ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                                </button>
                                {showCustomer && (
                                    <div className="space-y-2 p-3">
                                        <input placeholder={t('orderMgmt.customerName')} value={customerName}
                                            onChange={e => setCustomerName(e.target.value)} className={inputCls} />
                                        <input type="tel" placeholder="98XXXXXXXX" value={customerMobile}
                                            onChange={e => setCustomerMobile(e.target.value)} className={inputCls} />
                                        <input placeholder={t('orderMgmt.address')} value={customerAddress}
                                            onChange={e => setCustomerAddress(e.target.value)} className={inputCls} />
                                    </div>
                                )}
                            </div>

                            {/* Advanced — status + origin outlet */}
                            <div className="overflow-hidden rounded-xl border border-slate-800">
                                <button type="button" onClick={() => setShowAdvanced(v => !v)}
                                    className="flex w-full items-center justify-between bg-slate-800/40 px-4 py-2.5 transition-colors hover:bg-slate-800">
                                    <span className="text-xs font-semibold text-slate-300">{t('orderMgmt.statusLabel')}</span>
                                    {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                                </button>
                                {showAdvanced && (
                                    <div className="space-y-3 p-3">
                                        <div className="grid grid-cols-3 gap-1">
                                            {STATUS_LIST.map(s => (
                                                <button key={s} type="button" onClick={() => setStatus(s)}
                                                    className={`rounded-lg py-1.5 text-[10px] font-bold transition-all ${status === s ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'}`}>
                                                    {t(`orderMgmt.${s}`)}
                                                </button>
                                            ))}
                                        </div>
                                        {isSuperadmin && (
                                            <div>
                                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('orderMgmt.posOrigin')} *</p>
                                                <select value={originOutletId}
                                                    onChange={e => setOriginOutletId(Number(e.target.value))}
                                                    required className={inputCls}>
                                                    <option value="">{t('orderMgmt.selectOrigin')}</option>
                                                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Checkout footer ──────────────────────────────────── */}
                    <div className="shrink-0 border-t border-slate-800 p-3 space-y-2 pb-3">
                        <div className="rounded-xl bg-slate-800/60 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400">{t('orderMgmt.totalPayable')}</p>
                                    {destOutlet && (
                                        <p className="mt-0.5 text-[10px] text-slate-600">
                                            <Store className="mr-0.5 inline h-3 w-3" />
                                            {destOutlet.name}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-black ${cartTotal > 0 ? 'text-white' : 'text-slate-700'}`}>
                                        {cartTotal > 0 ? fmt(cartTotal) : '—'}
                                    </p>
                                    {cart.length > 1 && (
                                        <p className="text-[10px] text-slate-500">{cart.length} items</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            {processing ? t('orderMgmt.creating') : t('orderMgmt.createBtn')}
                        </button>
                    </div>
                </div>
            </form>

            {/* ── Mobile bottom tab bar ───────────────────────────────────── */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-900 md:hidden">
                {/* Floating cart summary strip — only on products tab when cart has items */}
                {mobileTab === 'products' && cart.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setMobileTab('cart')}
                        className="flex w-full items-center justify-between bg-indigo-600 px-4 py-2.5"
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-black text-white">
                                {cart.length}
                            </span>
                            <span className="text-xs font-bold text-white">
                                {cart.length === 1 ? '1 item' : `${cart.length} items`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-white">
                                {cartTotal > 0 ? fmt(cartTotal) : '—'}
                            </span>
                            <ChevronUp className="h-4 w-4 text-white/70" />
                        </div>
                    </button>
                )}

                {/* Tab switcher */}
                <div className="grid grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setMobileTab('products')}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
                            mobileTab === 'products'
                                ? 'border-t-2 border-indigo-500 text-indigo-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Package className="h-4 w-4" />
                        {t('orderMgmt.product')}
                        {outletStocks.length > 0 && (
                            <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                                {filteredStocks.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('cart')}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
                            mobileTab === 'cart'
                                ? 'border-t-2 border-indigo-500 text-indigo-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <ShoppingCart className="h-4 w-4" />
                        {t('orderMgmt.orderList')}
                        {cart.length > 0 && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                                {cart.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Success / Bill modal ────────────────────────────────────── */}
            {completedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm print:items-start print:bg-[#ffffff] print:p-0 print:backdrop-blur-none">
                    <div className="relative my-auto w-full max-w-md space-y-5 print:my-0">
                        <button
                            type="button"
                            onClick={startNewSale}
                            className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 shadow-lg transition-colors hover:bg-slate-700 hover:text-white print:hidden"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="flex flex-col items-center gap-3 text-center print:hidden">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-white">{t('orderMgmt.saleComplete')}</p>
                                <p className="text-xs text-slate-400">{t('orderMgmt.saleCompleteSub')}</p>
                            </div>
                        </div>

                        <BillCard order={completedOrder} storeName={storeName} />

                        {/* Actions */}
                        <div className="grid grid-cols-3 gap-2 print:hidden">
                            <button type="button" onClick={handlePrintBill}
                                className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 py-3 text-[10px] font-bold text-slate-300 transition-colors hover:border-indigo-500/50 hover:text-indigo-400">
                                <Printer className="h-4 w-4" /> {t('orderMgmt.print')}
                            </button>
                            <button type="button" onClick={() => handleShareBill(completedOrder)}
                                className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 py-3 text-[10px] font-bold text-slate-300 transition-colors hover:border-indigo-500/50 hover:text-indigo-400">
                                <Share2 className="h-4 w-4" /> {t('orderMgmt.share')}
                            </button>
                            <button type="button" onClick={() => handleEmailBill(completedOrder)}
                                className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 py-3 text-[10px] font-bold text-slate-300 transition-colors hover:border-indigo-500/50 hover:text-indigo-400">
                                <Mail className="h-4 w-4" /> {t('orderMgmt.email')}
                            </button>
                        </div>

                        {linkCopied && (
                            <p className="text-center text-[10px] font-semibold text-emerald-400 print:hidden">
                                {t('orderMgmt.viewShareableBill')}
                            </p>
                        )}

                        <button type="button" onClick={startNewSale}
                            className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 active:scale-[0.98] print:hidden">
                            {t('orderMgmt.newSale')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
