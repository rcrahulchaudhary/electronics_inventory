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
     * Permanently delete the whole project directory, or with ?path=<relative path>
     * a single file or directory inside it.
     * Requires ?confirm=<name of the item being deleted> to guard against accidental hits.
     */
    public function destroy(Request $request, string $token): Response
    {
        $this->authorizeToken($token);

        $path = trim((string) $request->query('path', ''), '/');

        if ($path === '') {
            $target = base_path();
            $label = 'Project directory';
        } else {
            $target = $this->resolveProjectPath($path);

            if ($target === null) {
                return $this->text("Invalid path '{$path}': it must point inside the project directory.", 422);
            }

            if (! file_exists($target) && ! is_link($target)) {
                return $this->text("Not found: '{$path}'.", 404);
            }

            $label = is_dir($target) && ! is_link($target) ? 'Directory' : 'File';
        }

        $name = basename($target);

        if ($request->query('confirm') !== $name) {
            return $this->text("To permanently delete '{$name}', add confirm={$name} to this URL.", 422);
        }

        // Delete after the response has been sent, so the framework can finish
        // the request before its own files disappear.
        app()->terminating(function () use ($target) {
            ignore_user_abort(true);
            set_time_limit(0);

            if (is_dir($target) && ! is_link($target)) {
                self::deleteDirectory($target);
            } else {
                @unlink($target);
            }
        });

        return $this->text("{$label} '{$name}' is being deleted.");
    }

    /**
     * Resolve a path relative to the project directory, or null if it escapes it.
     * The last segment is not resolved, so a symlink is deleted itself, not its target.
     */
    private function resolveProjectPath(string $path): ?string
    {
        $segments = explode('/', $path);

        if (str_contains($path, "\0") || array_intersect($segments, ['', '.', '..'])) {
            return null;
        }

        $base = realpath(base_path());
        $parent = realpath($base.'/'.dirname($path));

        if ($parent === false || ($parent !== $base && ! str_starts_with($parent, $base.'/'))) {
            return null;
        }

        return $parent.'/'.end($segments);
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
