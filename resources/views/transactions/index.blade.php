@extends('layout.v3.session')
{{-- custom: redesigned transactions list (filter chips, period summary, day-grouped rows). Upstream's pie charts are dropped. --}}
@section('content')
    @php
        $hasPeriods = is_countable($periods) && count($periods) > 0;
        $current = $hasPeriods ? $periods[array_key_first($periods)] : null;
        $chips = ['all' => 'All', 'withdrawal' => 'Money out', 'deposit' => 'Money in', 'transfers' => __('firefly.transfers')];
        $active = 'transfer' === $objectType ? 'transfers' : $objectType;
    @endphp
    <div class="ff-page">
        <div class="ff-toolbar">
            <nav class="ff-chips" aria-label="Filter transactions">
                @foreach($chips as $key => $label)
                    <a class="ff-chip" href="{{ $hasPeriods ? route('transactions.index', [$key]) : route('transactions.index.all', [$key]) }}" @if($active === $key) aria-current="page" @endif>{{ $label }}</a>
                @endforeach
            </nav>
            <div class="ff-toolbar-end">
                @if($hasPeriods)
                    <a class="btn btn-sm btn-outline-secondary" href="{{ route('transactions.index.all', [$objectType]) }}">{{ __('firefly.showEverything') }}</a>
                @else
                    <a class="btn btn-sm btn-outline-secondary" href="{{ route('transactions.index', [$objectType]) }}">Current period only</a>
                @endif
            </div>
        </div>

        @if(null !== $current)
            <section class="card ff-summary ff-summary-3" aria-label="{{ $current['title'] }}">
                <div class="ff-stat">
                    <span class="ff-stat-label">{{ $current['title'] }}</span>
                    <span class="ff-stat-value">{{ $current['total_transactions'] }}</span>
                    <span class="ff-stat-sub">{{ 1 === $current['total_transactions'] ? 'transaction' : 'transactions' }}</span>
                </div>
                <div class="ff-stat">
                    <span class="ff-stat-label">Money out</span>
                    <span class="ff-stat-value">
                        @php $shown = false; @endphp
                        @foreach(($current['spent'] ?? []) as $spent)
                            @if(is_array($spent) && 0 !== $spent['amount'])
                                @php $shown = true; @endphp
                                {!! format_amount_by_symbol(abs((float) $spent['amount']), $spent['currency_symbol'], $spent['currency_decimal_places'], false) !!}
                            @endif
                        @endforeach
                        @if(!$shown)—@endif
                    </span>
                    <span class="ff-stat-sub">This period</span>
                </div>
                <div class="ff-stat">
                    <span class="ff-stat-label">Money in</span>
                    <span class="ff-stat-value ff-pos">
                        @php $shown = false; @endphp
                        @foreach(($current['earned'] ?? []) as $entry)
                            @if(is_array($entry) && 0 !== $entry['amount'])
                                @php $shown = true; @endphp
                                {!! format_amount_by_symbol(abs((float) $entry['amount']), $entry['currency_symbol'], $entry['currency_decimal_places'], false) !!}
                            @endif
                        @endforeach
                        @if(!$shown)—@endif
                    </span>
                    <span class="ff-stat-sub">This period</span>
                </div>
            </section>
        @endif

        <section class="card ff-txcard" aria-label="{{ $subTitle }}">
            <x-lists.groups-day :groups="$groups" :account="null" />
        </section>

        @if($hasPeriods && count($periods) > 1)
            <section class="card" aria-labelledby="ff-h-periods">
                <div class="ff-card-h"><h2 id="ff-h-periods">Earlier periods</h2></div>
                <div class="ff-card-b ff-periods">
                    @foreach(array_slice($periods, 1) as $period)
                        <a class="ff-period-link" href="{{ $period['route'] }}">
                            <b>{{ $period['title'] }}</b>
                            <span>{{ $period['total_transactions'] }} transactions</span>
                            @foreach(($period['spent'] ?? []) as $spent)
                                @if(is_array($spent) && 0 !== $spent['amount'])
                                    <span>{!! format_amount_by_symbol(abs((float) $spent['amount']), $spent['currency_symbol'], $spent['currency_decimal_places'], false) !!} out</span>
                                @endif
                            @endforeach
                        </a>
                    @endforeach
                </div>
            </section>
        @endif
    </div>
@endsection
@section('scripts')
    @vite(['js/pages/generic-nodates.js'])
    <script src="v1/js/ff/list/groups.js?v={{ $FF_BUILD_TIME }}" nonce="{{ $JS_NONCE }}"></script>
@endsection
