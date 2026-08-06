<?php

namespace App\Http\Controllers;

use App\Models\Maintenance;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Stock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class HomeController extends Controller
{
    public function index(Request $request)
    {
        $user      = $request->user();
        $from      = $request->input('from', now()->startOfMonth()->toDateString());
        $to        = $request->input('to', now()->toDateString());
        $outletId  = $user->is_superadmin ? ($request->integer('outlet_id') ?: null) : $user->outlet_id;
        $fromDt    = $from . ' 00:00:00';
        $toDt      = $to   . ' 23:59:59';

        // Orders scoped by destination outlet (where stock was deducted)
        $orderScoped = fn ($q) => $outletId ? $q->where('destination_outlet_id', $outletId) : $q;
        // Maintenance/stock scoped by outlet_id
        $scoped      = fn ($q) => $outletId ? $q->where('outlet_id', $outletId) : $q;

        // Orders — base query for counts/groupings
        $orders          = $orderScoped(Order::whereBetween('created_at', [$fromDt, $toDt]))->get(['id', 'payment_type', 'status']);
        $totalOrders     = $orders->count();
        $ordersByStatus  = $orders->groupBy('status')->map->count();
        $ordersByPayment = $orders->groupBy('payment_type')->map->count();
        $creditCount     = $ordersByPayment['credit'] ?? 0;
        $pendingDeliveryCount = ($ordersByStatus['pending'] ?? 0) + ($ordersByStatus['confirm'] ?? 0);

        // Revenue from order_items (price * quantity) joined through orders
        $orderIds     = $orders->pluck('id');
        $totalRevenue = OrderItem::whereIn('order_id', $orderIds)
            ->sum(DB::raw('price * quantity'));

        // Top 5 products by revenue via order_items
        $topProducts = OrderItem::whereIn('order_id', $orderIds)
            ->select('product_id', DB::raw('SUM(price * quantity) as revenue'), DB::raw('SUM(quantity) as qty'), DB::raw('COUNT(*) as orders'))
            ->with('product:id,name,model_number,brand_id', 'product.brand:id,name')
            ->groupBy('product_id')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        // Daily sales sparkline via orders (date) joined with order_items (revenue)
        $dailySales = $orderScoped(Order::query())
            ->whereBetween('orders.created_at', [$fromDt, $toDt])
            ->select(
                DB::raw('DATE(orders.created_at) as date'),
                DB::raw('COUNT(DISTINCT orders.id) as orders'),
                DB::raw('SUM(oi.price * oi.quantity) as revenue'),
            )
            ->join('order_items as oi', 'oi.order_id', '=', 'orders.id')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Maintenance
        $maintTotal    = $scoped(Maintenance::whereBetween('created_at', [$fromDt, $toDt]))->count();
        $maintByStatus = $scoped(Maintenance::whereBetween('created_at', [$fromDt, $toDt]))->get(['status'])->groupBy('status')->map->count();

        // Stock snapshot
        $stockBase  = Stock::with('product:id,name,model_number', 'outlet:id,name,code')
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId));
        $lowStock   = (clone $stockBase)->where('quantity', '>', 0)->where('quantity', '<=', 5)->get();
        $outOfStock = (clone $stockBase)->where('quantity', '<=', 0)->count();

        return Inertia::render('home', [
            'from'           => $from,
            'to'             => $to,
            'outletId'       => $outletId,
            'outlets'        => $user->is_superadmin ? Outlet::orderBy('name')->get(['id', 'name', 'code']) : [],
            'totalRevenue'   => $totalRevenue,
            'totalOrders'    => $totalOrders,
            'ordersByStatus' => $ordersByStatus,
            'ordersByPayment' => $ordersByPayment,
            'creditCount'    => $creditCount,
            'pendingDeliveryCount' => $pendingDeliveryCount,
            'topProducts'    => $topProducts,
            'dailySales'     => $dailySales,
            'maintTotal'     => $maintTotal,
            'maintByStatus'  => $maintByStatus,
            'lowStock'       => $lowStock,
            'outOfStock'     => $outOfStock,
        ]);
    }
}

