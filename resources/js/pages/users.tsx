import { Head, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Pencil, Plus, Search, ShieldCheck, Store, Trash2, Users as UsersIcon } from 'lucide-react';
import PosShell from '@/components/pos-shell';
import Pagination from '@/components/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { useAuth } from '@/hooks/use-auth';

type Outlet = {
    id: number;
    name: string;
};

type AppUser = {
    id: number;
    name: string;
    email: string;
    is_superadmin: boolean;
    outlet_id: number | null;
    outlet: Outlet | null;
};

type Props = {
    users: AppUser[];
    outlets: Outlet[];
    flash?: { success?: string; error?: string };
};

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
            {children}
            {error && <p className="mt-1 text-[10px] text-rose-400">{error}</p>}
        </div>
    );
}

const inputCls = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20';

export default function Users({ users, outlets, flash }: Props) {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() =>
        !search.trim() ? users : users.filter(u =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        ),
    [users, search]);
    const { paged, page, totalPages, total, goTo } = usePagination(filtered, 15);

    // ── Create form ──
    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        is_superadmin: false as boolean,
        outlet_id: '' as number | '',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/users', {
            onSuccess: () => createForm.reset(),
        });
    };

    // ── Edit form ──
    const editForm = useForm({
        name: '',
        email: '',
        password: '',
        is_superadmin: false as boolean,
        outlet_id: '' as number | '',
    });

    const openEdit = (user: AppUser) => {
        setEditingUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            is_superadmin: user.is_superadmin,
            outlet_id: user.outlet_id ?? '',
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        editForm.put(`/users/${editingUser.id}`, {
            onSuccess: () => setEditingUser(null),
        });
    };

    // ── Delete ──
    const deleteForm = useForm({});
    const handleDelete = (id: number) => {
        if (!confirm(t('userMgmt.deleteConfirm'))) return;
        deleteForm.delete(`/users/${id}`);
    };

    return (
        <PosShell title={t('userMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('userMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {/* Flash */}
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-400">
                        {flash.error}
                    </div>
                )}

                {/* User list */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <UsersIcon className="h-4 w-4 text-emerald-400" />
                            {t('userMgmt.activeUsers')}
                        </h3>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">
                            {total}
                        </span>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder={t('common.search')} value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" />
                    </div>

                    {total === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 mb-3">
                                <UsersIcon className="h-5 w-5 text-slate-500" />
                            </div>
                            <p className="text-sm font-medium text-slate-500">{t('userMgmt.noUsers')}</p>
                        </div>
                    ) : (
                        <>
                        <div className="space-y-3">
                            {paged.map((user) => (
                                <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-slate-700">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                            <UsersIcon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-white">{user.name}</p>
                                                {user.is_superadmin ? (
                                                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                                        <ShieldCheck className="h-2.5 w-2.5" />{t('userMgmt.superadmin')}
                                                    </span>
                                                ) : user.outlet && (
                                                    <span className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                                                        <Store className="h-2.5 w-2.5" />{user.outlet.name}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-indigo-500/30 hover:text-indigo-400"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                disabled={deleteForm.processing || user.id === currentUser.id}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-rose-500/30 hover:text-rose-400 disabled:opacity-30 disabled:hover:border-slate-700 disabled:hover:text-slate-400"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination page={page} totalPages={totalPages} total={total} perPage={15} onPage={goTo} />
                        </>
                    )}
                </div>

                {/* Create form */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Plus className="h-4 w-4 text-indigo-400" />
                            {t('userMgmt.addNew')}
                        </h3>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <FormField label={t('userMgmt.name') + ' *'} error={createForm.errors.name}>
                                <input
                                    className={inputCls}
                                    placeholder={t('userMgmt.namePlaceholder')}
                                    value={createForm.data.name}
                                    onChange={e => createForm.setData('name', e.target.value)}
                                    required
                                />
                            </FormField>

                            <div className="grid grid-cols-2 gap-3">
                                <FormField label={t('userMgmt.email') + ' *'} error={createForm.errors.email}>
                                    <input
                                        type="email"
                                        className={inputCls}
                                        placeholder={t('userMgmt.emailPlaceholder')}
                                        value={createForm.data.email}
                                        onChange={e => createForm.setData('email', e.target.value)}
                                        required
                                    />
                                </FormField>
                                <FormField label={t('userMgmt.password') + ' *'} error={createForm.errors.password}>
                                    <input
                                        type="password"
                                        className={inputCls}
                                        placeholder={t('userMgmt.passwordMinLength')}
                                        value={createForm.data.password}
                                        onChange={e => createForm.setData('password', e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </FormField>
                            </div>

                            <label className="flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm text-amber-400">
                                <input
                                    type="checkbox"
                                    checked={createForm.data.is_superadmin}
                                    onChange={e => createForm.setData('is_superadmin', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-amber-500"
                                />
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {t('userMgmt.makeSuperadmin')}
                            </label>

                            {!createForm.data.is_superadmin && (
                                <FormField label={t('userMgmt.outlet') + ' *'} error={createForm.errors.outlet_id}>
                                    <select
                                        className={inputCls}
                                        value={createForm.data.outlet_id}
                                        onChange={e => createForm.setData('outlet_id', e.target.value ? Number(e.target.value) : '')}
                                        required
                                    >
                                        <option value="">{t('userMgmt.selectOutlet')}</option>
                                        {outlets.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </FormField>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={createForm.processing}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            {createForm.processing ? t('userMgmt.creating') : t('userMgmt.createBtn')}
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
                    <div className="w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                <Pencil className="h-4 w-4 text-indigo-400" />
                                {t('userMgmt.editTitle')}
                            </h3>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 transition-all hover:border-slate-600 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div className="px-6 py-5">
                                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                                    <FormField label={t('userMgmt.name') + ' *'} error={editForm.errors.name}>
                                        <input className={inputCls} value={editForm.data.name} onChange={e => editForm.setData('name', e.target.value)} required />
                                    </FormField>
                                    <FormField label={t('userMgmt.email') + ' *'} error={editForm.errors.email}>
                                        <input type="email" className={inputCls} value={editForm.data.email} onChange={e => editForm.setData('email', e.target.value)} required />
                                    </FormField>
                                    <FormField label={t('userMgmt.newPassword')} error={editForm.errors.password}>
                                        <input
                                            type="password"
                                            className={inputCls}
                                            placeholder={t('userMgmt.leaveBlank')}
                                            value={editForm.data.password}
                                            onChange={e => editForm.setData('password', e.target.value)}
                                            minLength={6}
                                        />
                                    </FormField>

                                    <label className={`flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm text-amber-400 ${editingUser.id === currentUser.id ? 'opacity-50' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={editForm.data.is_superadmin}
                                            disabled={editingUser.id === currentUser.id}
                                            onChange={e => editForm.setData('is_superadmin', e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-amber-500"
                                        />
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('userMgmt.makeSuperadmin')}
                                    </label>

                                    {!editForm.data.is_superadmin && (
                                        <FormField label={t('userMgmt.outlet') + ' *'} error={editForm.errors.outlet_id}>
                                            <select
                                                className={inputCls}
                                                value={editForm.data.outlet_id}
                                                onChange={e => editForm.setData('outlet_id', e.target.value ? Number(e.target.value) : '')}
                                                required
                                            >
                                                <option value="">{t('userMgmt.selectOutlet')}</option>
                                                {outlets.map(o => (
                                                    <option key={o.id} value={o.id}>{o.name}</option>
                                                ))}
                                            </select>
                                        </FormField>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-800 px-6 py-4">
                                <button
                                    type="submit"
                                    disabled={editForm.processing}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    {editForm.processing ? t('userMgmt.saving') : t('userMgmt.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PosShell>
    );
}
