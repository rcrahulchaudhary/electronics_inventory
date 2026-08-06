import { useTranslation } from 'react-i18next';

export type BillItem = {
    product_name: string;
    model_number: string | null;
    price: string;
    quantity: string;
    total: number;
};

export type BillOrder = {
    id: number;
    bill_number: string;
    customer_name: string | null;
    customer_mobile: string | null;
    payment_type: string;
    created_at: string;
    outlet?: { name: string; address: string | null } | null;
    items: BillItem[];
    quantity_total: number;
    grand_total: number;
};

const fmt = (n: number) =>
    `रू ${n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// This card is meant to look like a physical receipt — the same regardless
// of the app's light/dark toggle. Colors are literal hex values (not the
// slate-*/white Tailwind tokens), because this app remaps those tokens via
// CSS custom properties for its dark-mode-by-default theming (see app.css),
// which would otherwise invert this card's colors depending on the toggle.
export default function BillCard({ order, storeName }: { order: BillOrder; storeName: string }) {
    const { t } = useTranslation();
    const date = new Date(order.created_at);

    return (
        <div className="overflow-hidden rounded-2xl border border-[#cbd5e1] bg-[#ffffff] text-[#0f172a] shadow-xl print:rounded-none print:border-0 print:shadow-none">
            {/* Header */}
            <div className="space-y-1 border-b-2 border-dashed border-[#cbd5e1] px-6 py-5 text-center">
                <p className="text-lg font-black tracking-tight">{storeName}</p>
                {order.outlet && (
                    <p className="text-xs text-[#64748b]">
                        {order.outlet.name}
                        {order.outlet.address ? ` · ${order.outlet.address}` : ''}
                    </p>
                )}
                <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
                    {t('orderMgmt.salesReceipt')}
                </p>
            </div>

            {/* Meta */}
            <div className="flex items-start justify-between px-6 py-4 text-xs">
                <div>
                    <p className="font-bold uppercase tracking-wider text-[#94a3b8]">{t('orderMgmt.billNumber')}</p>
                    <p className="font-mono text-sm font-bold text-[#0f172a]">{order.bill_number}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold uppercase tracking-wider text-[#94a3b8]">{t('orderMgmt.date')}</p>
                    <p className="font-semibold text-[#334155]">
                        {date.toLocaleDateString('en-NP', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[#64748b]">{date.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>

            {(order.customer_name || order.customer_mobile) && (
                <div className="mx-6 mb-4 rounded-xl bg-[#f8fafc] px-4 py-2.5 text-xs">
                    <p className="font-bold uppercase tracking-wider text-[#94a3b8]">{t('orderMgmt.customerName')}</p>
                    {order.customer_name && <p className="font-semibold text-[#1e293b]">{order.customer_name}</p>}
                    {order.customer_mobile && <p className="text-[#64748b]">{order.customer_mobile}</p>}
                </div>
            )}

            {/* Items */}
            <div className="px-6">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-[#e2e8f0] pb-2 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    <span>{t('orderMgmt.product')}</span>
                    <span className="text-right">{t('orderMgmt.quantity')}</span>
                    <span className="text-right">{t('orderMgmt.rate')}</span>
                    <span className="text-right">{t('orderMgmt.amount')}</span>
                </div>
                <div className="divide-y divide-[#f1f5f9]">
                    {order.items.map((item, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 py-2.5 text-xs">
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-[#1e293b]">{item.product_name}</p>
                                {item.model_number && <p className="text-[10px] text-[#94a3b8]">{item.model_number}</p>}
                            </div>
                            <span className="text-right text-[#475569]">{item.quantity}</span>
                            <span className="text-right text-[#475569]">{fmt(parseFloat(item.price))}</span>
                            <span className="text-right font-bold text-[#0f172a]">{fmt(item.total)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Totals */}
            <div className="mx-6 mt-4 space-y-1.5 border-t-2 border-dashed border-[#cbd5e1] pt-4">
                <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span>{t('orderMgmt.quantity')}</span>
                    <span>{order.quantity_total}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span>{t('orderMgmt.paymentType')}</span>
                    <span className="font-semibold uppercase text-[#334155]">{t(`orderMgmt.${order.payment_type}`)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5">
                    <span className="text-sm font-black text-[#0f172a]">{t('orderMgmt.totalPayable')}</span>
                    <span className="text-xl font-black text-[#0f172a]">{fmt(order.grand_total)}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-dashed border-[#cbd5e1] px-6 py-4 text-center">
                <p className="text-xs font-semibold text-[#64748b]">{t('orderMgmt.thankYou')}</p>
                <p className="mt-0.5 text-[10px] text-[#cbd5e1]">#{order.id}</p>
            </div>
        </div>
    );
}
