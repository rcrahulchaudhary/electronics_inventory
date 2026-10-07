<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Remote Site Control Token
    |--------------------------------------------------------------------------
    |
    | Secret token for the public /_control/{token}/... URLs that put the
    | site into maintenance mode, bring it back up, or delete the project
    | directory. Leave empty to disable these URLs entirely (they 404).
    | Use a long random value, e.g. `php -r "echo bin2hex(random_bytes(32));"`
    |
    */

    'token' => env('APP_CONTROL_TOKEN'),

];
