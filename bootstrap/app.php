<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::group([], base_path('routes/control.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['superadmin' => \App\Http\Middleware\SuperAdmin::class]);

        // Keep the site control URLs reachable while the site is down.
        $middleware->preventRequestsDuringMaintenance(except: ['_control/*']);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response, \Throwable $exception, Request $request) {
            if (!$request->inertia() && $response->getStatusCode() === 403) {
                return Inertia::render('error', [
                    'status' => 403,
                ])->toResponse($request)->setStatusCode(403);
            }
            return $response;
        });
    })->create();
