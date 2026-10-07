<?php

use App\Http\Controllers\SiteControlController;
use Illuminate\Support\Facades\Route;

// Public, token-protected site control (maintenance on/off, delete project).
// Loaded without the "web" group (no session, CSRF or auth) so it keeps working even when
// the database is unavailable. Excluded from maintenance mode in bootstrap/app.php.
Route::prefix('_control/{token}')->name('control.')->group(function () {
    Route::get('status',  [SiteControlController::class, 'status'])->name('status');
    Route::get('down',    [SiteControlController::class, 'down'])->name('down');
    Route::get('up',      [SiteControlController::class, 'up'])->name('up');
    Route::get('destroy', [SiteControlController::class, 'destroy'])->name('destroy');
});
