<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashTransfer extends Model
{
    protected $fillable = [
        'sender_type', 'sender_id', 'receiver_type', 'receiver_id',
        'amount', 'status', 'remarks', 'voucher_image',
    ];

    protected $appends = ['voucher_image_url'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function getVoucherImageUrlAttribute(): ?string
    {
        return $this->voucher_image ? asset('storage/' . $this->voucher_image) : null;
    }
}
