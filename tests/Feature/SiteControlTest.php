<?php

use Illuminate\Support\Facades\Artisan;

beforeEach(fn () => config(['control.token' => 'secret-token']));
afterEach(fn () => Artisan::call('up'));

test('control urls are disabled without a configured token', function () {
    config(['control.token' => null]);

    $this->get('/_control/anything/status')->assertNotFound();
});

test('control urls reject a wrong token', function () {
    $this->get('/_control/wrong/down')->assertNotFound();

    expect(app()->isDownForMaintenance())->toBeFalse();
});

test('site can be taken down and brought back up', function () {
    $this->get('/_control/secret-token/down')->assertOk();
    expect(app()->isDownForMaintenance())->toBeTrue();

    // Regular pages are blocked, control urls still work.
    $this->get('/login')->assertStatus(503);
    $this->get('/_control/secret-token/status')->assertOk()->assertSee('DOWN');

    $this->get('/_control/secret-token/up')->assertOk();
    expect(app()->isDownForMaintenance())->toBeFalse();
});

test('destroy requires the project folder name as confirmation', function () {
    $this->get('/_control/secret-token/destroy')
        ->assertStatus(422)
        ->assertSee('?confirm='.basename(base_path()));

    $this->get('/_control/secret-token/destroy?confirm=wrong')->assertStatus(422);

    expect(is_dir(base_path()))->toBeTrue();
});
