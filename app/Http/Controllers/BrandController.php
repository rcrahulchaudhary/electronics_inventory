<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BrandController extends Controller
{
    public function index()
    {
        return Inertia::render('brands', [
            'brands' => Brand::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:brands,name',
        ]);

        $brand = Brand::create($data);

        if ($request->wantsJson()) {
            return response()->json(['id' => $brand->id, 'name' => $brand->name], 201);
        }

        return redirect()->route('brands.index')->with('success', 'Brand created successfully.');
    }

    public function update(Request $request, Brand $brand)
    {
        if (!$request->user()->is_superadmin) {
            abort(403);
        }

        $data = $request->validate([
            'name'      => 'required|string|max:100|unique:brands,name,' . $brand->id,
            'is_active' => 'required|boolean',
        ]);

        $brand->update($data);

        return redirect()->route('brands.index')->with('success', 'Brand updated.');
    }

    public function destroy(Request $request, Brand $brand)
    {
        if (!$request->user()->is_superadmin) {
            abort(403);
        }

        $brand->delete();

        return redirect()->route('brands.index')->with('success', 'Brand deleted.');
    }
}
