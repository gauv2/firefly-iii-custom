@extends('layout.v3.session')
{{-- custom: the redesigned Home page. Filled from the API by js/custom/home.js. --}}
@section('breadcrumbs')
    <span class="visually-hidden">Home</span>
@endsection
@section('content')
    <div class="ff-home"
         id="ff-home"
         data-url-accounts="{{ route('accounts.index', ['asset']) }}"
         data-url-account="{{ route('accounts.show', ['__ID__']) }}"
         data-url-transactions="{{ route('transactions.index', ['all']) }}"
         data-url-transaction="{{ route('transactions.show', ['__ID__']) }}"
         data-url-categories="{{ route('categories.index') }}"
         data-url-budgets="{{ route('budgets.index') }}"
         data-url-subscriptions="{{ route('subscriptions.index') }}"
         data-url-piggies="{{ route('piggy-banks.index') }}"
         data-url-piggy="{{ route('piggy-banks.show', ['__ID__']) }}"
         data-url-create-piggy="{{ route('piggy-banks.create') }}"
         data-url-create-budget="{{ route('budgets.create') }}">

        <section class="card ff-summary" aria-label="This period">
            <div class="ff-stat ff-stat-main">
                <span class="ff-stat-label">Net worth</span>
                <span class="ff-stat-value ff-big" data-fill="net-worth"><span class="ff-skel"></span></span>
                <span class="ff-delta" data-fill="net-worth-delta" hidden></span>
            </div>
            <div class="ff-stat">
                <span class="ff-stat-label">Money in</span>
                <span class="ff-stat-value ff-pos" data-fill="earned"><span class="ff-skel"></span></span>
                <span class="ff-stat-sub" data-fill="earned-sub"></span>
            </div>
            <div class="ff-stat">
                <span class="ff-stat-label">Money out</span>
                <span class="ff-stat-value" data-fill="spent"><span class="ff-skel"></span></span>
                <span class="ff-stat-sub" data-fill="spent-sub"></span>
            </div>
            <div class="ff-stat">
                <span class="ff-stat-label">Budget left</span>
                <span class="ff-stat-value" data-fill="left"><span class="ff-skel"></span></span>
                <span class="ff-stat-sub" data-fill="left-sub"></span>
            </div>
        </section>

        <div class="ff-grid">
            <section class="card ff-span-8" aria-labelledby="ff-h-balance">
                <div class="ff-card-h">
                    <h2 id="ff-h-balance">Balance</h2>
                    <span class="ff-card-note" data-fill="balance-note">Your accounts · daily</span>
                </div>
                <div class="ff-card-b ff-chart" data-fill="balance-chart"><div class="ff-skel ff-skel-chart"></div></div>
            </section>

            <section class="card ff-span-4" aria-labelledby="ff-h-accounts">
                <div class="ff-card-h">
                    <h2 id="ff-h-accounts">Accounts</h2>
                    <a class="ff-card-link" href="{{ route('accounts.index', ['asset']) }}">All</a>
                </div>
                <div class="ff-card-b ff-rows" data-fill="accounts"><div class="ff-skel ff-skel-rows"></div></div>
            </section>

            <section class="card ff-span-7" aria-labelledby="ff-h-categories">
                <div class="ff-card-h">
                    <h2 id="ff-h-categories">Where the money went</h2>
                    <a class="ff-card-link" href="{{ route('categories.index') }}">Categories</a>
                </div>
                <div class="ff-card-b" data-fill="categories"><div class="ff-skel ff-skel-rows"></div></div>
            </section>

            <section class="card ff-span-5" aria-labelledby="ff-h-budgets">
                <div class="ff-card-h">
                    <h2 id="ff-h-budgets">Budgets</h2>
                    <a class="ff-card-link" href="{{ route('budgets.index') }}">Manage</a>
                </div>
                <div class="ff-card-b" data-fill="budgets"><div class="ff-skel ff-skel-rows"></div></div>
            </section>

            <section class="card ff-span-5" aria-labelledby="ff-h-upcoming">
                <div class="ff-card-h">
                    <h2 id="ff-h-upcoming">Coming up</h2>
                    <a class="ff-card-link" href="{{ route('subscriptions.index') }}">Subscriptions</a>
                </div>
                <div class="ff-card-b ff-rows" data-fill="upcoming"><div class="ff-skel ff-skel-rows"></div></div>
            </section>

            <section class="card ff-span-7" aria-labelledby="ff-h-recent">
                <div class="ff-card-h">
                    <h2 id="ff-h-recent">Recent activity</h2>
                    <a class="ff-card-link" href="{{ route('transactions.index', ['all']) }}">All transactions</a>
                </div>
                <div class="ff-card-b ff-rows" data-fill="recent"><div class="ff-skel ff-skel-rows"></div></div>
            </section>

            <section class="card ff-span-12" aria-labelledby="ff-h-goals">
                <div class="ff-card-h">
                    <h2 id="ff-h-goals">Savings goals</h2>
                    <a class="ff-card-link" href="{{ route('piggy-banks.index') }}">All goals</a>
                </div>
                <div class="ff-card-b ff-goals" data-fill="goals"><div class="ff-skel ff-skel-rows"></div></div>
            </section>
        </div>
    </div>
@endsection
@section('scripts')
    @vite(['js/custom/home.js'])
@endsection
