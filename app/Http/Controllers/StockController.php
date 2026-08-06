<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Stock;
use App\Models\StockTransfer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StockController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $stocksQuery = Stock::with([
            'product:id,name,model_number,type,warranty,brand_id,category_id',
            'product.brand:id,name',
            'product.category:id,name',
            'outlet:id,name,code',
        ]);

        if ($user->is_superadmin) {
            $outletId = $request->integer('outlet_id') ?: null;
            if ($outletId) {
                $stocksQuery->where('outlet_id', $outletId);
            }
        } else {
            $stocksQuery->where('outlet_id', $user->outlet_id);
        }

        $transfersQuery = StockTransfer::with([
            'product:id,name,model_number,brand_id,category_id',
            'product.brand:id,name',
            'product.category:id,name',
            'fromOutlet:id,name,code',
            'toOutlet:id,name,code',
            'requestedBy:id,name',
        ])->where('status', 'pending');

        if (!$user->is_superadmin) {
            $transfersQuery->where(function ($q) use ($user) {
                $q->where('from_outlet_id', $user->outlet_id)
                    ->orWhere('to_outlet_id', $user->outlet_id);
            });
        }

        $allStocksQuery = Stock::select(['outlet_id', 'product_id']);
        if (!$user->is_superadmin) {
            $allStocksQuery->where('outlet_id', $user->outlet_id);
        }

        return Inertia::render('stocks', [
            'stocks'           => $stocksQuery->orderBy('updated_at', 'desc')->get(),
            'allStocks'        => $allStocksQuery->get(),
            'pendingTransfers' => $transfersQuery->orderBy('created_at', 'desc')->get(),
            'products'    => Product::where('is_active', true)
                ->with(['brand:id,name', 'category:id,name'])
                ->orderBy('name')
                ->get(['id', 'name', 'model_number', 'brand_id', 'category_id']),
            'brands'      => Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'categories'  => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'outlets'     => Outlet::orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'outlet_id'  => $user->is_superadmin ? 'required|exists:outlets,id' : 'nullable',
            'quantity'   => 'required|numeric|min:0',
            'cost'       => 'required|numeric|min:0',
        ]);

        $outletId = $user->is_superadmin ? $data['outlet_id'] : $user->outlet_id;

        DB::transaction(function () use ($data, $outletId) {
            $stock = Stock::where('outlet_id', $outletId)->where('product_id', $data['product_id'])->first();

            if ($stock) {
                // Product already stocked at this outlet — this is a restock,
                // so add to the existing quantity rather than overwrite it.
                $stock->increment('quantity', $data['quantity']);

                // Keep the latest cost, but leave the original initial_qty
                // pivot value alone — it's historical record, not a running total.
                $product = Product::find($data['product_id']);
                $product->outlets()->syncWithoutDetaching([$outletId => ['cost' => $data['cost']]]);
            } else {
                $product = Product::find($data['product_id']);
                $product->outlets()->syncWithoutDetaching([
                    $outletId => ['initial_qty' => $data['quantity'], 'cost' => $data['cost']],
                ]);

                Stock::create([
                    'outlet_id'  => $outletId,
                    'product_id' => $data['product_id'],
                    'quantity'   => $data['quantity'],
                ]);
            }
        });

        return redirect()->route('stocks.index')->with('success', 'Stock entry added.');
    }

    public function transfer(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'product_id'   => 'required|exists:products,id',
            'from_outlet_id' => 'required|exists:outlets,id',
            'to_outlet_id'   => 'required|exists:outlets,id|different:from_outlet_id',
            'quantity'       => 'required|numeric|min:0.01',
        ]);

        // Outlet users can only request transfers from their own outlet
        if (!$user->is_superadmin && (int) $data['from_outlet_id'] !== $user->outlet_id) {
            abort(403);
        }

        $error = null;

        DB::transaction(function () use ($data, $user, &$error) {
            $from = Stock::where('outlet_id', $data['from_outlet_id'])
                ->where('product_id', $data['product_id'])
                ->lockForUpdate()
                ->first();

            if (!$from) {
                $error = 'This product has no stock in the source outlet.';

                return;
            }

            // Stock already promised to other pending transfers out of this
            // outlet can't be promised again, even though it hasn't actually
            // been deducted yet.
            $alreadyPending = StockTransfer::where('from_outlet_id', $data['from_outlet_id'])
                ->where('product_id', $data['product_id'])
                ->where('status', 'pending')
                ->lockForUpdate()
                ->sum('quantity');

            if (($from->quantity - $alreadyPending) < $data['quantity']) {
                $error = 'Not enough available stock in source outlet (some may already be reserved by other pending transfers).';

                return;
            }

            // No stock is moved yet — the destination outlet must accept the
            // transfer first. Only the request itself is recorded here.
            StockTransfer::create([
                'product_id'     => $data['product_id'],
                'from_outlet_id' => $data['from_outlet_id'],
                'to_outlet_id'   => $data['to_outlet_id'],
                'quantity'       => $data['quantity'],
                'status'         => 'pending',
                'requested_by'   => $user->id,
            ]);
        });

        if ($error) {
            return back()->withErrors(['quantity' => $error]);
        }

        return redirect()->route('stocks.index')->with('success', 'Transfer request sent — awaiting acceptance from the destination outlet.');
    }

    public function acceptTransfer(Request $request, StockTransfer $transfer)
    {
        $user = $request->user();

        if (!$user->is_superadmin && $transfer->to_outlet_id !== $user->outlet_id) {
            abort(403);
        }

        $error = null;

        DB::transaction(function () use ($transfer, $user, &$error) {
            // Re-fetch and lock so a concurrent accept/reject on the same
            // transfer can't both go through.
            $locked = StockTransfer::where('id', $transfer->id)->lockForUpdate()->first();

            if ($locked->status !== 'pending') {
                $error = 'This transfer has already been resolved.';

                return;
            }

            $from = Stock::where('outlet_id', $locked->from_outlet_id)
                ->where('product_id', $locked->product_id)
                ->lockForUpdate()
                ->first();

            if (!$from || $from->quantity < $locked->quantity) {
                $error = 'Not enough stock in the source outlet to complete this transfer.';

                return;
            }

            $from->decrement('quantity', $locked->quantity);

            $to = Stock::firstOrCreate(
                ['outlet_id' => $locked->to_outlet_id, 'product_id' => $locked->product_id],
                ['quantity'  => 0]
            );
            $to->increment('quantity', $locked->quantity);

            // Ensure pivot exists for destination outlet
            $product = Product::find($locked->product_id);
            $product->outlets()->syncWithoutDetaching([
                $locked->to_outlet_id => ['initial_qty' => 0, 'cost' => 0],
            ]);

            $locked->update([
                'status'      => 'accepted',
                'resolved_by' => $user->id,
                'resolved_at' => now(),
            ]);
        });

        if ($error) {
            return back()->withErrors(['transfer' => $error]);
        }

        return redirect()->route('stocks.index')->with('success', 'Transfer accepted — stock updated.');
    }

    public function rejectTransfer(Request $request, StockTransfer $transfer)
    {
        $user = $request->user();

        if (!$user->is_superadmin && $transfer->to_outlet_id !== $user->outlet_id) {
            abort(403);
        }

        $error = null;

        DB::transaction(function () use ($transfer, $user, &$error) {
            $locked = StockTransfer::where('id', $transfer->id)->lockForUpdate()->first();

            if ($locked->status !== 'pending') {
                $error = 'This transfer has already been resolved.';

                return;
            }

            $locked->update([
                'status'      => 'rejected',
                'resolved_by' => $user->id,
                'resolved_at' => now(),
            ]);
        });

        if ($error) {
            return back()->withErrors(['transfer' => $error]);
        }

        return redirect()->route('stocks.index')->with('success', 'Transfer request rejected.');
    }

    public function update(Request $request, Stock $stock)
    {
        $user = $request->user();

        // Outlet users can only update their own outlet's stock
        if (!$user->is_superadmin && $stock->outlet_id !== $user->outlet_id) {
            abort(403);
        }

        $data = $request->validate([
            'quantity' => 'required|numeric|min:0',
        ]);

        $stock->update(['quantity' => $data['quantity']]);

        return redirect()->route('stocks.index')->with('success', 'Stock updated.');
    }
}
