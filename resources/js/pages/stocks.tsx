import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { CheckCircle2, Package, Pencil, Plus, Search, X } from 'lucide-react';
import PosShell from '@/components/pos-shell';
import Pagination from '@/components/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { useAuth } from '@/hooks/use-auth';
import { QuickCreateModal } from '@/components/quick-create-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as stocksRoute from '@/routes/stocks';
import * as transfersRoute from '@/routes/stocks/transfers';
import * as productsRoute from '@/routes/products';
import * as brandsRoute from '@/routes/brands';
import * as categoriesRoute from '@/routes/categories';

// ─── Types ───────────────────────────────────────────────────────────────────

type Brand    = { id: number; name: string };
type Category = { id: number; name: string };
type Outlet   = { id: number; name: string; code: string };

type StockProduct = {
    id: number;
    name: string;
    model_number: string | null;
    type: string | null;
    warranty: string | null;
    brand: Brand;
    category: Category;
};

type StockEntry = {
    id: number;
    quantity: string;
    outlet: Outlet;
    product: StockProduct;
};

type SimpleProduct = { id: number; name: string; model_number: string | null; brand: Brand; category: Category };
type StockedPair   = { outlet_id: number; product_id: number };
type StockAction   = 'directAdd' | 'transferStock';

type PendingTransfer = {
    id: number;
    quantity: string;
    product: SimpleProduct;
    from_outlet: Outlet;
    to_outlet: Outlet;
    requested_by: { id: number; name: string };
    created_at: string;
};

type Props = {
    stocks: StockEntry[];
    allStocks: StockedPair[];
    products: SimpleProduct[];
    pendingTransfers: PendingTransfer[];
    brands: Brand[];
    categories: Category[];
    outlets: Outlet[];
    flash?: { success?: string };
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FormInput({ label, className = '', ...props }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            <input className={`w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
        </div>
    );
}

function FormSelect({ label, children, className = '', ...props }: { label: string; children: React.ReactNode; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            <select className={`w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>
                {children}
            </select>
        </div>
    );
}

function ProductSelect({
    label, products, value, onChange, placeholder, disabled,
}: {
    label: string;
    products: SimpleProduct[];
    value: number | '';
    onChange: (id: number) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    const selected = products.find(p => p.id === value);

    return (
        <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            <Select value={value ? String(value) : ''} onValueChange={v => onChange(Number(v))} disabled={disabled}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={placeholder}>
                        {selected ? `${selected.name}${selected.model_number ? ` (${selected.model_number})` : ''}` : undefined}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {products.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                            <span className="flex flex-col gap-0.5 py-0.5">
                                <span>{p.name}{p.model_number ? ` (${p.model_number})` : ''}</span>
                                <span className="text-[10px] font-medium text-slate-500">
                                    {p.brand.name} → {p.category.name}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function SectionHeading({ icon, label, badge }: { icon: string; label: string; badge?: string }) {
    return (
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
            <h3 className="text-sm font-bold text-white">{label}</h3>
            {badge && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">{badge}</span>}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Stocks({ stocks, allStocks, products, pendingTransfers, brands: initialBrands, categories: initialCategories, outlets, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin, outletId: userOutletId } = useAuth();

    // Deep-linked from Home's "Out of Stock" card: ?filter=outOfStock
    const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

    const [search, setSearch]                     = useState('');
    const [outletFilter, setOutletFilter]         = useState('All');
    const [outOfStockOnly, setOutOfStockOnly]     = useState(() => initialParams.get('filter') === 'outOfStock');
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingStock, setEditingStock]         = useState<StockEntry | null>(null);
    const [editQty, setEditQty]                   = useState('');
    const [stockAction, setStockAction]           = useState<StockAction>('directAdd');
    const [resolvingId, setResolvingId]           = useState<number | null>(null);

    // Local brand/category lists — extended when user quick-creates
    const [brands, setBrands]         = useState(initialBrands);
    const [categories, setCategories] = useState(initialCategories);
    const [quickCreate, setQuickCreate] = useState<'brand' | 'category' | null>(null);

    // ── Direct-add form state ──────────────────────────────────────────────
    // Any product can be picked here — if it's already stocked at the chosen
    // outlet, submitting adds to the existing quantity instead of creating a
    // duplicate entry (see StockController::store).
    const [formOutletId, setFormOutletId] = useState<number | ''>(isSuperadmin ? '' : (userOutletId ?? ''));

    // ── Transfer form state ────────────────────────────────────────────────
    const [transferFromId, setTransferFromId] = useState<number | ''>(isSuperadmin ? '' : (userOutletId ?? ''));

    const transferProducts = useMemo(() => {
        if (!transferFromId) return [];
        return products.filter(p => allStocks.some(s => s.outlet_id === transferFromId && s.product_id === p.id));
    }, [products, allStocks, transferFromId]);

    const toOutlets = useMemo(() => outlets.filter(o => o.id !== transferFromId), [outlets, transferFromId]);

    // ── Outlet pills (ledger) ──────────────────────────────────────────────
    const outletCodes = useMemo(() => ['All', ...outlets.map(o => o.code)], [outlets]);

    const filtered = useMemo(() =>
        stocks.filter(s => {
            const matchOutlet = outletFilter === 'All' || s.outlet.code === outletFilter;
            const matchStockLevel = !outOfStockOnly || Number(s.quantity) <= 0;
            const q = search.toLowerCase();
            const matchSearch = !q ||
                s.product.name.toLowerCase().includes(q) ||
                s.product.brand.name.toLowerCase().includes(q) ||
                s.product.category.name.toLowerCase().includes(q) ||
                (s.product.model_number ?? '').toLowerCase().includes(q);
            return matchOutlet && matchStockLevel && matchSearch;
        }),
    [stocks, search, outletFilter, outOfStockOnly]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 15);

    // ── Add form ──────────────────────────────────────────────────────────
    const addForm = useForm<{
        product_id: number | '';
        outlet_id:  number | '';
        quantity:   string;
        cost:       string;
    }>({
        product_id: '',
        outlet_id:  isSuperadmin ? '' : (userOutletId ?? ''),
        quantity:   '',
        cost:       '',
    });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.post(stocksRoute.store().url, {
            preserveScroll: true,
            preserveState: true,
            only: ['stocks', 'allStocks', 'flash'],
            onSuccess: () => addForm.reset(),
        });
    };

    // ── Transfer form ─────────────────────────────────────────────────────
    const transferForm = useForm<{
        product_id:     number | '';
        from_outlet_id: number | '';
        to_outlet_id:   number | '';
        quantity:       string;
    }>({
        product_id:     '',
        from_outlet_id: isSuperadmin ? '' : (userOutletId ?? ''),
        to_outlet_id:   '',
        quantity:       '',
    });

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        transferForm.post(stocksRoute.transfer().url, {
            preserveScroll: true,
            preserveState: true,
            only: ['stocks', 'allStocks', 'pendingTransfers', 'flash'],
            onSuccess: () => {
                transferForm.reset();
                setTransferFromId(isSuperadmin ? '' : (userOutletId ?? ''));
            },
        });
    };

    // ── Pending transfer actions ───────────────────────────────────────────
    const handleAcceptTransfer = (id: number) => {
        setResolvingId(id);
        router.post(transfersRoute.accept(id).url, {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['stocks', 'allStocks', 'pendingTransfers', 'flash'],
            onFinish: () => setResolvingId(null),
        });
    };

    const handleRejectTransfer = (id: number) => {
        setResolvingId(id);
        router.post(transfersRoute.reject(id).url, {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['pendingTransfers', 'flash'],
            onFinish: () => setResolvingId(null),
        });
    };

    // ── Edit qty ──────────────────────────────────────────────────────────
    const openEdit = (stock: StockEntry) => {
        setEditingStock(stock);
        setEditQty(stock.quantity);
    };

    const handleSaveQty = () => {
        if (!editingStock) return;
        router.put(stocksRoute.update(editingStock.id).url, { quantity: editQty }, {
            preserveScroll: true,
            onSuccess: () => setEditingStock(null),
        });
    };

    // ── Quick product creation ─────────────────────────────────────────────
    const productForm = useForm({
        name: '', model_number: '', type: '', warranty: '',
        brand_id:    '' as number | '',
        category_id: '' as number | '',
        outlets:     [] as { id: number; initial_qty: number; cost: string }[],
    });

    const handleCreateProduct = (e: React.FormEvent) => {
        e.preventDefault();
        productForm.post(productsRoute.store().url, {
            onSuccess: () => { setShowProductModal(false); productForm.reset(); },
        });
    };

    return (
        <PosShell activeNav="store">
            <Head title={t('stockMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* Stock entry card with tabs */}
                <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">

                    {/* Tab toggle */}
                    <div className="grid grid-cols-2 gap-0 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                        <button
                            type="button"
                            onClick={() => setStockAction('directAdd')}
                            className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${stockAction === 'directAdd' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            {t('stock.newStock')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStockAction('transferStock')}
                            className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${stockAction === 'transferStock' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            {t('stock.transferStock')}
                        </button>
                    </div>

                    {/* ── Direct add form ── */}
                    {stockAction === 'directAdd' && (
                        <>
                            <SectionHeading icon="↓" label={t('stockMgmt.addStock')} />
                            <form onSubmit={handleAdd} className="space-y-4">
                                {isSuperadmin && (
                                    <FormSelect
                                        label={t('stockMgmt.outlet') + ' *'}
                                        value={addForm.data.outlet_id}
                                        onChange={e => {
                                            const id = Number(e.target.value);
                                            addForm.setData('outlet_id', id);
                                            setFormOutletId(id);
                                            addForm.setData('product_id', '');
                                        }}
                                        required
                                    >
                                        <option value="">{t('stockMgmt.filterByOutlet')}...</option>
                                        {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                    </FormSelect>
                                )}

                                <ProductSelect
                                    label={t('stockMgmt.product') + ' *'}
                                    products={products}
                                    value={addForm.data.product_id}
                                    onChange={id => addForm.setData('product_id', id)}
                                    placeholder={t('stockMgmt.selectProduct')}
                                />

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-600">{t('stockMgmt.orAddProduct')}</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowProductModal(true)}
                                        className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-400 hover:bg-indigo-500/20"
                                    >
                                        {t('stockMgmt.addNewProduct')}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <FormInput
                                        label={t('stockMgmt.quantity') + ' *'}
                                        type="number" min={0} step="0.01" placeholder="0"
                                        value={addForm.data.quantity}
                                        onChange={e => addForm.setData('quantity', e.target.value)}
                                        required
                                    />
                                    <FormInput
                                        label={t('stockMgmt.cost') + ' *'}
                                        type="number" min={0} step="0.01" placeholder="0.00"
                                        value={addForm.data.cost}
                                        onChange={e => addForm.setData('cost', e.target.value)}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={addForm.processing}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                                >
                                    {addForm.processing ? t('stockMgmt.adding') : '✓ ' + t('stockMgmt.addBtn')}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Transfer form ── */}
                    {stockAction === 'transferStock' && (
                        <>
                            <SectionHeading icon="" label={t('stock.transferTitle')} />
                            <form onSubmit={handleTransfer} className="space-y-4">

                                {/* From outlet - superadmin picks, outlet user sees their own (locked) */}
                                {isSuperadmin ? (
                                    <FormSelect
                                        label={t('stockMgmt.fromOutlet') + ' *'}
                                        value={transferForm.data.from_outlet_id}
                                        onChange={e => {
                                            const id = Number(e.target.value);
                                            transferForm.setData('from_outlet_id', id);
                                            transferForm.setData('product_id', '');
                                            transferForm.setData('to_outlet_id', '');
                                            setTransferFromId(id);
                                        }}
                                        required
                                    >
                                        <option value="">{t('stockMgmt.filterByOutlet')}...</option>
                                        {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                    </FormSelect>
                                ) : (
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('stockMgmt.fromOutlet')}</label>
                                        <div className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                                            {outlets.find(o => o.id === userOutletId)?.name ?? '-'}
                                        </div>
                                    </div>
                                )}

                                {/* Product - only those stocked at from-outlet */}
                                <ProductSelect
                                    label={t('stock.transferItem') + ' *'}
                                    products={transferProducts}
                                    value={transferForm.data.product_id}
                                    onChange={id => transferForm.setData('product_id', id)}
                                    disabled={!transferFromId}
                                    placeholder={
                                        !transferFromId
                                            ? t('stockMgmt.filterByOutlet') + '...'
                                            : transferProducts.length === 0
                                                ? t('stockMgmt.noProductsToTransfer')
                                                : t('stockMgmt.selectProduct')
                                    }
                                />

                                {/* To outlet */}
                                <FormSelect
                                    label={t('stockMgmt.toOutlet') + ' *'}
                                    value={transferForm.data.to_outlet_id}
                                    onChange={e => transferForm.setData('to_outlet_id', Number(e.target.value))}
                                    disabled={!transferFromId}
                                    required
                                >
                                    <option value="">{t('stockMgmt.filterByOutlet')}...</option>
                                    {toOutlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                </FormSelect>

                                {/* Quantity */}
                                <FormInput
                                    label={t('stock.transferQty') + ' *'}
                                    type="number" min={0.01} step="0.01" placeholder="0"
                                    value={transferForm.data.quantity}
                                    onChange={e => transferForm.setData('quantity', e.target.value)}
                                    required
                                />

                                {transferForm.errors.quantity && (
                                    <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-400">
                                        {transferForm.errors.quantity}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={transferForm.processing}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/10 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
                                >
                                    {transferForm.processing ? t('stockMgmt.transferring') : '⇄ ' + t('stockMgmt.transferBtn')}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {/* Pending transfers */}
                {pendingTransfers.length > 0 && (
                    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                        <SectionHeading icon="" label={t('stockMgmt.pendingTransfers')} badge={String(pendingTransfers.length)} />
                        <div className="space-y-2">
                            {pendingTransfers.map(pt => {
                                const canAct = isSuperadmin || pt.to_outlet.id === userOutletId;
                                const busy = resolvingId === pt.id;
                                return (
                                    <div key={pt.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-white">
                                                {pt.product.brand.name} {pt.product.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {pt.product.category.name} • {Number(pt.quantity).toLocaleString()} {t('stock.pcs')}
                                            </p>
                                            <p className="mt-1 text-xs font-medium text-indigo-400">
                                                {pt.from_outlet.code} → {pt.to_outlet.code}
                                            </p>
                                            <p className="text-[10px] text-slate-600">
                                                {t('stockMgmt.requestedBy')}: {pt.requested_by.name}
                                            </p>
                                        </div>
                                        {canAct ? (
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => handleAcceptTransfer(pt.id)}
                                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                                                >
                                                    {busy ? t('stockMgmt.accepting') : t('stockMgmt.accept')}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => handleRejectTransfer(pt.id)}
                                                    className="rounded-xl bg-rose-600/90 px-3 py-2 text-[10px] font-bold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-60"
                                                >
                                                    {busy ? t('stockMgmt.rejecting') : t('stockMgmt.reject')}
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                                                {t('stockMgmt.awaitingAcceptance')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Stock ledger */}
                <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <SectionHeading icon="" label={t('stockMgmt.currentStock')} badge={t('common.live')} />

                    {/* Search */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                            <Search className="h-4 w-4" />
                        </span>
                        <input
                            type="text"
                            placeholder={t('stock.searchPlaceholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-300 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {/* Outlet pills */}
                    {outlets.length > 1 && (
                        <div className="flex space-x-1.5 overflow-x-auto pb-1">
                            {outletCodes.map(code => (
                                <button
                                    key={code}
                                    onClick={() => setOutletFilter(code)}
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${outletFilter === code ? 'bg-indigo-600 text-white' : 'border border-slate-800 text-slate-400 hover:text-white'}`}
                                >
                                    {code}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Active out-of-stock filter — set via deep link from Home's card */}
                    {outOfStockOnly && (
                        <button onClick={() => setOutOfStockOnly(false)}
                            className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
                            {t('home.outOfStock')}
                            <X className="h-3 w-3" />
                        </button>
                    )}

                    {/* Rows */}
                    <div className="space-y-2">
                        {total === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
                                    <Package className="h-5 w-5 text-slate-600" />
                                </div>
                                <p className="text-sm font-semibold text-slate-500">{t('stockMgmt.noStock')}</p>
                            </div>
                        ) : paged.map(s => (
                            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-slate-700">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {s.product.brand.name} {s.product.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {s.product.category.name} • {s.outlet.code}{s.product.model_number ? ` • ${s.product.model_number}` : ''}{s.product.warranty ? ` • ${s.product.warranty}` : ''}
                                    </p>
                                    {s.product.type && (
                                        <p className="text-[10px] text-slate-500">{s.product.type}</p>
                                    )}
                                </div>
                                <div className="ml-3 flex items-center gap-2">
                                    <span className={`rounded-xl px-2 py-1 text-[10px] font-black ${Number(s.quantity) > 2 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {Number(s.quantity).toLocaleString()} {t('stock.pcs')}
                                    </span>
                                    <button
                                        onClick={() => openEdit(s)}
                                        className="rounded-xl bg-slate-800 p-1.5 text-slate-400 transition-all hover:text-indigo-400"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} total={total} perPage={15} onPage={goTo} />
                </div>
            </div>

            {/* Edit qty modal */}
            {editingStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                                    <Pencil className="h-4 w-4 text-indigo-400" />
                                </div>
                                <h2 className="font-black text-white">{t('stockMgmt.editQty')}</h2>
                            </div>
                            <button onClick={() => setEditingStock(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="font-semibold text-white">{editingStock.product.brand.name} {editingStock.product.name}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{editingStock.product.category.name} • {editingStock.outlet.code}</p>
                            </div>

                            <FormInput
                                label={t('stockMgmt.newQty')}
                                type="number" min={0} step="0.01"
                                value={editQty}
                                onChange={e => setEditQty(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="border-t border-slate-800 px-6 py-4">
                            <button
                                onClick={handleSaveQty}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                            >
                                {t('stockMgmt.saveQty')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Product modal */}
            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <div className="my-auto w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10">
                                    <Package className="h-4 w-4 text-sky-400" />
                                </div>
                                <h2 className="font-black text-white">{t('productMgmt.addNew')}</h2>
                            </div>
                            <button onClick={() => setShowProductModal(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProduct}>
                        <div className="space-y-4 px-6 py-5">
                            <FormInput label={t('productMgmt.productName') + ' *'} placeholder={t('productMgmt.namePlaceholder')} value={productForm.data.name} onChange={e => productForm.setData('name', e.target.value)} required />

                            <div className="grid grid-cols-2 gap-2">
                                <FormInput label={t('productMgmt.modelNumber')} placeholder={t('productMgmt.modelPlaceholder')} value={productForm.data.model_number} onChange={e => productForm.setData('model_number', e.target.value)} />
                                <FormInput label={t('productMgmt.type')} placeholder={t('productMgmt.typePlaceholder')} value={productForm.data.type} onChange={e => productForm.setData('type', e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('productMgmt.brand')} *</label>
                                    <div className="flex gap-1">
                                        <select
                                            className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={productForm.data.brand_id}
                                            onChange={e => productForm.setData('brand_id', Number(e.target.value))}
                                            required
                                        >
                                            <option value="">{t('productMgmt.selectBrand')}</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('brand')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('productMgmt.category')} *</label>
                                    <div className="flex gap-1">
                                        <select
                                            className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={productForm.data.category_id}
                                            onChange={e => productForm.setData('category_id', Number(e.target.value))}
                                            required
                                        >
                                            <option value="">{t('productMgmt.selectCategory')}</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('category')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <FormInput label={t('productMgmt.warranty')} placeholder={t('productMgmt.warrantyPlaceholder')} value={productForm.data.warranty} onChange={e => productForm.setData('warranty', e.target.value)} />

                            <p className="text-xs text-slate-500">Product will be saved without outlet assignment — add it to stock using the form above.</p>
                        </div>

                        <div className="border-t border-slate-800 px-6 py-4">
                            <button
                                type="submit"
                                disabled={productForm.processing}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
                            >
                                {productForm.processing ? t('productMgmt.creating') : t('productMgmt.createBtn')}
                            </button>
                        </div>
                        </form>
                    </div>
                </div>
            )}
            {quickCreate === 'brand' && (
                <QuickCreateModal
                    title="New Brand"
                    placeholder="Brand name..."
                    url={brandsRoute.store().url}
                    onSuccess={item => {
                        setBrands(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
                        productForm.setData('brand_id', item.id);
                    }}
                    onClose={() => setQuickCreate(null)}
                />
            )}
            {quickCreate === 'category' && (
                <QuickCreateModal
                    title="New Category"
                    placeholder="Category name..."
                    url={categoriesRoute.store().url}
                    onSuccess={item => {
                        setCategories(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
                        productForm.setData('category_id', item.id);
                    }}
                    onClose={() => setQuickCreate(null)}
                />
            )}
        </PosShell>
    );
}
