<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index()
    {
        return Inertia::render('users', [
            'users'   => User::with('outlet:id,name')->orderBy('created_at')->get(),
            'outlets' => Outlet::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => 'required|string|max:100',
            'email'         => 'required|email|max:150|unique:users,email',
            'password'      => 'required|string|min:6',
            'is_superadmin' => 'boolean',
            'outlet_id'     => 'nullable|required_if:is_superadmin,false|exists:outlets,id',
        ]);

        User::create([
            'name'              => $data['name'],
            'email'             => $data['email'],
            'password'          => Hash::make($data['password']),
            'is_superadmin'     => $data['is_superadmin'] ?? false,
            'outlet_id'         => ($data['is_superadmin'] ?? false) ? null : $data['outlet_id'],
            'email_verified_at' => now(),
        ]);

        return redirect()->route('users.index')->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'          => 'required|string|max:100',
            'email'         => 'required|email|max:150|unique:users,email,' . $user->id,
            'password'      => 'nullable|string|min:6',
            'is_superadmin' => 'boolean',
            'outlet_id'     => 'nullable|required_if:is_superadmin,false|exists:outlets,id',
        ]);

        $user->update([
            'name'          => $data['name'],
            'email'         => $data['email'],
            'is_superadmin' => $data['is_superadmin'] ?? false,
            'outlet_id'     => ($data['is_superadmin'] ?? false) ? null : $data['outlet_id'],
            ...(!empty($data['password']) ? ['password' => Hash::make($data['password'])] : []),
        ]);

        return redirect()->route('users.index')->with('success', 'User updated.');
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return redirect()->route('users.index')->with('error', 'You cannot delete your own account.');
        }

        $user->delete();

        return redirect()->route('users.index')->with('success', 'User deleted.');
    }
}
