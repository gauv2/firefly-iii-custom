<?php

/*
 * ImportController.php
 * Firefly III Custom: the Import page (bank statements).
 *
 * Only renders the page. The statement file (ING CSV or camt.053) is read in the browser by
 * js/custom/import.js, checked against existing transactions and imported through the v1 API.
 * Nothing about the file reaches the server until a row is imported as a transaction.
 */

declare(strict_types=1);

namespace FireflyIII\Http\Controllers\Custom;

use FireflyIII\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

final class ImportController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(static function ($request, $next) {
            app('view')->share('title', 'Import');
            app('view')->share('mainTitleIcon', 'bi-upload');

            return $next($request);
        });
    }

    public function index(): View
    {
        return view('custom.import');
    }
}
