@extends('layout.v3.session')
{{-- custom: budgets per pay cycle. Everything is filled by js/custom/pay-cycle.js through the v1 API. --}}
@section('breadcrumbs')
    <span class="visually-hidden">Budgets per pay cycle</span>
@endsection
@section('content')
    @include('custom.partials.budget-mode', ['mode' => 'cycle'])
    <div class="ff-home ff-cycle"
         id="ff-cycle"
         data-url-budget="{{ route('budgets.show', ['__ID__']) }}"
         data-url-no-budget="{{ route('budgets.no-budget', ['__START__', '__END__']) }}"
         data-url-create="{{ route('budgets.create') }}">

        <section class="card ff-cycle-nav" aria-labelledby="ff-h-cycle">
            <div class="ff-card-b">
                <div class="ff-cycle-head">
                    <button type="button" class="btn btn-outline-secondary" data-act="prev" aria-label="Previous pay cycle"><em class="bi bi-chevron-left" aria-hidden="true"></em></button>
                    <div class="ff-cycle-title">
                        <h2 id="ff-h-cycle" data-fill="title"><span class="ff-skel" style="display:inline-block;width:180px;height:1em"></span></h2>
                        <p data-fill="subtitle" role="status"></p>
                    </div>
                    <button type="button" class="btn btn-outline-secondary" data-act="next" aria-label="Next pay cycle"><em class="bi bi-chevron-right" aria-hidden="true"></em></button>
                </div>
                <div class="ff-cycle-tiles" data-fill="tiles"></div>
            </div>
        </section>

        <section class="card" aria-labelledby="ff-h-budgets">
            <div class="ff-card-h">
                <h2 id="ff-h-budgets">Budgets this cycle</h2>
                <span class="ff-card-note" data-fill="budgets-note"></span>
            </div>
            <div class="ff-card-b">
                <div data-fill="budgets"><div class="ff-skel ff-skel-rows"></div></div>
                <div class="ff-cycle-actions">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-act="copy">Copy amounts from the last cycle</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-act="clear">Clear this cycle's amounts</button>
                    <span class="ff-employer-status" data-fill="status" role="status"></span>
                </div>
            </div>
        </section>

        <section class="card" aria-labelledby="ff-h-salary">
            <div class="ff-card-h">
                <h2 id="ff-h-salary">Pay days</h2>
                <span class="ff-card-note">A cycle starts the day your salary lands</span>
            </div>
            <div class="ff-card-b">
                <label class="ff-field ff-cycle-source"><span>Salary comes from</span>
                    <select class="form-select" data-fill="source"></select>
                </label>
                <div data-fill="paydays"></div>
            </div>
        </section>
    </div>
@endsection
@section('scripts')
    @vite(['js/custom/pay-cycle.js'])
@endsection
