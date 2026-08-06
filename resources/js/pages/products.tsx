import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Package, Pencil, Plus, Search, Trash2, Store, X } from 'lucide-react';
import { usePagination } from '@/hooks/use-pagination';
import Pagination from '@/components/pagination';
import PosShell from '@/components/pos-shell';
import { useAuth } from '@/hooks/use-auth';
import { QuickCreateModal } from '@/components/quick-create-modal';
import * as productsRoute from '@/routes/products';
import * as brandsRoute from '@/routes/brands';
import * as categoriesRoute from '@/routes/categories';

type Brand    = { id: number; name: string };
type Category = { id: number; name: string };
type Outlet   = { id: number; name: string; code: string };

type OutletPivot = Outlet & {
    pivot: { initial_qty: number; cost: string };
};

type Product = {
    id: number;
    name: string;
    model_number: string | null;
    type: string | null;
    warranty: string | null;
    is_active: boolean;
    image_url: string | null;
    brand: Brand;
    category: Category;
    outlets: OutletPivot[];
};

type OutletEntry = { id: number; initial_qty: number; cost: string };

type FormData = {
    name: string;
    model_number: string;
    type: string;
    warranty: string;
    brand_id: number | '';
    category_id: number | '';
    is_active: boolean;
    outlets: OutletEntry[];
    image: File | null;
};

type Props = {
    products: Product[];
    brands: Brand[];
    categories: Category[];
    outlets: Outlet[];
    outletId: number | null;
    flash?: { success?: string };
};

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
            {children}
            {error && <p className="mt-1 text-[10px] text-rose-400">{error}</p>}
        </div>
    );
}

const inputCls   = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500';
const selectCls  = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500';

function ImageUpload({
    inputId,
    current,
    preview,
    onChange,
}: {
    inputId: string;
    current: string | null;
    preview: string | null;
    onChange: (file: File | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleRemove = () => {
        onChange(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                {preview ? (
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : current ? (
                    <img src={current} alt="" className="h-full w-full object-cover" />
                ) : (
                    <Package className="h-6 w-6 text-slate-600" />
                )}
            </div>
            <div className="flex-1">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    id={inputId}
                    className="hidden"
                    onChange={e => onChange(e.target.files?.[0] ?? null)}
                />
                <label
                    htmlFor={inputId}
                    className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors"
                >
                    {preview || current ? 'Change Image' : 'Upload Image'}
                </label>
                {(preview || current) && (
                    <button type="button" onClick={handleRemove}
                        className="ml-2 text-xs text-rose-400 hover:text-rose-300">
                        Remove
                    </button>
                )}
                <p className="mt-1 text-[10px] text-slate-600">JPG, PNG, WebP · max 2 MB</p>
            </div>
        </div>
    );
}

function OutletStockEditor({
    outlets,
    entries,
    onChange,
}: {
    outlets: Outlet[];
    entries: OutletEntry[];
    onChange: (entries: OutletEntry[]) => void;
}) {
    const { t } = useTranslation();

    const toggle = (outlet: Outlet) => {
        const exists = entries.find(e => e.id === outlet.id);
        if (exists) {
            onChange(entries.filter(e => e.id !== outlet.id));
        } else {
            onChange([...entries, { id: outlet.id, initial_qty: 0, cost: '0' }]);
        }
    };

    const update = (id: number, field: 'initial_qty' | 'cost', value: string) => {
        onChange(entries.map(e =>
            e.id === id ? { ...e, [field]: field === 'initial_qty' ? parseInt(value) || 0 : value } : e
        ));
    };

    return (
        <div className="space-y-2">
            {outlets.map(outlet => {
                const entry = entries.find(e => e.id === outlet.id);
                const checked = !!entry;
                return (
                    <div key={outlet.id} className={`rounded-2xl border transition-all ${checked ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-slate-800 bg-slate-950'}`}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-2.5">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(outlet)}
                                className="accent-indigo-500"
                            />
                            <span className="text-sm font-semibold text-slate-100">{outlet.name}</span>
                            <span className="rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{outlet.code}</span>
                        </label>
                        {checked && (
                            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                                <FormField label={t('productMgmt.initialQty')}>
                                    <input
                                        type="number"
                                        min={0}
                                        className={inputCls}
                                        value={entry!.initial_qty}
                                        onChange={e => update(outlet.id, 'initial_qty', e.target.value)}
                                    />
                                </FormField>
                                <FormField label={t('productMgmt.cost')}>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        className={inputCls}
                                        value={entry!.cost}
                                        onChange={e => update(outlet.id, 'cost', e.target.value)}
                                    />
                                </FormField>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function Products({ products, brands: initialBrands, categories: initialCategories, outlets, outletId, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin, outletId: userOutletId } = useAuth();
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Outlets a non-superadmin can assign stock to — only their own.
    const assignableOutlets = useMemo(
        () => isSuperadmin ? outlets : outlets.filter(o => o.id === userOutletId),
        [outlets, isSuperadmin, userOutletId]
    );

    const applyOutlet = (id: number | null) => {
        router.get('/products', id ? { outlet_id: id } : {}, { preserveState: false });
    };

    // Local brand/category lists — extended when user quick-creates
    const [brands, setBrands]         = useState(initialBrands);
    const [categories, setCategories] = useState(initialCategories);
    const [quickCreate, setQuickCreate] = useState<'brand' | 'category' | null>(null);

    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return products;
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.model_number ?? '').toLowerCase().includes(q) ||
            p.brand.name.toLowerCase().includes(q) ||
            p.category.name.toLowerCase().includes(q)
        );
    }, [products, search]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 10);

    const blankForm = (): FormData => ({
        name: '', model_number: '', type: '', warranty: '',
        brand_id: '', category_id: '', is_active: true, outlets: [], image: null,
    });

    const createForm = useForm<FormData>(blankForm());
    const [createPreview, setCreatePreview] = useState<string | null>(null);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(productsRoute.store().url, {
            forceFormData: true,
            onSuccess: () => {
                createForm.setData(blankForm());
                setCreatePreview(null);
            },
        });
    };

    const editForm = useForm<FormData>(blankForm());
    const [editPreview, setEditPreview] = useState<string | null>(null);
    const [editImageFile, setEditImageFile] = useState<File | null>(null);

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        editForm.setData({
            name:         product.name,
            model_number: product.model_number ?? '',
            type:         product.type ?? '',
            warranty:     product.warranty ?? '',
            brand_id:     product.brand.id,
            category_id:  product.category.id,
            is_active:    product.is_active,
            outlets:      product.outlets.map(o => ({
                id:          o.id,
                initial_qty: o.pivot.initial_qty,
                cost:        o.pivot.cost,
            })),
            image: null,
        });
        setEditPreview(null);
        setEditImageFile(null);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        router.post(productsRoute.update(editingProduct.id).url, {
            _method: 'PUT',
            name:         editForm.data.name,
            model_number: editForm.data.model_number,
            type:         editForm.data.type,
            warranty:     editForm.data.warranty,
            brand_id:     editForm.data.brand_id,
            category_id:  editForm.data.category_id,
            is_active:    editForm.data.is_active,
            outlets:      editForm.data.outlets,
            ...(editImageFile ? { image: editImageFile } : {}),
        }, { forceFormData: true, onSuccess: () => setEditingProduct(null) });
    };

    const deleteForm = useForm({});
    const handleDelete = (id: number) => {
        if (!confirm(t('productMgmt.deleteConfirm'))) return;
        deleteForm.delete(productsRoute.destroy(id).url);
    };

    return (
        <PosShell title={t('productMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('productMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* Product list */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Package className="h-4 w-4 text-sky-400" /> {t('productMgmt.allProducts')}
                        </h3>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">{total}</span>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Search by name, model, brand, category..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" />
                    </div>

                    {/* Outlet filter — superadmin only: view all stores combined or individually */}
                    {isSuperadmin && outlets.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                            <button onClick={() => applyOutlet(null)}
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${!outletId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'}`}>
                                <Store className="h-3 w-3" /> {t('stockMgmt.allOutlets')}
                            </button>
                            {outlets.map(o => (
                                <button key={o.id} onClick={() => applyOutlet(o.id)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${outletId === o.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'}`}>
                                    {o.code}
                                </button>
                            ))}
                        </div>
                    )}

                    {total === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800">
                                <Package className="h-6 w-6 text-slate-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">{t('productMgmt.noProducts')}</p>
                            <p className="mt-1 text-xs text-slate-600">{t('common.addOneBelow')}</p>
                        </div>
                    ) : (
                        <>
                        <div className="space-y-2">
                            {paged.map(product => (
                                <div key={product.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Package className="h-5 w-5 text-slate-600" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-sm font-semibold text-white">{product.name}</span>
                                                    {product.model_number && (
                                                        <span className="rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{product.model_number}</span>
                                                    )}
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${
                                                        product.is_active
                                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                                            : 'border-slate-700 bg-slate-800 text-slate-500'
                                                    }`}>
                                                        {product.is_active ? t('productMgmt.active') : t('productMgmt.inactive')}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">{product.category.name}</span>
                                                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">{product.brand.name}</span>
                                                    {product.type && (
                                                        <span className="rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{product.type}</span>
                                                    )}
                                                    {product.warranty && (
                                                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">{product.warranty}</span>
                                                    )}
                                                </div>
                                                {product.outlets.length > 0 && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {product.outlets.map(o => (
                                                            <span key={o.id} className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                                                                <Store className="h-2.5 w-2.5" /> {o.code} · {o.pivot.initial_qty} · NPR {Number(o.pivot.cost).toLocaleString()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                onClick={() => openEdit(product)}
                                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-all hover:border-indigo-500/50 hover:text-indigo-400"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            {isSuperadmin && (
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    disabled={deleteForm.processing}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-all hover:border-rose-500/50 hover:text-rose-400 disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination page={page} totalPages={totalPages} total={total} perPage={10} onPage={goTo} />
                        </>
                    )}
                </div>

                {/* Create form */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Plus className="h-4 w-4 text-indigo-400" /> {t('productMgmt.addNew')}
                        </h3>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-4">
                        {/* Basic info */}
                        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <Package className="h-3 w-3" /> Product Details
                            </p>

                            <ImageUpload
                                inputId="product-image-create"
                                current={null}
                                preview={createPreview}
                                onChange={file => {
                                    if (file) {
                                        setCreatePreview(URL.createObjectURL(file));
                                        createForm.setData('image', file);
                                    } else {
                                        setCreatePreview(null);
                                        createForm.setData('image', null);
                                    }
                                }}
                            />

                            <FormField label={t('productMgmt.productName') + ' *'} error={createForm.errors.name}>
                                <input className={inputCls} placeholder={t('productMgmt.namePlaceholder')} value={createForm.data.name} onChange={e => createForm.setData('name', e.target.value)} required />
                            </FormField>

                            <div className="grid grid-cols-2 gap-2">
                                <FormField label={t('productMgmt.modelNumber')} error={createForm.errors.model_number}>
                                    <input className={inputCls} placeholder={t('productMgmt.modelPlaceholder')} value={createForm.data.model_number} onChange={e => createForm.setData('model_number', e.target.value)} />
                                </FormField>
                                <FormField label={t('productMgmt.type')} error={createForm.errors.type}>
                                    <input className={inputCls} placeholder={t('productMgmt.typePlaceholder')} value={createForm.data.type} onChange={e => createForm.setData('type', e.target.value)} />
                                </FormField>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <FormField label={t('productMgmt.brand') + ' *'} error={createForm.errors.brand_id}>
                                    <div className="flex gap-1">
                                        <select className={`${selectCls} min-w-0 flex-1`} value={createForm.data.brand_id} onChange={e => createForm.setData('brand_id', Number(e.target.value))} required>
                                            <option value="">{t('productMgmt.selectBrand')}</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('brand')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </FormField>
                                <FormField label={t('productMgmt.category') + ' *'} error={createForm.errors.category_id}>
                                    <div className="flex gap-1">
                                        <select className={`${selectCls} min-w-0 flex-1`} value={createForm.data.category_id} onChange={e => createForm.setData('category_id', Number(e.target.value))} required>
                                            <option value="">{t('productMgmt.selectCategory')}</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('category')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </FormField>
                            </div>

                            <FormField label={t('productMgmt.warranty')} error={createForm.errors.warranty}>
                                <input className={inputCls} placeholder={t('productMgmt.warrantyPlaceholder')} value={createForm.data.warranty} onChange={e => createForm.setData('warranty', e.target.value)} />
                            </FormField>
                        </div>

                        {/* Outlet stock */}
                        <div className="space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                <Store className="h-3 w-3" /> {t('productMgmt.outletStock')}
                            </p>
                            <p className="text-xs text-slate-500">{t('productMgmt.outletStockDesc')}</p>
                            {outlets.length === 0
                                ? <p className="text-xs text-slate-600">{t('productMgmt.noOutlets')}</p>
                                : <OutletStockEditor outlets={assignableOutlets} entries={createForm.data.outlets} onChange={v => createForm.setData('outlets', v)} />
                            }
                        </div>

                        <button
                            type="submit"
                            disabled={createForm.processing}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                        >
                            {createForm.processing ? t('productMgmt.creating') : t('productMgmt.createBtn')}
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit modal */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <div className="my-auto w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                                    <Pencil className="h-4 w-4 text-indigo-400" />
                                </div>
                                <h2 className="font-black text-white">{t('productMgmt.editTitle')}</h2>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate}>
                        <div className="space-y-3 px-6 py-5">
                            <ImageUpload
                                inputId="product-image-edit"
                                current={editingProduct.image_url}
                                preview={editPreview}
                                onChange={file => {
                                    if (file) {
                                        setEditPreview(URL.createObjectURL(file));
                                        setEditImageFile(file);
                                    } else {
                                        setEditPreview(null);
                                        setEditImageFile(null);
                                    }
                                }}
                            />

                            <FormField label={t('productMgmt.name') + ' *'} error={editForm.errors.name}>
                                <input className={inputCls} value={editForm.data.name} onChange={e => editForm.setData('name', e.target.value)} required />
                            </FormField>

                            <div className="grid grid-cols-2 gap-2">
                                <FormField label={t('productMgmt.modelNumber')} error={editForm.errors.model_number}>
                                    <input className={inputCls} value={editForm.data.model_number} onChange={e => editForm.setData('model_number', e.target.value)} />
                                </FormField>
                                <FormField label={t('productMgmt.type')} error={editForm.errors.type}>
                                    <input className={inputCls} value={editForm.data.type} onChange={e => editForm.setData('type', e.target.value)} />
                                </FormField>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <FormField label={t('productMgmt.brand') + ' *'} error={editForm.errors.brand_id}>
                                    <div className="flex gap-1">
                                        <select className={`${selectCls} min-w-0 flex-1`} value={editForm.data.brand_id} onChange={e => editForm.setData('brand_id', Number(e.target.value))} required>
                                            <option value="">{t('productMgmt.selectBrand')}</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('brand')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </FormField>
                                <FormField label={t('productMgmt.category') + ' *'} error={editForm.errors.category_id}>
                                    <div className="flex gap-1">
                                        <select className={`${selectCls} min-w-0 flex-1`} value={editForm.data.category_id} onChange={e => editForm.setData('category_id', Number(e.target.value))} required>
                                            <option value="">{t('productMgmt.selectCategory')}</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setQuickCreate('category')}
                                            className="shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-2 text-indigo-400 hover:bg-indigo-500/20">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </FormField>
                            </div>

                            <FormField label={t('productMgmt.warranty')} error={editForm.errors.warranty}>
                                <input className={inputCls} value={editForm.data.warranty} onChange={e => editForm.setData('warranty', e.target.value)} />
                            </FormField>

                            <div>
                                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('productMgmt.status')}</label>
                                <div className="flex gap-2">
                                    {([true, false] as const).map(val => (
                                        <button key={String(val)} type="button" onClick={() => editForm.setData('is_active', val)}
                                            className={`flex-1 rounded-2xl border py-2 text-xs font-semibold transition-all ${
                                                editForm.data.is_active === val
                                                    ? val ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 bg-slate-800 text-slate-300'
                                                    : 'border-slate-800 bg-slate-950 text-slate-600 hover:border-slate-700'
                                            }`}>
                                            {val ? t('productMgmt.active') : t('productMgmt.inactive')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                    <Store className="h-3 w-3" /> {t('productMgmt.outletStock')}
                                </p>
                                <OutletStockEditor outlets={assignableOutlets} entries={editForm.data.outlets} onChange={v => editForm.setData('outlets', v)} />
                            </div>
                        </div>

                        <div className="border-t border-slate-800 px-6 py-4">
                            <button type="submit" disabled={editForm.processing}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60">
                                {editForm.processing ? t('productMgmt.saving') : t('productMgmt.saveChanges')}
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
                        if (editingProduct) {
                            editForm.setData('brand_id', item.id);
                        } else {
                            createForm.setData('brand_id', item.id);
                        }
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
                        if (editingProduct) {
                            editForm.setData('category_id', item.id);
                        } else {
                            createForm.setData('category_id', item.id);
                        }
                    }}
                    onClose={() => setQuickCreate(null)}
                />
            )}
        </PosShell>
    );
}
