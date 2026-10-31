{{-- custom: five everyday destinations, everything else under "More". Search moved to the top bar. --}}
<ul
    class="nav sidebar-menu flex-column"
    data-lte-toggle="treeview"
    role="navigation"
    aria-label="Main navigation"
    data-accordion="false"
    id="navigation"
    x-data="sidebar"
>
    <li class="nav-item ff-search-link">
        <a href="{{ route('search.index') }}" class="nav-link {{ \FireflyIII\Support\Blade\Navigation::menuItemActive('search.index') }}">
            <em class="nav-icon bi bi-search"></em>
            <p>{{ __('firefly.search') }}</p>
        </a>
    </li>
    <li class="nav-item">
        <a href="{{ route('index') }}" class="nav-link {{ \FireflyIII\Support\Blade\Navigation::menuItemActive('index') }}">
            <em class="nav-icon bi bi-house"></em>
            <p>Home</p>
        </a>
    </li>
    <li class="nav-item {{ menu_open_partial('transactions.') }}">
        <a href="#" class="nav-link">
            <em class="nav-icon bi bi-list-ul"></em>
            <p>
                {{ __('firefly.transactions') }}
                <em class="nav-arrow bi bi-chevron-right"></em>
            </p>
        </a>
        <ul class="nav nav-treeview">
            <li class="nav-item sub-nav-item">
                <a href="{{ route('transactions.index', ['all']) }}" class="nav-link {{ menu_sub_item_active('transactions.index','all') }}">
                    <p>All</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('transactions.index', ['withdrawal']) }}" class="nav-link {{ menu_sub_item_active('transactions.index','withdrawal') }}">
                    <p>Money out</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('transactions.index', ['deposit']) }}" class="nav-link {{ menu_sub_item_active('transactions.index','deposit') }}">
                    <p>Money in</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('transactions.index', ['transfers']) }}" class="nav-link {{ menu_sub_item_active('transactions.index','transfers') }}">
                    <p>{{ __('firefly.transfers') }}</p>
                </a>
            </li>
        </ul>
    </li>
    <li class="nav-item">
        <a href="{{ route('budgets.index') }}" class="nav-link {{ menu_item_active_partial('budgets.') }}">
            <em class="nav-icon bi bi-pie-chart"></em>
            <p>{{ __('firefly.budgets') }}</p>
        </a>
    </li>
    <li class="nav-item">
        <a href="{{ route('subscriptions.index') }}" class="nav-link {{ menu_item_active_partial('subscriptions.') }}">
            <em class="nav-icon bi bi-arrow-repeat"></em>
            <p>{{ __('firefly.subscriptions') }}</p>
        </a>
    </li>
    <li class="nav-item">
        <a href="{{ route('piggy-banks.index') }}" class="nav-link {{ menu_item_active_partial('piggy-banks.') }}">
            <em class="nav-icon bi bi-bullseye"></em>
            <p>Savings goals</p>
        </a>
    </li>

    <li class="nav-header text-uppercase">More</li>

    <li class="nav-item {{ menu_open_partial('accounts.') }}">
        <a href="#" class="nav-link">
            <em class="nav-icon bi bi-wallet2"></em>
            <p>
                {{__('firefly.accounts')}}
                <em class="nav-arrow bi bi-chevron-right"></em>
            </p>
        </a>
        <ul class="nav nav-treeview">
            <li class="nav-item sub-nav-item">
                <a href="{{ route('accounts.index', ['asset']) }}" class="nav-link {{ menu_sub_item_active('accounts.index','asset') }}">
                    <p>Your accounts</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('accounts.index', ['liabilities']) }}" class="nav-link {{ menu_sub_item_active('accounts.index','liabilities') }}">
                    <p>Loans and debts</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('accounts.index', ['expense']) }}" class="nav-link {{ menu_sub_item_active('accounts.index','expense') }}">
                    <p>Payees</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('accounts.index', ['revenue']) }}" class="nav-link {{ menu_sub_item_active('accounts.index','revenue') }}">
                    <p>Income sources</p>
                </a>
            </li>
        </ul>
    </li>
    <li class="nav-item">
        <a href="{{ route('reports.index') }}" class="nav-link {{ menu_item_active_partial('reports.') }}">
            <em class="nav-icon bi bi-bar-chart"></em>
            <p>{{ __('firefly.reports') }}</p>
        </a>
    </li>
    <li class="nav-item {{ menu_open_partial('categories.') }} {{ menu_open_partial('tags.') }} {{ menu_open_partial('object-groups.') }}">
        <a href="#" class="nav-link">
            <em class="nav-icon bi bi-tags"></em>
            <p>
                Categories &amp; tags
                <em class="nav-arrow bi bi-chevron-right"></em>
            </p>
        </a>
        <ul class="nav nav-treeview">
            <li class="nav-item sub-nav-item">
                <a href="{{ route('categories.index') }}" class="nav-link {{ menu_item_active_partial('categories.') }}">
                    <p>{{trans('firefly.categories')}}</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('tags.index') }}" class="nav-link {{ menu_item_active_partial('tags.') }}">
                    <p>{{trans('firefly.tags')}}</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('object-groups.index') }}" class="nav-link {{ menu_item_active_partial('object-groups.') }}">
                    <p>{{trans('firefly.object_groups_menu_bar')}}</p>
                </a>
            </li>
        </ul>
    </li>
    <li class="nav-item {{ menu_open_partial('rules.') }} {{ menu_open_partial('rule-groups.') }} {{ menu_open_partial('webhooks.') }} {{ menu_open_partial('recurring.') }}">
        <a href="#" class="nav-link">
            <em class="nav-icon bi bi-lightning"></em>
            <p>
                Rules &amp; automation
                <em class="nav-arrow bi bi-chevron-right"></em>
            </p>
        </a>
        <ul class="nav nav-treeview">
            <li class="nav-item sub-nav-item">
                <a href="{{ route('rules.index') }}" class="nav-link {{ menu_item_active_partial('rules.') }} {{ menu_item_active_partial('rule-groups.') }}">
                    <p>{{__('firefly.rules')}}</p>
                </a>
            </li>
            <li class="nav-item sub-nav-item">
                <a href="{{ route('recurring.index') }}" class="nav-link {{ menu_item_active_partial('recurring.') }}">
                    <p>{{__('firefly.recurrences') }}</p>
                </a>
            </li>
            @if(true === $featuringWebhooks)
            <li class="nav-item sub-nav-item">
                <a href="{{ route('webhooks.index') }}" class="nav-link {{ menu_item_active_partial('webhooks.') }}">
                    <p>{{ __('firefly.webhooks') }}</p>
                </a>
            </li>
            @endif
        </ul>
    </li>
    <li class="nav-item {{ menu_open_partial('currencies.') }} {{ menu_open_partial('exchange-rates.') }} {{ menu_open_partial('export.') }}">
        <a href="#" class="nav-link">
            <em class="nav-icon bi bi-three-dots"></em>
            <p>
                Other
                <em class="nav-arrow bi bi-chevron-right"></em>
            </p>
        </a>
        <ul class="nav nav-treeview">
            <li class="nav-item sub-nav-item">
                <a href="{{ route('currencies.index') }}" class="nav-link {{ menu_item_active_partial('currencies.') }}">
                    <p>{{ __('firefly.currencies') }}</p>
                </a>
            </li>
            @if(true === $featuringCer)
            <li class="nav-item sub-nav-item">
                <a href="{{ route('exchange-rates.index') }}" class="nav-link {{ menu_item_active_partial('exchange-rates.') }}">
                    <p>{{ __('firefly.menu_exchange_rates_index') }}</p>
                </a>
            </li>
            @endif
            <li class="nav-item sub-nav-item">
                <a href="{{ route('export.index') }}" class="nav-link {{ menu_item_active_partial('export.') }}">
                    <p>{{ __('firefly.export_data_menu') }}</p>
                </a>
            </li>
        </ul>
    </li>

    @if('web' === $authGuard)
        <li class="nav-item">
            <a href="{{ route('logout') }}" @click="logoutUser" class="nav-link logout-link">
                <em class="nav-icon bi bi-box-arrow-right"></em>
                <p>{{ __('firefly.logout') }}</p>
            </a>
        </li>
    @endif
    @if('remote_user_guard' === $authGuard && '' !== $logoutUrl)
        <li class="nav-item">
            <a href="{{ $logoutUrl }}" class="nav-link logout-link">
                <em class="nav-icon bi bi-box-arrow-right"></em>
                <p>{{ __('firefly.logout') }}</p>
            </a>
        </li>
    @endif
</ul>
