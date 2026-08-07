import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CheckCircle2, Image, Landmark, User as UserIcon, X } from 'lucide-react';
import PosShell from '@/components/pos-shell';
import Pagination from '@/components/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { useAuth } from '@/hooks/use-auth';
import * as cashTransfersRoute from '@/routes/cash-transfers';

// ─── Types ───────────────────────────────────────────────────────────────────

type PartyType = 'staff' | 'admin' | 'bank';
type UserRef = { id: number; name: string; is_superadmin: boolean };

type CashTransfer = {
    id: number;
    sender_type: PartyType;
    receiver_type: PartyType;
    amount: string;
    status: 'pending' | 'accepted';
    remarks: string | null;
    voucher_image_url: string | null;
    created_at: string;
    sender: UserRef | null;
    receiver: UserRef | null;
};

type StaffWorkflow = 'staff_to_admin' | 'staff_to_bank';
type AdminWorkflow = 'admin_to_bank' | 'bank_to_admin';

type Props = {
    transfers: CashTransfer[];
    flash?: { success?: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' });
};

function partyLabel(type: PartyType, user: UserRef | null, t: (k: string) => string) {
    if (type === 'bank') return t('cashMgmt.bank');
    if (user) return user.name;
    return t('cashMgmt.pendingAdmin');
}

function PartyIcon({ type }: { type: PartyType }) {
    if (type === 'bank') return <Landmark className="h-3.5 w-3.5" />;
    return <UserIcon className="h-3.5 w-3.5" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CashTransfers({ transfers, flash }: Props) {
    const { t } = useTranslation();
    const { isSuperadmin } = useAuth();

    const [staffWorkflow, setStaffWorkflow] = useState<StaffWorkflow>('staff_to_admin');
    const [adminWorkflow, setAdminWorkflow] = useState<AdminWorkflow>('admin_to_bank');
    const [acceptingId, setAcceptingId] = useState<number | null>(null);
    const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
    const voucherInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<{ workflow: StaffWorkflow | AdminWorkflow; amount: string; remarks: string; voucher_image: File | null }>({
        workflow: isSuperadmin ? 'admin_to_bank' : 'staff_to_admin',
        amount: '',
        remarks: '',
        voucher_image: null,
    });

    const activeWorkflow = isSuperadmin ? adminWorkflow : staffWorkflow;
    const isVoucherFlow = activeWorkflow === 'staff_to_bank';

    const clearVoucherImage = () => {
        form.setData('voucher_image', null);
        setVoucherPreview(null);
        if (voucherInputRef.current) voucherInputRef.current.value = '';
    };

    const handleVoucherFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        form.setData('voucher_image', file);
        setVoucherPreview(file ? URL.createObjectURL(file) : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform(data => ({ ...data, workflow: activeWorkflow }));
        form.post(cashTransfersRoute.store().url, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            only: ['transfers', 'flash'],
            onSuccess: () => {
                form.reset('amount', 'remarks', 'voucher_image');
                clearVoucherImage();
            },
        });
    };

    const handleAccept = (id: number) => {
        setAcceptingId(id);
        router.post(cashTransfersRoute.accept(id).url, {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['transfers', 'flash'],
            onFinish: () => setAcceptingId(null),
        });
    };

    const pending = useMemo(() => transfers.filter(tr => tr.status === 'pending'), [transfers]);
    const { paged, page, totalPages, total, goTo } = usePagination(transfers, 15);

    return (
        <PosShell title={t('cashMgmt.title')} backHref="/menu" activeNav="menu">
            <Head title={t('cashMgmt.title')} />

            <div className="space-y-6 px-4 py-5 md:px-6">
                {flash?.success && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}

                {/* ── Record a transfer ───────────────────────────────────── */}
                <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                            <Banknote className="h-4 w-4 text-emerald-400" /> {t('cashMgmt.recordTransfer')}
                        </h3>
                    </div>

                    {/* Workflow toggle */}
                    {isSuperadmin ? (
                        <div className="grid grid-cols-2 gap-0 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                            <button type="button" onClick={() => setAdminWorkflow('admin_to_bank')}
                                className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${adminWorkflow === 'admin_to_bank' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                {t('cashMgmt.adminToBank')}
                            </button>
                            <button type="button" onClick={() => setAdminWorkflow('bank_to_admin')}
                                className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${adminWorkflow === 'bank_to_admin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                {t('cashMgmt.bankToAdmin')}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-0 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                            <button type="button" onClick={() => setStaffWorkflow('staff_to_admin')}
                                className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${staffWorkflow === 'staff_to_admin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                {t('cashMgmt.staffToAdmin')}
                            </button>
                            <button type="button" onClick={() => setStaffWorkflow('staff_to_bank')}
                                className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${staffWorkflow === 'staff_to_bank' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                {t('cashMgmt.staffToBank')}
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t('cashMgmt.amount') + ' *'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">रू</span>
                                <input
                                    type="number" min={0.01} step="0.01" placeholder="0.00"
                                    value={form.data.amount}
                                    onChange={e => form.setData('amount', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-8 pr-3.5 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                                    required
                                />
                            </div>
                            {form.errors.amount && (
                                <p className="mt-1.5 text-[10px] text-rose-400">{form.errors.amount}</p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {isVoucherFlow ? t('cashMgmt.voucherNotes') + ' *' : t('cashMgmt.remarks')}
                            </label>
                            <textarea
                                rows={2}
                                placeholder={isVoucherFlow ? t('cashMgmt.voucherPlaceholder') : t('cashMgmt.remarksPlaceholder')}
                                value={form.data.remarks}
                                onChange={e => form.setData('remarks', e.target.value)}
                                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                                required={isVoucherFlow}
                            />
                            {form.errors.remarks && (
                                <p className="mt-1.5 text-[10px] text-rose-400">{form.errors.remarks}</p>
                            )}
                        </div>

                        {isVoucherFlow && (
                            <div>
                                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('cashMgmt.voucherImage')}
                                </label>
                                {voucherPreview ? (
                                    <div className="relative">
                                        <img src={voucherPreview} alt="Voucher" className="h-32 w-full rounded-2xl border border-slate-800 object-cover" />
                                        <button type="button" onClick={clearVoucherImage}
                                            className="absolute right-2 top-2 rounded-full bg-slate-900/80 p-1 text-slate-300 hover:text-rose-400">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => voucherInputRef.current?.click()}
                                        className="flex h-16 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-700 text-slate-500 transition-colors hover:border-indigo-500/50 hover:text-indigo-400">
                                        <Image className="h-4 w-4" />
                                        <span className="text-xs font-semibold">{t('cashMgmt.uploadVoucherImage')}</span>
                                    </button>
                                )}
                                <input
                                    ref={voucherInputRef}
                                    type="file" accept="image/*" className="hidden"
                                    onChange={handleVoucherFile}
                                />
                                {form.errors.voucher_image && (
                                    <p className="mt-1.5 text-[10px] text-rose-400">{form.errors.voucher_image}</p>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={form.processing}
                            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                        >
                            {form.processing ? t('cashMgmt.submitting') : t('cashMgmt.submitBtn')}
                        </button>
                    </form>
                </div>

                {/* ── Pending approvals (admin only) ──────────────────────── */}
                {isSuperadmin && pending.length > 0 && (
                    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                            <h3 className="text-sm font-bold text-white">{t('cashMgmt.pendingApprovals')}</h3>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                                {pending.length}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {pending.map(tr => (
                                <div key={tr.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-white">
                                            {tr.sender?.name ?? t('cashMgmt.unknown')}
                                        </p>
                                        <p className="text-xs text-slate-500">{fmt(Number(tr.amount))} · {fmtDate(tr.created_at)}</p>
                                        {tr.remarks && <p className="mt-1 text-[10px] text-slate-600">{tr.remarks}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={acceptingId === tr.id}
                                        onClick={() => handleAccept(tr.id)}
                                        className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                                    >
                                        {acceptingId === tr.id ? t('cashMgmt.accepting') : t('cashMgmt.accept')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Ledger ───────────────────────────────────────────────── */}
                <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                        <h3 className="text-sm font-bold text-white">
                            {isSuperadmin ? t('cashMgmt.allTransfers') : t('cashMgmt.myTransfers')}
                        </h3>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">{total}</span>
                    </div>

                    <div className="space-y-2">
                        {total === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
                                    <Banknote className="h-5 w-5 text-slate-600" />
                                </div>
                                <p className="text-sm font-semibold text-slate-500">{t('cashMgmt.noTransfers')}</p>
                            </div>
                        ) : paged.map(tr => (
                            <div key={tr.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-white">
                                        <span className="flex items-center gap-1 truncate">
                                            <PartyIcon type={tr.sender_type} /> {partyLabel(tr.sender_type, tr.sender, t)}
                                        </span>
                                        <span className="shrink-0 text-slate-600">→</span>
                                        <span className="flex items-center gap-1 truncate">
                                            <PartyIcon type={tr.receiver_type} /> {partyLabel(tr.receiver_type, tr.receiver, t)}
                                        </span>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        tr.status === 'pending'
                                            ? 'bg-amber-500/10 text-amber-400'
                                            : 'bg-emerald-500/10 text-emerald-400'
                                    }`}>
                                        {t(`cashMgmt.status_${tr.status}`)}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-xs text-slate-500">{fmtDate(tr.created_at)}</p>
                                    <p className="text-sm font-black text-white">{fmt(Number(tr.amount))}</p>
                                </div>
                                {tr.remarks && <p className="mt-2 text-xs text-slate-500">{tr.remarks}</p>}
                                {tr.voucher_image_url && (
                                    <a href={tr.voucher_image_url} target="_blank" rel="noreferrer"
                                        className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">
                                        <Image className="h-3 w-3" /> {t('cashMgmt.viewVoucherImage')}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} total={total} perPage={15} onPage={goTo} />
                </div>
            </div>
        </PosShell>
    );
}
