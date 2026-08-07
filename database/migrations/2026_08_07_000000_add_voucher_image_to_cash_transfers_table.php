<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_transfers', function (Blueprint $table) {
            $table->string('voucher_image')->nullable()->after('remarks');
        });
    }

    public function down(): void
    {
        Schema::table('cash_transfers', function (Blueprint $table) {
            $table->dropColumn('voucher_image');
        });
    }
};
