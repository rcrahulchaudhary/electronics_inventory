<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'origin_outlet_id', 'destination_outlet_id',
        'customer_name', 'customer_mobile', 'customer_address',
        'payment_type', 'status',
    ];

    protected $appends = ['bill_number'];

    public function originOutlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'origin_outlet_id');
    }

    public function destinationOutlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'destination_outlet_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function getBillNumberAttribute(): string
    {
        return 'INV-' . str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }
}
