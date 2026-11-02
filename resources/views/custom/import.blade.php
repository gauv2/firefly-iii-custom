@extends('layout.v3.session')
{{-- custom: the Import page. Everything happens in js/custom/import.js through the v1 API. --}}
@section('breadcrumbs')
    <span class="visually-hidden">Import</span>
@endsection
@section('content')
    <div class="ff-home ff-import"
         id="ff-import"
         data-url-transaction="{{ route('transactions.show', ['__ID__']) }}">

        <section class="card ff-scan-start" aria-labelledby="ff-h-file">
            <div class="ff-card-h">
                <h2 id="ff-h-file">Import a bank statement</h2>
            </div>
            <div class="ff-card-b">
                <p class="ff-employer-help">
                    Pick a statement from ING: the CSV download (comma or semicolon, Dutch or English) or camt.053.
                    It is read here in the browser and checked against your transactions first. Nothing is imported
                    until you press Import, and every possible duplicate waits for your choice.
                </p>
                <div class="ff-scan-actions">
                    <label class="btn btn-primary ff-scan-btn">
                        <em class="bi bi-file-earmark-arrow-up" aria-hidden="true"></em> Choose a statement
                        <input type="file" accept=".csv,.txt,.xml,text/csv,application/xml,text/xml" data-input="file" class="visually-hidden">
                    </label>
                </div>
                <p class="ff-scan-drop" data-drop>…or drop it here</p>
                <p class="ff-employer-status" data-fill="file-status" role="status"></p>
            </div>
        </section>

        <section class="card" data-fill="accounts-card" hidden aria-labelledby="ff-h-accounts">
            <div class="ff-card-h">
                <h2 id="ff-h-accounts">Into which account</h2>
            </div>
            <div class="ff-card-b" data-fill="accounts"></div>
        </section>

        <section class="card" data-fill="review-card" hidden aria-labelledby="ff-h-review">
            <div class="ff-card-h">
                <h2 id="ff-h-review">Review</h2>
                <span class="ff-card-note" data-fill="summary"></span>
            </div>
            <div class="ff-card-b">
                <div class="ff-import-filters" role="tablist" data-fill="filters"></div>
                <div class="ff-import-bulk" data-fill="bulk"></div>
                <div class="ff-import-rows" data-fill="rows"></div>
                <div class="ff-import-go">
                    <button type="button" class="btn btn-primary" data-act="import" disabled>Import</button>
                    <span class="ff-employer-status" data-fill="go-status" role="status"></span>
                </div>
            </div>
        </section>
    </div>
@endsection
@section('scripts')
    @vite(['js/custom/import.js'])
@endsection
