import { Head, router, useForm } from '@inertiajs/react';
import { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, CheckCircle2, AlertCircle, Pencil, Trash2, X, Search } from 'lucide-react';
import { usePagination } from '@/hooks/use-pagination';
import Pagination from '@/components/pagination';
import PosShell from '@/components/pos-shell';
import { useAuth } from '@/hooks/use-auth';
import * as categoriesRoute from '@/routes/categories';

type Category = {
    id: number;
    name: string;
    is_active: boolean;
    image_url: string | null;
};

type Props = {
    categories: Category[];
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
                    <Layers className="h-6 w-6 text-slate-600" />
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

export default function Categories({ categories, flash }: Props) {
    const { isSuperadmin } = useAuth();
    const { t } = useTranslation();
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const createForm = useForm({ name: '', image: null as File | null });
    const [createPreview, setCreatePreview] = useState<string | null>(null);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(categoriesRoute.store().url, {
            forceFormData: true,
            onSuccess: () => {
                createForm.reset();
                setCreatePreview(null);
            },
        });
    };

    const editForm = useForm({ name: '', is_active: true, image: null as File | null });
    const [editPreview, setEditPreview] = useState<string | null>(null);
    const [editImageFile, setEditImageFile] = useState<File | null>(null);

    const openEdit = (category: Category) => {
        setEditingCategory(category);
        editForm.setData({ name: category.name, is_active: category.is_active, image: null });
        setEditPreview(null);
        setEditImageFile(null);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        router.post(categoriesRoute.update(editingCategory.id).url, {
            _method: 'PUT',
            name: editForm.data.name,
            is_active: editForm.data.is_active,
            ...(editImageFile ? { image: editImageFile } : {}),
        }, { forceFormData: true, onSuccess: () => setEditingCategory(null) });
    };

    const [search, setSearch] = useState('');
    const filtered = useMemo(() =>
        !search.trim() ? categories : categories.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase())
        ),
    [categories, search]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 15);

    const deleteForm = useForm({});
    const handleDelete = (id: number) => {
        if (!confirm(t('categoryMgmt.deleteConfirm'))) return;
        deleteForm.delete(categoriesRoute.destroy(id).url);
    };

    return (
        <PosShell title={t('categoryMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('categoryMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* Category list */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Layers className="h-4 w-4 text-amber-400" /> {t('categoryMgmt.allCategories')}
                        </h3>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">{total}</span>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Search categories..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" />
                    </div>

                    {total === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800">
                                <Layers className="h-6 w-6 text-slate-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">{t('categoryMgmt.noCategories')}</p>
                            <p className="mt-1 text-xs text-slate-600">{t('common.addOneBelow')}</p>
                        </div>
                    ) : (
                        <>
                        <div className="space-y-2">
                            {paged.map((category) => (
                                <div key={category.id} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-slate-700">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                                        {category.image_url ? (
                                            <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <Layers className="h-5 w-5 text-amber-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-white">{category.name}</p>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                                        category.is_active
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            : 'border-slate-700 bg-slate-800 text-slate-500'
                                    }`}>
                                        {category.is_active ? t('categoryMgmt.active') : t('categoryMgmt.inactive')}
                                    </span>
                                    {isSuperadmin && (
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => openEdit(category)}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-indigo-500/30 hover:text-indigo-400"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id)}
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
                        <Pagination page={page} totalPages={totalPages} total={total} perPage={15} onPage={goTo} />
                        </>
                    )}
                </div>

                {/* Create form */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-400">{t('categoryMgmt.addNew')}</p>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <ImageUpload
                            inputId="category-image-create"
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
                        <FormField label={t('categoryMgmt.categoryName') + ' *'} error={createForm.errors.name}>
                            <input
                                className={inputCls}
                                placeholder={t('categoryMgmt.namePlaceholder')}
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
                            {createForm.processing ? t('categoryMgmt.creating') : t('categoryMgmt.createBtn')}
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit modal */}
            {editingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                                    <Pencil className="h-4 w-4 text-indigo-400" />
                                </div>
                                <h2 className="font-black text-white">{t('categoryMgmt.editTitle')}</h2>
                            </div>
                            <button
                                onClick={() => setEditingCategory(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-800 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div className="space-y-4 px-6 py-5">
                                <ImageUpload
                                    inputId="category-image-edit"
                                    current={editingCategory.image_url}
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
                                <FormField label={t('categoryMgmt.name') + ' *'} error={editForm.errors.name}>
                                    <input
                                        className={inputCls}
                                        value={editForm.data.name}
                                        onChange={e => editForm.setData('name', e.target.value)}
                                        required
                                    />
                                </FormField>

                                <div>
                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('categoryMgmt.status')}</label>
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
                                                {val ? t('categoryMgmt.active') : t('categoryMgmt.inactive')}
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
                                    {editForm.processing ? t('categoryMgmt.saving') : t('categoryMgmt.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PosShell>
    );
}
