<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Stock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $user     = $request->user();
        $outletId = $user->is_superadmin ? ($request->integer('outlet_id') ?: null) : $user->outlet_id;

        $productsQuery = Product::with(['brand:id,name', 'category:id,name', 'outlets:id,name,code'])
            ->orderBy('name');

        if ($outletId) {
            $productsQuery->whereHas('outlets', fn ($q) => $q->where('outlets.id', $outletId));
        }

        return Inertia::render('products', [
            'products'   => $productsQuery->get(),
            'brands'     => Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'outlets'    => Outlet::orderBy('name')->get(['id', 'name', 'code']),
            'outletId'   => $outletId,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name'         => 'required|string|max:150',
            'model_number' => 'nullable|string|max:100',
            'type'         => 'nullable|string|max:100',
            'warranty'     => 'nullable|string|max:100',
            'image'        => 'nullable|image|max:2048',
            'brand_id'     => 'required|exists:brands,id',
            'category_id'  => 'required|exists:categories,id',
            'outlets'      => 'array',
            'outlets.*.id'          => 'required|exists:outlets,id',
            'outlets.*.initial_qty' => 'required|integer|min:0',
            'outlets.*.cost'        => 'required|numeric|min:0',
        ]);

        // Outlet staff can only assign stock to their own outlet, regardless
        // of what the request contains.
        $outlets = $user->is_superadmin
            ? ($data['outlets'] ?? [])
            : collect($data['outlets'] ?? [])->filter(fn ($o) => (int) $o['id'] === $user->outlet_id)->all();

        $imagePath = $request->hasFile('image') ? $request->file('image')->store('product-images', 'public') : null;

        DB::transaction(function () use ($data, $imagePath, $outlets) {
            $product = Product::create([
                'name'         => $data['name'],
                'model_number' => $data['model_number'] ?? null,
                'type'         => $data['type'] ?? null,
                'warranty'     => $data['warranty'] ?? null,
                'image'        => $imagePath,
                'brand_id'     => $data['brand_id'],
                'category_id'  => $data['category_id'],
            ]);

            foreach ($outlets as $outlet) {
                $product->outlets()->attach($outlet['id'], [
                    'initial_qty' => $outlet['initial_qty'],
                    'cost'        => $outlet['cost'],
                ]);

                Stock::create([
                    'outlet_id'  => $outlet['id'],
                    'product_id' => $product->id,
                    'quantity'   => $outlet['initial_qty'],
                ]);
            }
        });

        return redirect()->route('products.index')->with('success', 'Product created successfully.');
    }

    public function update(Request $request, Product $product)
    {
        $user = $request->user();

        $data = $request->validate([
            'name'         => 'required|string|max:150',
            'model_number' => 'nullable|string|max:100',
            'type'         => 'nullable|string|max:100',
            'warranty'     => 'nullable|string|max:100',
            'image'        => 'nullable|image|max:2048',
            'brand_id'     => 'required|exists:brands,id',
            'category_id'  => 'required|exists:categories,id',
            'is_active'    => 'required|boolean',
            'outlets'      => 'array',
            'outlets.*.id'          => 'required|exists:outlets,id',
            'outlets.*.initial_qty' => 'required|integer|min:0',
            'outlets.*.cost'        => 'required|numeric|min:0',
        ]);

        $imagePath = $product->image;

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $imagePath = $request->file('image')->store('product-images', 'public');
        }

        $product->update([
            'name'         => $data['name'],
            'model_number' => $data['model_number'] ?? null,
            'type'         => $data['type'] ?? null,
            'warranty'     => $data['warranty'] ?? null,
            'image'        => $imagePath,
            'brand_id'     => $data['brand_id'],
            'category_id'  => $data['category_id'],
            'is_active'    => $data['is_active'],
        ]);

        if ($user->is_superadmin) {
            $sync = [];
            foreach ($data['outlets'] ?? [] as $outlet) {
                $sync[$outlet['id']] = [
                    'initial_qty' => $outlet['initial_qty'],
                    'cost'        => $outlet['cost'],
                ];
            }
            $product->outlets()->sync($sync);
        } else {
            // Outlet staff can only touch their own outlet's assignment —
            // leave every other outlet's pivot row untouched.
            $own = collect($data['outlets'] ?? [])->firstWhere('id', $user->outlet_id);

            if ($own) {
                $product->outlets()->syncWithoutDetaching([
                    $own['id'] => ['initial_qty' => $own['initial_qty'], 'cost' => $own['cost']],
                ]);
            } else {
                $product->outlets()->detach($user->outlet_id);
            }
        }

        return redirect()->route('products.index')->with('success', 'Product updated.');
    }

    public function destroy(Request $request, Product $product)
    {
        if (!$request->user()->is_superadmin) {
            abort(403);
        }

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return redirect()->route('products.index')->with('success', 'Product deleted.');
    }
}
