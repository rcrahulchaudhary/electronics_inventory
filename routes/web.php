<?php

use App\Http\Controllers\BrandController;
use App\Http\Controllers\CashTransferController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\OutletController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

// Public, signed bill link — no login required, shareable with customers.
Route::get('bill/{order}', [OrderController::class, 'showBill'])
    ->middleware('signed')
    ->name('orders.bill');

// All authenticated users
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('home', [HomeController::class, 'index'])->name('home');
    Route::get('pos', [\App\Http\Controllers\OrderController::class, 'pos'])->name('pos');
    Route::resource('maintenances', MaintenanceController::class)->only(['index', 'store', 'update']);
    Route::inertia('menu',        'menu')->name('menu');
    Route::resource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::resource('brands',     BrandController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::resource('products',   ProductController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('stocks/transfer', [StockController::class, 'transfer'])->name('stocks.transfer');
    Route::post('stocks/transfers/{transfer}/accept', [StockController::class, 'acceptTransfer'])->name('stocks.transfers.accept');
    Route::post('stocks/transfers/{transfer}/reject', [StockController::class, 'rejectTransfer'])->name('stocks.transfers.reject');
    Route::resource('stocks',     StockController::class)->only(['index', 'store', 'update']);
    Route::resource('orders',     OrderController::class)->only(['index', 'store', 'update']);
    Route::post('cash-transfers/{cashTransfer}/accept', [CashTransferController::class, 'accept'])->name('cash-transfers.accept');
    Route::resource('cash-transfers', CashTransferController::class)->only(['index', 'store']);
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::post('reports/credit/{payment}/settle', [ReportController::class, 'settleCredit'])->name('reports.credit.settle');
});

// Superadmin only
Route::middleware(['auth', 'verified', 'superadmin'])->group(function () {
    Route::resource('outlets', OutletController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::resource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);
});

require __DIR__.'/settings.php';
