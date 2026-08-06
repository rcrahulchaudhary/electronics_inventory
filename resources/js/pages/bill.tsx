import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { initializeTheme } from '@/hooks/use-appearance';
import BillCard, { type BillOrder } from '@/components/bill-card';

initializeTheme();

type Props = {
    order: BillOrder;
};

export default function Bill({ order }: Props) {
    const { t } = useTranslation();
    const storeName = t('common.appName');

    return (
        <div className="min-h-screen bg-[#f1f5f9] py-10 print:bg-[#ffffff] print:py-0">
            <Head title={order.bill_number} />

            <div className="mx-auto w-full max-w-md space-y-4 px-4">
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="mx-auto flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-bold text-[#ffffff] shadow-lg transition-transform active:scale-95 print:hidden"
                >
                    <Printer className="h-3.5 w-3.5" /> {t('orderMgmt.print')}
                </button>

                <BillCard order={order} storeName={storeName} />
            </div>
        </div>
    );
}
