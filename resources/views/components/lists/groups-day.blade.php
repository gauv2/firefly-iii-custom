{{--
    custom: day-grouped transaction list (Firefly III Custom).
    Keeps the hooks of groups-large that v1/js/ff/list/groups.js uses: .mass-select, .select-all,
    .action-menu with .mass-edit / .bulk-edit / .mass-delete, and .clone-transaction(-and-edit).
--}}
@php
    $days = [];
    foreach ($groups as $group) {
        $first = $group['transactions'][array_key_first($group['transactions'])] ?? null;
        $key = null === $first ? 'none' : $first['date']->format('Y-m-d');
        $days[$key]['date'] = $first['date'] ?? null;
        $days[$key]['groups'][] = $group;
    }
@endphp
<div class="ff-txlist">
    <div class="ff-txlist-bar">
        <div class="ff-txlist-pages">
            @if(method_exists($groups, 'links'))
                {{ $groups->links('pagination.bootstrap-4') }}
            @endif
        </div>
        <div class="action-menu d-none">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" id="top_action_menu" data-bs-toggle="dropdown" aria-expanded="false">
                {{ __('firefly.actions') }}
            </button>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="top_action_menu">
                <li><a href="#" class="dropdown-item mass-edit"><span class="bi bi-pencil"></span> <span class="txt">{{ __('firefly.mass_edit') }}</span></a></li>
                <li><a href="#" class="dropdown-item bulk-edit"><span class="bi bi-pencil-square"></span> <span class="txt">{{ __('firefly.bulk_edit') }}</span></a></li>
                <li><a href="#" class="dropdown-item mass-delete"><span class="bi bi-trash"></span> <span class="txt">{{ __('firefly.mass_delete') }}</span></a></li>
            </ul>
        </div>
        <label class="ff-select-all">
            <input id="list_ALL" value="1" name="select-all" type="checkbox" class="select-all form-check-input"/>
            <span>Select all</span>
        </label>
    </div>

    @if(0 === count($days))
        <p class="ff-empty px-3 py-3">No transactions in this period.</p>
    @endif

    @foreach($days as $day)
        @php
            $dayTotal = [];
            foreach ($day['groups'] as $g) {
                foreach ($g['transactions'] as $t) {
                    if ('Withdrawal' === $t['transaction_type_type'] || 'Deposit' === $t['transaction_type_type']) {
                        $code = $t['currency_symbol'] . '|' . $t['currency_decimal_places'];
                        $sign = 'Deposit' === $t['transaction_type_type'] ? -1 : 1;
                        $dayTotal[$code] = ($dayTotal[$code] ?? 0) + $sign * (float) $t['amount'];
                    }
                }
            }
        @endphp
        <div class="ff-day">
            <span>{{ null === $day['date'] ? '' : $day['date']->isoFormat('dddd D MMMM') }}</span>
            <span class="ff-day-total">
                @foreach($dayTotal as $code => $sum)
                    @php [$symbol, $decimals] = explode('|', $code); @endphp
                    {!! format_amount_by_symbol($sum, $symbol, (int) $decimals) !!}@if(!$loop->last), @endif
                @endforeach
            </span>
        </div>
        @foreach($day['groups'] as $group)
            @if($group['count'] > 1)
                <div class="ff-tx ff-tx-group">
                    <span class="ff-avatar"><em class="bi bi-diagram-2" aria-hidden="true"></em></span>
                    <div class="ff-tx-main">
                        <a href="{{ route('transactions.show', [$group['id']]) }}" class="ff-tx-title">{{ $group['title'] }}</a>
                        <span class="ff-tx-sub">{{ $group['count'] }} splits</span>
                    </div>
                    <div class="ff-tx-cat"></div>
                    <div class="ff-tx-acct"></div>
                    <div class="ff-tx-amt">
                        @foreach($group['sums'] as $sum)
                            @if('Deposit' === $group['transaction_type'])
                                {!! format_amount_by_symbol($sum['amount']*-1, $sum['currency_symbol'], $sum['currency_decimal_places']) !!}
                            @elseif('Transfer' === $group['transaction_type'])
                                <span class="money-transfer">{!! format_amount_by_symbol($sum['amount']*-1, $sum['currency_symbol'], $sum['currency_decimal_places'], false) !!}</span>
                            @else
                                {!! format_amount_by_symbol($sum['amount'], $sum['currency_symbol'], $sum['currency_decimal_places']) !!}
                            @endif
                        @endforeach
                    </div>
                    <div class="ff-tx-act">
                        <div class="dropdown">
                            <button class="ff-icon-btn" type="button" id="group_menu_{{ $group['id'] }}" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for {{ $group['title'] }}"><em class="bi bi-three-dots" aria-hidden="true"></em></button>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="group_menu_{{ $group['id'] }}">
                                <li><a class="dropdown-item" href="{{ route('transactions.edit', [$group['id']]) }}?_from={{ urlencode($FF3_FROM) }}"><span class="bi bi-pencil"></span> {{ __('firefly.edit') }}</a></li>
                                <li><a class="dropdown-item" href="{{ route('transactions.delete', [$group['id']]) }}?_from={{ urlencode($FF3_FROM) }}"><span class="bi bi-trash"></span> {{ __('firefly.delete') }}</a></li>
                                <li><a class="dropdown-item clone-transaction" data-from="{{ $FF3_FROM }}" href="#" data-id="{{ $group['id'] }}"><span class="bi bi-copy"></span> {{ __('firefly.clone') }}</a></li>
                                <li><a class="dropdown-item clone-transaction-and-edit" data-from="{{ $FF3_FROM }}" href="#" data-id="{{ $group['id'] }}"><span class="bi bi-copy"></span> {{ __('firefly.clone_and_edit') }}</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="ff-tx-check"></div>
                </div>
            @endif
            @foreach($group['transactions'] as $transaction)
                @php
                    $type = $transaction['transaction_type_type'];
                    $isTransfer = 'Transfer' === $type;
                    $party = 'Deposit' === $type ? $transaction['source_account_name'] : ('Withdrawal' === $type ? $transaction['destination_account_name'] : null);
                    $initials = collect(preg_split('/\s+/', trim(preg_replace('/[^\pL\pN ]/u', ' ', (string) ($party ?? $transaction['description'])))))->filter()->take(2)->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->implode('');
                    $acct = $isTransfer ? $transaction['source_account_name'] . ' → ' . $transaction['destination_account_name'] : ('Deposit' === $type ? $transaction['destination_account_name'] : $transaction['source_account_name']);
                    $canSelect = 'Reconciliation' !== $type && 'Opening balance' !== $type && 'Liability credit' !== $type;
                @endphp
                <div class="ff-tx @if($group['count'] > 1) ff-tx-split @endif" data-date="{{ $transaction['date']->format('Y-m-d') }}" data-count="{{ $group['count'] }}" data-id="{{ $group['id'] }}">
                    <span class="ff-avatar">
                        @if($isTransfer)
                            <em class="bi bi-arrow-left-right" aria-hidden="true"></em>
                        @else
                            {{ '' === $initials ? '?' : $initials }}
                        @endif
                    </span>
                    <div class="ff-tx-main">
                        <a href="{{ route('transactions.show', [$group['id']]) }}" class="ff-tx-title" title="{{ $transaction['description'] }}">
                            {{ $transaction['description'] }}
                        </a>
                        <span class="ff-tx-sub">
                            @if($transaction['reconciled'])<span class="bi bi-check2-circle" title="Reconciled"></span>@endif
                            @if(count($transaction['attachments']) > 0)<span class="bi bi-paperclip" title="{{ __('firefly.attachments') }}"></span>@endif
                            {{ $transaction['category_name'] ?? ($isTransfer ? __('firefly.transfer') : 'No category') }} · {{ $acct }}
                        </span>
                    </div>
                    <div class="ff-tx-cat">
                        @if(null !== $transaction['category_id'])
                            <a class="ff-tag" href="{{ route('categories.show', [$transaction['category_id']]) }}"><i></i>{{ $transaction['category_name'] }}</a>
                        @elseif($isTransfer)
                            <span class="ff-tag ff-tag-muted"><i></i>{{ __('firefly.transfer') }}</span>
                        @endif
                        @if(null !== $transaction['budget_id'])
                            <a class="ff-tx-budget" href="{{ route('budgets.show', [$transaction['budget_id']]) }}">{{ $transaction['budget_name'] }}</a>
                        @endif
                    </div>
                    <div class="ff-tx-acct">{{ $acct }}</div>
                    <div class="ff-tx-amt">
                        <x-elements.transaction-amount
                            :type="$transaction['transaction_type_type']"
                            :amount="['amount' => $transaction['amount'], 'currency_id' => $transaction['currency_id'], 'currency_symbol' => $transaction['currency_symbol'], 'currency_decimal_places' => $transaction['currency_decimal_places']]"
                            :foreign="['amount' => $transaction['foreign_amount'],'currency_id' => $transaction['foreign_currency_id'], 'currency_symbol' => $transaction['foreign_currency_symbol'], 'currency_decimal_places' => $transaction['foreign_currency_decimal_places']]"
                            :account="$account ?? null"
                            :pc-amount="$transaction['pc_amount']"
                            :source-account="['type' => $transaction['source_account_type'], 'id' => $transaction['source_account_id']]"
                        />
                    </div>
                    <div class="ff-tx-act">
                        @if(1 === $group['count'])
                            <div class="dropdown">
                                <button class="ff-icon-btn" type="button" id="journal_menu_{{ $transaction['transaction_journal_id'] }}" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for {{ $transaction['description'] }}"><em class="bi bi-three-dots" aria-hidden="true"></em></button>
                                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="journal_menu_{{ $transaction['transaction_journal_id'] }}">
                                    <li><a class="dropdown-item" href="{{ route('transactions.edit', [$group['id']]) }}?_from={{ urlencode($FF3_FROM) }}"><span class="bi bi-pencil"></span> {{ __('firefly.edit') }}</a></li>
                                    @if('Opening balance' !== $type && 'Liability credit' !== $type)
                                        <li><a class="dropdown-item" href="{{ route('transactions.delete', [$group['id']]) }}?_from={{ urlencode($FF3_FROM) }}"><span class="bi bi-trash"></span> {{ __('firefly.delete') }}</a></li>
                                    @endif
                                    @if($canSelect)
                                        <li><a class="dropdown-item clone-transaction" data-from="{{ $FF3_FROM }}" href="#" data-id="{{ $group['id'] }}"><span class="bi bi-copy"></span> {{ __('firefly.clone') }}</a></li>
                                        <li><a class="dropdown-item clone-transaction-and-edit" data-from="{{ $FF3_FROM }}" href="#" data-id="{{ $group['id'] }}"><span class="bi bi-copy"></span> {{ __('firefly.clone_and_edit') }}</a></li>
                                        <li><a class="dropdown-item" href="{{ route('rules.create-from-journal', [$transaction['transaction_journal_id']]) }}"><span class="bi bi-lightning"></span> {{ __('firefly.create_rule_from_transaction') }}</a></li>
                                    @endif
                                </ul>
                            </div>
                        @endif
                    </div>
                    <div class="ff-tx-check">
                        @if($canSelect)
                            <input id="list_{{ $transaction['transaction_journal_id'] }}"
                                   value="{{ $transaction['transaction_journal_id'] }}"
                                   name="journals[{{ $transaction['transaction_journal_id'] }}]"
                                   type="checkbox" class="mass-select form-check-input"
                                   aria-label="Select {{ $transaction['description'] }}"
                                   data-value="{{ $transaction['transaction_journal_id'] }}"/>
                        @endif
                    </div>
                </div>
            @endforeach
        @endforeach
    @endforeach

    <div class="ff-txlist-bar ff-txlist-bottom">
        <div class="ff-txlist-pages">
            @if(method_exists($groups, 'links'))
                {{ $groups->links('pagination.bootstrap-4') }}
            @endif
        </div>
    </div>
</div>
@section('scripts')
    @parent
    <script nonce="{{ $JS_NONCE }}">
        var cloneGroupUrl = '{{ route('transactions.clone') }}';
        var cloneAndEditUrl = '{{ route('transactions.clone') }}?redirect=edit';
    </script>
@endsection
