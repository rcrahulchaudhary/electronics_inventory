<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Artisan;

/**
 * Token-protected public URLs for controlling the deployed site
 * (e.g. on cPanel, where there is no SSH access).
 */
class SiteControlController extends Controller
{
    public function status(string $token): Response
    {
        $this->authorizeToken($token);

        return $this->text(app()->isDownForMaintenance() ? 'Site is DOWN (maintenance mode).' : 'Site is UP.');
    }

    public function down(string $token): Response
    {
        $this->authorizeToken($token);

        // No --render: a prerendered page is served before Laravel boots and matches the
        // raw URL path, which breaks the _control/* exception when installed in a subfolder.
        Artisan::call('down', ['--retry' => 60]);

        return $this->text('Site is now DOWN (maintenance mode).');
    }

    public function up(string $token): Response
    {
        $this->authorizeToken($token);

        Artisan::call('up');

        return $this->text('Site is now UP.');
    }

    /**
     * Permanently delete the whole project directory.
     * Requires ?confirm=<project folder name> to guard against accidental hits.
     */
    public function destroy(Request $request, string $token): Response
    {
        $this->authorizeToken($token);

        $basePath = base_path();
        $folder = basename($basePath);

        if ($request->query('confirm') !== $folder) {
            return $this->text("To permanently delete the project directory, repeat this URL with ?confirm={$folder}", 422);
        }

        // Delete after the response has been sent, so the framework can finish
        // the request before its own files disappear.
        app()->terminating(function () use ($basePath) {
            ignore_user_abort(true);
            set_time_limit(0);
            self::deleteDirectory($basePath);
        });

        return $this->text("Project directory '{$folder}' is being deleted.");
    }

    private function authorizeToken(string $token): void
    {
        $expected = (string) config('control.token');

        abort_if($expected === '' || ! hash_equals($expected, $token), 404);
    }

    private function text(string $message, int $status = 200): Response
    {
        return response($message, $status, ['Content-Type' => 'text/plain']);
    }

    /**
     * Uses only core PHP so nothing needs autoloading from the directory being deleted.
     */
    private static function deleteDirectory(string $path): void
    {
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($items as $item) {
            if ($item->isDir() && ! $item->isLink()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }

        @rmdir($path);
    }
}
