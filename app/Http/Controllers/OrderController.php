<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Payment;
use App\Models\Stock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;

class OrderController extends Controller
{
    public function pos(Request $request)
    {
        $user = $request->user();

        $stocksQuery = Stock::with([
            'product:id,name,model_number,brand_id,category_id,image',
            'product.brand:id,name',
            'product.category:id,name',
        ])->where('quantity', '>', 0);

        if (!$user->is_superadmin) {
            $stocksQuery->where('outlet_id', $user->outlet_id);
        }

        return Inertia::render('pos', [
            'outlets' => Outlet::orderBy('name')->get(['id', 'name', 'code']),
            'stocks'  => $stocksQuery->get(['id', 'outlet_id', 'product_id', 'quantity']),
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Order::with([
            'items.product:id,name,model_number,brand_id',
            'items.product.brand:id,name',
            'originOutlet:id,name,code',
            'destinationOutlet:id,name,code',
            'payment',
        ]);

        if (!$user->is_superadmin) {
            $query->where(function ($q) use ($user) {
                $q->where('origin_outlet_id', $user->outlet_id)
                  ->orWhere('destination_outlet_id', $user->outlet_id);
            });
        }

        return Inertia::render('orders', [
            'orders'  => $query->orderBy('created_at', 'desc')->get(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'origin_outlet_id'      => 'required|exists:outlets,id',
            'destination_outlet_id' => 'required|exists:outlets,id',
            'customer_name'         => 'nullable|string|max:255',
            'customer_mobile'       => 'nullable|string|max:20',
            'customer_address'      => 'nullable|string|max:500',
            'payment_type'          => 'required|in:cash,cheque,online,credit,installment',
            'status'                => 'required|in:pending,confirm,dispatched,delivered,canceled',
            'advance_amount'        => 'nullable|numeric|min:0',
            'due_date'              => 'nullable|date',
            'down_payment'          => 'nullable|numeric|min:0',
            'installment_months'    => 'nullable|integer|min:1|max:60',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'required|exists:products,id',
            'items.*.price'         => 'required|numeric|min:0',
            'items.*.quantity'      => 'required|numeric|min:0.01',
        ]);

        if (!$user->is_superadmin && (
            (int) $data['origin_outlet_id'] !== $user->outlet_id ||
            (int) $data['destination_outlet_id'] !== $user->outlet_id
        )) {
            abort(403);
        }

        $destOutletId = (int) $data['destination_outlet_id'];

        // Validate stock for every item
        foreach ($data['items'] as $index => $item) {
            $stock = Stock::where('outlet_id', $destOutletId)
                ->where('product_id', $item['product_id'])
                ->first();

            if (!$stock || $stock->quantity < $item['quantity']) {
                return back()->withErrors([
                    "items.{$index}.quantity" => 'Not enough stock at destination outlet.',
                ]);
            }
        }

        $order = null;

        DB::transaction(function () use ($data, $destOutletId, $request, &$order) {
            $order = Order::create([
                'origin_outlet_id'      => $data['origin_outlet_id'],
                'destination_outlet_id' => $destOutletId,
                'customer_name'         => $data['customer_name'] ?? null,
                'customer_mobile'       => $data['customer_mobile'] ?? null,
                'customer_address'      => $data['customer_address'] ?? null,
                'payment_type'          => $data['payment_type'],
                'status'                => $data['status'],
            ]);

            foreach ($data['items'] as $index => $item) {
                $stock = Stock::where('outlet_id', $destOutletId)
                    ->where('product_id', $item['product_id'])
                    ->first();

                $stock->decrement('quantity', $item['quantity']);

                $warrantyPath = null;
                $file = $request->file("items.{$index}.warranty_card");
                if ($file) {
                    $warrantyPath = $file->store('warranty-cards', 'public');
                }

                OrderItem::create([
                    'order_id'      => $order->id,
                    'product_id'    => $item['product_id'],
                    'price'         => $item['price'],
                    'quantity'      => $item['quantity'],
                    'warranty_card' => $warrantyPath,
                ]);
            }

            // Payment for credit / installment (based on total cart value)
            if (in_array($data['payment_type'], ['credit', 'installment'])) {
                $total       = collect($data['items'])->sum(fn($i) => $i['price'] * $i['quantity']);
                $advance     = (float) ($data['advance_amount'] ?? 0);
                $downPayment = (float) ($data['down_payment'] ?? 0);
                $months      = isset($data['installment_months']) ? (int) $data['installment_months'] : null;
                $loanAmount  = $data['payment_type'] === 'credit'
                    ? $total - $advance
                    : $total - $downPayment;
                $emi = ($months && $months > 0) ? round($loanAmount / $months, 2) : null;

                Payment::create([
                    'order_id'            => $order->id,
                    'advance_amount'      => $data['payment_type'] === 'credit' ? $advance : null,
                    'remaining_amount'    => $data['payment_type'] === 'credit' ? round($loanAmount, 2) : null,
                    'due_date'            => $data['due_date'] ?? null,
                    'down_payment'        => $data['payment_type'] === 'installment' ? $downPayment : null,
                    'installment_months'  => $data['payment_type'] === 'installment' ? $months : null,
                    'monthly_installment' => $data['payment_type'] === 'installment' ? $emi : null,
                ]);
            }
        });

        $order->load(['items.product:id,name,model_number', 'destinationOutlet:id,name,code,address']);

        session()->flash('completedOrder', [
            ...$this->billPayload($order),
            'bill_url' => URL::signedRoute('orders.bill', ['order' => $order->id]),
        ]);

        return redirect()->route('pos')->with('success', 'Order created successfully.');
    }

    public function showBill(Order $order)
    {
        $order->load(['items.product:id,name,model_number', 'destinationOutlet:id,name,code,address']);

        return Inertia::render('bill', [
            'order' => $this->billPayload($order),
        ]);
    }

    private function billPayload(Order $order): array
    {
        return [
            'id'              => $order->id,
            'bill_number'     => $order->bill_number,
            'customer_name'   => $order->customer_name,
            'customer_mobile' => $order->customer_mobile,
            'payment_type'    => $order->payment_type,
            'created_at'      => $order->created_at->toIso8601String(),
            'outlet'          => [
                'name'    => $order->destinationOutlet->name,
                'address' => $order->destinationOutlet->address,
            ],
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product->name,
                'model_number' => $item->product->model_number,
                'price'        => $item->price,
                'quantity'     => $item->quantity,
                'total'        => round($item->price * $item->quantity, 2),
            ]),
            'quantity_total' => $order->items->sum('quantity'),
            'grand_total'    => round($order->items->sum(fn ($item) => $item->price * $item->quantity), 2),
        ];
    }

    public function update(Request $request, Order $order)
    {
        $user = $request->user();

        if (!$user->is_superadmin &&
            $order->origin_outlet_id !== $user->outlet_id &&
            $order->destination_outlet_id !== $user->outlet_id) {
            abort(403);
        }

        $data = $request->validate([
            'status' => 'required|in:pending,confirm,dispatched,delivered,canceled',
        ]);

        $order->update($data);

        return back()->with('success', 'Order status updated.');
    }
}
