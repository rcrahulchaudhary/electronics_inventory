<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Stock;
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

        return Inertia::render('stocks', [
            'stocks'      => $stocksQuery->orderBy('updated_at', 'desc')->get(),
            'allStocks'   => Stock::select(['outlet_id', 'product_id'])->get(),
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
            // Upsert outlet_product pivot (so cost is tracked)
            $product = Product::find($data['product_id']);
            $product->outlets()->syncWithoutDetaching([
                $outletId => ['initial_qty' => $data['quantity'], 'cost' => $data['cost']],
            ]);

            // Create stock record (quantity = initial_qty since this is a fresh entry)
            Stock::create([
                'outlet_id'  => $outletId,
                'product_id' => $data['product_id'],
                'quantity'   => $data['quantity'],
            ]);
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

        // Outlet users can only transfer from their own outlet
        if (!$user->is_superadmin && (int) $data['from_outlet_id'] !== $user->outlet_id) {
            abort(403);
        }

        $from = Stock::where('outlet_id', $data['from_outlet_id'])
            ->where('product_id', $data['product_id'])
            ->firstOrFail();

        if ($from->quantity < $data['quantity']) {
            return back()->withErrors(['quantity' => 'Not enough stock in source outlet.']);
        }

        DB::transaction(function () use ($data, $from) {
            $from->decrement('quantity', $data['quantity']);

            $to = Stock::firstOrCreate(
                ['outlet_id' => $data['to_outlet_id'], 'product_id' => $data['product_id']],
                ['quantity'  => 0]
            );
            $to->increment('quantity', $data['quantity']);

            // Ensure pivot exists for destination outlet
            $product = \App\Models\Product::find($data['product_id']);
            $product->outlets()->syncWithoutDetaching([
                $data['to_outlet_id'] => ['initial_qty' => 0, 'cost' => 0],
            ]);
        });

        return redirect()->route('stocks.index')->with('success', 'Stock transferred successfully.');
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
