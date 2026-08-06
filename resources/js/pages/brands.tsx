import { Head, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, CheckCircle2, AlertCircle, Pencil, Search, Trash2, X } from 'lucide-react';
import PosShell from '@/components/pos-shell';
import Pagination from '@/components/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { useAuth } from '@/hooks/use-auth';
import * as brandsRoute from '@/routes/brands';

type Brand = {
    id: number;
    name: string;
    is_active: boolean;
};

type Props = {
    brands: Brand[];
    flash?: { success?: string };
};

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            {children}
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-rose-400">
                    <AlertCircle className="h-3 w-3" /> {error}
                </p>
            )}
        </div>
    );
}

const inputCls = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20';

export default function Brands({ brands, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() =>
        !search.trim() ? brands : brands.filter(b =>
            b.name.toLowerCase().includes(search.toLowerCase())
        ),
    [brands, search]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 15);

    const createForm = useForm({ name: '' });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(brandsRoute.store().url, {
            onSuccess: () => createForm.reset(),
        });
    };

    const editForm = useForm({ name: '', is_active: true });

    const openEdit = (brand: Brand) => {
        setEditingBrand(brand);
        editForm.setData({ name: brand.name, is_active: brand.is_active });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBrand) return;
        editForm.put(brandsRoute.update(editingBrand.id).url, {
            onSuccess: () => setEditingBrand(null),
        });
    };

    const deleteForm = useForm({});
    const handleDelete = (id: number) => {
        if (!confirm(t('brandMgmt.deleteConfirm'))) return;
        deleteForm.delete(brandsRoute.destroy(id).url);
    };

    return (
        <PosShell title={t('brandMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('brandMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* Brand list */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Award className="h-4 w-4 text-amber-400" /> {t('brandMgmt.allBrands')}
                        </h3>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">{total}</span>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                            <Search className="h-4 w-4" />
                        </span>
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {total === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800">
                                <Award className="h-6 w-6 text-slate-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">{t('brandMgmt.noBrands')}</p>
                            <p className="mt-1 text-xs text-slate-600">{t('common.addOneBelow')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {paged.map((brand) => (
                                <div key={brand.id} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-slate-700">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                                        <Award className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-white">{brand.name}</p>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                                        brand.is_active
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            : 'border-slate-700 bg-slate-800 text-slate-500'
                                    }`}>
                                        {brand.is_active ? t('brandMgmt.active') : t('brandMgmt.inactive')}
                                    </span>
                                    {isSuperadmin && (
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => openEdit(brand)}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-indigo-500/30 hover:text-indigo-400"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(brand.id)}
                                                disabled={deleteForm.processing}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-rose-500/30 hover:text-rose-400 disabled:opacity-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <Pagination page={page} totalPages={totalPages} total={total} perPage={15} onPage={goTo} />
                </div>

                {/* Create form */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-400">{t('brandMgmt.addNew')}</p>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <FormField label={t('brandMgmt.brandName') + ' *'} error={createForm.errors.name}>
                            <input
                                className={inputCls}
                                placeholder={t('brandMgmt.namePlaceholder')}
                                value={createForm.data.name}
                                onChange={e => createForm.setData('name', e.target.value)}
                                required
                            />
                        </FormField>
                        <button
                            type="submit"
                            disabled={createForm.processing}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                        >
                            {createForm.processing ? t('brandMgmt.creating') : t('brandMgmt.createBtn')}
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit modal */}
            {editingBrand && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                                    <Pencil className="h-4 w-4 text-indigo-400" />
                                </div>
                                <h2 className="font-black text-white">{t('brandMgmt.editTitle')}</h2>
                            </div>
                            <button
                                onClick={() => setEditingBrand(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div className="space-y-4 px-6 py-5">
                                <FormField label={t('brandMgmt.name') + ' *'} error={editForm.errors.name}>
                                    <input
                                        className={inputCls}
                                        value={editForm.data.name}
                                        onChange={e => editForm.setData('name', e.target.value)}
                                        required
                                    />
                                </FormField>

                                <div>
                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('brandMgmt.status')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[true, false].map((val) => (
                                            <button
                                                key={String(val)}
                                                type="button"
                                                onClick={() => editForm.setData('is_active', val)}
                                                className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                                                    editForm.data.is_active === val
                                                        ? val
                                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                                            : 'border-slate-700 bg-slate-800/50 text-slate-400'
                                                        : 'border-slate-800 bg-transparent text-slate-600 hover:border-slate-700'
                                                }`}
                                            >
                                                {val ? t('brandMgmt.active') : t('brandMgmt.inactive')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-800 px-6 py-4">
                                <button
                                    type="submit"
                                    disabled={editForm.processing}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {editForm.processing ? t('brandMgmt.saving') : t('brandMgmt.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PosShell>
    );
}
