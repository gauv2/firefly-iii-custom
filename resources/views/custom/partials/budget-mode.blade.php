{{-- custom: Month / Pay cycle switch on both budget views; the choice is remembered (PayCycleController@home). --}}
<nav class="ff-budget-mode" aria-label="Budget period">
    <a href="{{ route('budgets.home', ['mode' => 'month']) }}" @if('month' === $mode) aria-current="page" @endif>Month</a>
    <a href="{{ route('budgets.home', ['mode' => 'cycle']) }}" @if('cycle' === $mode) aria-current="page" @endif>Pay cycle</a>
</nav>
