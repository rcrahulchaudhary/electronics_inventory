<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('sender_type'); // staff, admin, bank
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('receiver_type'); // staff, admin, bank
            $table->foreignId('receiver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('status')->default('pending'); // pending, accepted
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_transfers');
    }
};
