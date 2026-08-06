<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CategoryController extends Controller
{
    public function index()
    {
        return Inertia::render('categories', [
            'categories' => Category::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100|unique:categories,name',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = $request->hasFile('image') ? $request->file('image')->store('category-images', 'public') : null;

        $category = Category::create([
            'name'  => $data['name'],
            'image' => $imagePath,
        ]);

        if ($request->wantsJson()) {
            return response()->json(['id' => $category->id, 'name' => $category->name], 201);
        }

        return redirect()->route('categories.index')->with('success', 'Category created successfully.');
    }

    public function update(Request $request, Category $category)
    {
        if (!$request->user()->is_superadmin) {
            abort(403);
        }

        $data = $request->validate([
            'name'      => 'required|string|max:100|unique:categories,name,' . $category->id,
            'is_active' => 'required|boolean',
            'image'     => 'nullable|image|max:2048',
        ]);

        $imagePath = $category->image;

        if ($request->hasFile('image')) {
            if ($category->image) {
                Storage::disk('public')->delete($category->image);
            }
            $imagePath = $request->file('image')->store('category-images', 'public');
        }

        $category->update([
            'name'      => $data['name'],
            'is_active' => $data['is_active'],
            'image'     => $imagePath,
        ]);

        return redirect()->route('categories.index')->with('success', 'Category updated.');
    }

    public function destroy(Request $request, Category $category)
    {
        if (!$request->user()->is_superadmin) {
            abort(403);
        }

        if ($category->image) {
            Storage::disk('public')->delete($category->image);
        }

        $category->delete();

        return redirect()->route('categories.index')->with('success', 'Category deleted.');
    }
}
