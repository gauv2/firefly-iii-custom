@extends('layout.v3.session')
{{-- custom: the Employer page. Filled from the API by js/custom/employer.js. --}}
@section('breadcrumbs')
    <span class="visually-hidden">Employer</span>
@endsection
@section('content')
    <div class="ff-home ff-employer"
         id="ff-employer"
         data-url-transaction="{{ route('transactions.show', ['__ID__']) }}"
         data-url-search="{{ route('search.index') }}">

        <p class="ff-employer-lead">
            Payslips and mobility-budget statements, for trend analysis. Your employer's money story,
            kept apart from your own: nothing here changes your balances or reports.
        </p>

        <div data-fill="empty" hidden></div>

        <section class="card" aria-labelledby="ff-h-salary" data-part="salary">
            <div class="ff-card-h">
                <h2 id="ff-h-salary">Salary trend</h2>
                <span class="ff-card-note" data-fill="salary-note"></span>
            </div>
            <div class="ff-card-b" data-fill="salary"><div class="ff-skel ff-skel-rows"></div></div>
        </section>

        <section class="card" aria-labelledby="ff-h-expensing" data-part="expensing">
            <div class="ff-card-h">
                <h2 id="ff-h-expensing">Expensing</h2>
                <span class="ff-card-note" data-fill="expensing-note"></span>
            </div>
            <div class="ff-card-b">
                <h3 class="ff-employer-h3">Business expenses vs. reimbursements</h3>
                <div data-fill="expensing"><div class="ff-skel ff-skel-rows"></div></div>

                <h3 class="ff-employer-h3" id="ff-h-senders">Reimbursement senders</h3>
                <p class="ff-employer-help">
                    A payment in whose sender or description contains one of these is an expense claim being
                    paid back, not salary.
                </p>
                <ul class="ff-chips" data-fill="senders" aria-labelledby="ff-h-senders"></ul>
                <form class="ff-employer-add" data-form="sender">
                    <label class="visually-hidden" for="ff-sender-input">Sender name</label>
                    <input type="text" class="form-control" id="ff-sender-input" placeholder="e.g. EY Adviseurs" autocomplete="off" required>
                    <button type="submit" class="btn btn-outline-secondary">Add sender</button>
                </form>
                <p class="ff-employer-status" data-fill="senders-status" role="status"></p>
            </div>
        </section>

        <section class="card" aria-labelledby="ff-h-mobility" data-part="mobility" hidden>
            <div class="ff-card-h">
                <h2 id="ff-h-mobility">Mobility</h2>
                <span class="ff-card-note">€0.26 per km</span>
            </div>
            <div class="ff-card-b" data-fill="mobility"></div>
            <p class="ff-employer-status ff-card-b" data-fill="mobility-status" role="status"></p>
        </section>
    </div>
@endsection
@section('scripts')
    @vite(['js/custom/employer.js'])
@endsection
