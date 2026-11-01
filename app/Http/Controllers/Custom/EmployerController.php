<?php

/*
 * EmployerController.php
 * Firefly III Custom: the Employer page (payslips, expensing, mobility budget).
 *
 * Only renders the page. Its data is the user's "customEmployer" preference and Firefly's own
 * transactions, both read and written by js/custom/employer.js through the v1 API.
 */

declare(strict_types=1);

namespace FireflyIII\Http\Controllers\Custom;

use FireflyIII\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

final class EmployerController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(static function ($request, $next) {
            app('view')->share('title', 'Employer');
            app('view')->share('mainTitleIcon', 'bi-briefcase');

            return $next($request);
        });
    }

    public function index(): View
    {
        return view('custom.employer');
    }
}
