<?php

namespace App\Http\Controllers;

use App\Models\CashTransfer;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CashTransferController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = CashTransfer::with(['sender:id,name,is_superadmin', 'receiver:id,name,is_superadmin']);

        if (!$user->is_superadmin) {
            // Staff only ever initiate transfers — they see their own history.
            $query->where('sender_type', 'staff')->where('sender_id', $user->id);
        }

        return Inertia::render('cash-transfers', [
            'transfers' => $query->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'workflow'       => 'required|in:staff_to_admin,staff_to_bank,admin_to_bank,bank_to_admin',
            'amount'         => 'required|numeric|min:0.01',
            'remarks'        => $request->input('workflow') === 'staff_to_bank'
                ? 'required|string|max:1000'
                : 'nullable|string|max:1000',
            'voucher_image'  => 'nullable|image|max:4096',
        ]);

        $isStaffWorkflow = in_array($data['workflow'], ['staff_to_admin', 'staff_to_bank']);

        if ($isStaffWorkflow && $user->is_superadmin) {
            abort(403);
        }
        if (!$isStaffWorkflow && !$user->is_superadmin) {
            abort(403);
        }

        [$senderType, $senderId, $receiverType, $receiverId, $status] = match ($data['workflow']) {
            'staff_to_admin' => ['staff', $user->id, 'admin', null, 'pending'],
            'staff_to_bank'  => ['staff', $user->id, 'bank', null, 'accepted'],
            'admin_to_bank'  => ['admin', $user->id, 'bank', null, 'accepted'],
            'bank_to_admin'  => ['bank', null, 'admin', $user->id, 'accepted'],
        };

        $voucherPath = $request->hasFile('voucher_image')
            ? $request->file('voucher_image')->store('cash-vouchers', 'public')
            : null;

        CashTransfer::create([
            'sender_type'   => $senderType,
            'sender_id'     => $senderId,
            'receiver_type' => $receiverType,
            'receiver_id'   => $receiverId,
            'amount'        => $data['amount'],
            'status'        => $status,
            'remarks'       => $data['remarks'] ?? null,
            'voucher_image' => $voucherPath,
        ]);

        return redirect()->route('cash-transfers.index')->with('success', 'Cash transfer recorded.');
    }

    public function accept(Request $request, CashTransfer $cashTransfer)
    {
        $user = $request->user();

        if (!$user->is_superadmin) {
            abort(403);
        }

        if ($cashTransfer->status !== 'pending') {
            return back()->withErrors(['transfer' => 'This transfer has already been resolved.']);
        }

        $cashTransfer->update([
            'receiver_id' => $user->id,
            'status'      => 'accepted',
        ]);

        return redirect()->route('cash-transfers.index')->with('success', 'Cash transfer accepted.');
    }
}
