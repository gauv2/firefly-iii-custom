<?php

/*
 * PayCycleController.php
 * Firefly III Custom: budgets per pay cycle.
 *
 * home() is where the Budgets links go: it opens the monthly Budgets page or the pay-cycle view,
 * whichever was chosen last (the "mode" in the user's "customCycle" preference); ?mode=month or
 * ?mode=cycle switches and remembers. index() renders the pay-cycle view; its data (salary dates,
 * cycle budget limits, spending) is read and written by js/custom/pay-cycle.js through the v1 API.
 */

declare(strict_types=1);

namespace FireflyIII\Http\Controllers\Custom;

use FireflyIII\Http\Controllers\Controller;
use FireflyIII\Support\Facades\Preferences;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class PayCycleController extends Controller
{
    private const string PREF = 'customCycle';

    public function __construct()
    {
        parent::__construct();

        $this->middleware(static function ($request, $next) {
            app('view')->share('title', 'Budgets');
            app('view')->share('mainTitleIcon', 'bi-pie-chart');

            return $next($request);
        });
    }

    public function home(Request $request): RedirectResponse
    {
        $data = Preferences::get(self::PREF, [])->data;
        $data = is_array($data) ? $data : [];
        $mode = $request->query('mode');
        if ('month' === $mode || 'cycle' === $mode) {
            $data['mode'] = $mode;
            Preferences::set(self::PREF, $data);
        }

        return 'cycle' === ($data['mode'] ?? 'month')
            ? redirect(route('budgets.cycle'))
            : redirect(route('budgets.index'));
    }

    public function index(): View
    {
        return view('custom.pay-cycle');
    }
}
