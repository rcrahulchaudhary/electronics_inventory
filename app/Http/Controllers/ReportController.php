<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\CashTransfer;
use App\Models\Category;
use App\Models\Maintenance;
use App\Models\Order;

use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $type = $request->input('type', 'sales');

        // Non-superadmin staff are always locked to their own outlet;
        // superadmins can view any single outlet or everything combined.
        $outletId = $user->is_superadmin ? ($request->integer('outlet_id') ?: null) : $user->outlet_id;

        $data = match ($type) {
            'inventory'   => $this->inventoryReport($request, $outletId),
            'credit'      => $this->creditReport($request, $outletId),
            'orders'      => $this->ordersReport($request, $outletId),
            'cashflow'    => $this->cashflowReport($request, $outletId),
            'maintenance' => $this->maintenanceReport($request, $outletId),
            default       => $this->salesReport($request, $outletId),
        };

        return Inertia::render('reports', array_merge($data, [
            'type'       => $type,
            'outletId'   => $outletId,
            'outlets'    => Outlet::orderBy('name')->get(['id', 'name', 'code']),
            'products'   => Product::where('is_active', true)->orderBy('name')->get(['id', 'name', 'brand_id', 'category_id']),
            'brands'     => Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'staff'      => $user->is_superadmin ? User::where('is_superadmin', false)->orderBy('name')->get(['id', 'name']) : [],
        ]));
    }

    private function dateRange(Request $request): array
    {
        return [$request->input('date_from'), $request->input('date_to')];
    }

    private function salesReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $customer   = $request->input('customer');
        $productId  = $request->integer('product_id') ?: null;
        $categoryId = $request->integer('category_id') ?: null;
        $brandId    = $request->integer('brand_id') ?: null;

        $items = OrderItem::query()
            ->with(['product:id,name,model_number,brand_id,category_id', 'product.brand:id,name', 'product.category:id,name',
                'order:id,customer_name,customer_mobile,destination_outlet_id,created_at', 'order.destinationOutlet:id,name,code'])
            ->whereHas('order', function ($q) use ($outletId, $dateFrom, $dateTo, $customer) {
                if ($outletId) $q->where('destination_outlet_id', $outletId);
                if ($dateFrom) $q->whereDate('created_at', '>=', $dateFrom);
                if ($dateTo) $q->whereDate('created_at', '<=', $dateTo);
                if ($customer) {
                    $q->where(fn ($qq) => $qq->where('customer_name', 'like', "%{$customer}%")
                        ->orWhere('customer_mobile', 'like', "%{$customer}%"));
                }
            })
            ->when($productId, fn ($q) => $q->where('product_id', $productId))
            ->when($categoryId, fn ($q) => $q->whereHas('product', fn ($qq) => $qq->where('category_id', $categoryId)))
            ->when($brandId, fn ($q) => $q->whereHas('product', fn ($qq) => $qq->where('brand_id', $brandId)))
            ->get()
            ->sortByDesc(fn ($item) => $item->order?->created_at)
            ->values();

        return [
            'sales' => [
                'items'       => $items,
                'totalAmount' => round($items->sum(fn ($i) => $i->price * $i->quantity), 2),
                'totalQty'    => $items->sum('quantity'),
                'count'       => $items->count(),
            ],
        ];
    }

    private function inventoryReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $productId  = $request->integer('product_id') ?: null;
        $categoryId = $request->integer('category_id') ?: null;
        $brandId    = $request->integer('brand_id') ?: null;

        $stocks = Stock::with(['product:id,name,model_number,brand_id,category_id', 'product.brand:id,name', 'product.category:id,name', 'outlet:id,name,code'])
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->when($productId, fn ($q) => $q->where('product_id', $productId))
            ->when($categoryId, fn ($q) => $q->whereHas('product', fn ($qq) => $qq->where('category_id', $categoryId)))
            ->when($brandId, fn ($q) => $q->whereHas('product', fn ($qq) => $qq->where('brand_id', $brandId)))
            ->when($dateFrom, fn ($q) => $q->whereDate('updated_at', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('updated_at', '<=', $dateTo))
            ->orderBy('updated_at', 'desc')
            ->get();

        return [
            'inventory' => [
                'items'    => $stocks,
                'totalQty' => $stocks->sum('quantity'),
                'count'    => $stocks->count(),
            ],
        ];
    }

    private function creditReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $customer   = $request->input('customer');
        $productId  = $request->integer('product_id') ?: null;
        $categoryId = $request->integer('category_id') ?: null;
        $brandId    = $request->integer('brand_id') ?: null;

        $orders = Order::with(['payment', 'destinationOutlet:id,name,code',
                'items.product:id,name,brand_id,category_id', 'items.product.brand:id,name', 'items.product.category:id,name'])
            ->whereIn('payment_type', ['credit', 'installment'])
            ->whereHas('payment')
            ->when($outletId, fn ($q) => $q->where('destination_outlet_id', $outletId))
            ->when($dateFrom, fn ($q) => $q->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('created_at', '<=', $dateTo))
            ->when($customer, fn ($q) => $q->where(fn ($qq) => $qq->where('customer_name', 'like', "%{$customer}%")
                ->orWhere('customer_mobile', 'like', "%{$customer}%")))
            ->when($productId, fn ($q) => $q->whereHas('items', fn ($qq) => $qq->where('product_id', $productId)))
            ->when($categoryId, fn ($q) => $q->whereHas('items.product', fn ($qq) => $qq->where('category_id', $categoryId)))
            ->when($brandId, fn ($q) => $q->whereHas('items.product', fn ($qq) => $qq->where('brand_id', $brandId)))
            ->orderByDesc('created_at')
            ->get();

        $today = now()->startOfDay();

        $rows = $orders->map(function ($order) use ($today) {
            $remaining = (float) ($order->payment->remaining_amount ?? 0);
            $dueDate   = $order->payment->due_date;
            $daysLeft  = $dueDate ? $today->diffInDays($dueDate, false) : null;

            $bucket = 'settled';
            if ($remaining > 0) {
                $bucket = match (true) {
                    $daysLeft === null       => 'no_due_date',
                    $daysLeft < 0            => 'overdue',
                    $daysLeft <= 7           => 'due_7',
                    $daysLeft <= 14          => 'due_14',
                    $daysLeft <= 30          => 'due_30',
                    default                  => 'due_later',
                };
            }

            return [
                'order'     => $order,
                'remaining' => $remaining,
                'daysLeft'  => $daysLeft,
                'bucket'    => $bucket,
            ];
        });

        return [
            'credit' => [
                'rows'          => $rows,
                'totalOutstanding' => round($orders->sum(fn ($o) => (float) ($o->payment->remaining_amount ?? 0)), 2),
                'count'         => $orders->count(),
            ],
        ];
    }

    private function ordersReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $status = $request->input('status');

        $orders = Order::with(['items.product:id,name,model_number,brand_id', 'items.product.brand:id,name',
                'originOutlet:id,name,code', 'destinationOutlet:id,name,code', 'payment'])
            ->when($outletId, fn ($q) => $q->where(fn ($qq) => $qq->where('origin_outlet_id', $outletId)->orWhere('destination_outlet_id', $outletId)))
            ->when($dateFrom, fn ($q) => $q->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('created_at', '<=', $dateTo))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('created_at')
            ->get();

        return [
            'orders' => [
                'items' => $orders,
                'count' => $orders->count(),
            ],
        ];
    }

    private function cashflowReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $staffId = $request->integer('staff_id') ?: null;

        $transfers = CashTransfer::with(['sender:id,name,outlet_id', 'sender.outlet:id,name,code', 'receiver:id,name,outlet_id', 'receiver.outlet:id,name,code'])
            ->when($outletId, fn ($q) => $q->where(fn ($qq) => $qq
                ->whereHas('sender', fn ($s) => $s->where('outlet_id', $outletId))
                ->orWhereHas('receiver', fn ($r) => $r->where('outlet_id', $outletId))))
            ->when($staffId, fn ($q) => $q->where(fn ($qq) => $qq->where('sender_id', $staffId)->orWhere('receiver_id', $staffId)))
            ->when($dateFrom, fn ($q) => $q->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('created_at', '<=', $dateTo))
            ->orderBy('created_at')
            ->get();

        return [
            'cashflow' => [
                'items' => $transfers,
                'count' => $transfers->count(),
            ],
        ];
    }

    private function maintenanceReport(Request $request, ?int $outletId): array
    {
        [$dateFrom, $dateTo] = $this->dateRange($request);
        $customer = $request->input('customer');
        $product  = $request->input('product');
        $billId   = $request->integer('bill_id') ?: null;

        $cases = Maintenance::with('outlet:id,name,code')
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->when($dateFrom, fn ($q) => $q->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('created_at', '<=', $dateTo))
            ->when($customer, fn ($q) => $q->where(fn ($qq) => $qq->where('customer_name', 'like', "%{$customer}%")
                ->orWhere('customer_mobile', 'like', "%{$customer}%")))
            ->when($product, fn ($q) => $q->where('product_name', 'like', "%{$product}%"))
            ->when($billId, fn ($q) => $q->where('id', $billId))
            ->orderByDesc('created_at')
            ->get();

        return [
            'maintenance' => [
                'items' => $cases,
                'count' => $cases->count(),
            ],
        ];
    }

    public function settleCredit(Request $request, Payment $payment)
    {
        $user = $request->user();

        if (!$user->is_superadmin) {
            $order = $payment->order;
            if (!$order || $order->destination_outlet_id !== $user->outlet_id) {
                abort(403);
            }
        }

        $payment->update(['remaining_amount' => 0]);

        return redirect()->route('reports.index', ['type' => 'credit'])->with('success', 'Marked as settled.');
    }
}
