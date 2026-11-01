@extends('layout.v3.session')
{{-- custom: the Scan page. Reading goes through ScanController@extract; the rest is js/custom/scan.js. --}}
@section('breadcrumbs')
    <span class="visually-hidden">Scan</span>
@endsection
@section('content')
    <div class="ff-home ff-scan"
         id="ff-scan"
         data-url-extract="{{ route('scan.extract') }}"
         data-url-transaction="{{ route('transactions.show', ['__ID__']) }}"
         data-default-account="ING Checking">

        <section class="card ff-scan-start" aria-labelledby="ff-h-add">
            <div class="ff-card-h">
                <h2 id="ff-h-add">Add a receipt or invoice</h2>
            </div>
            <div class="ff-card-b">
                <p class="ff-employer-help">
                    Take a photo or pick photos and PDFs. Each one is read, matched against your transactions,
                    and attached to the one you choose, or to a new one.
                </p>
                <div class="ff-scan-actions">
                    <label class="btn btn-primary ff-scan-btn">
                        <em class="bi bi-camera" aria-hidden="true"></em> Take a photo
                        <input type="file" accept="image/*" capture="environment" data-input="camera" class="visually-hidden">
                    </label>
                    <label class="btn btn-outline-secondary ff-scan-btn">
                        <em class="bi bi-file-earmark-arrow-up" aria-hidden="true"></em> Choose files
                        <input type="file" accept="image/*,application/pdf" multiple data-input="files" class="visually-hidden">
                    </label>
                </div>
                <p class="ff-scan-drop" data-drop>…or drop files here</p>
            </div>
        </section>

        <div class="ff-scan-list" data-fill="list" aria-live="polite"></div>

        <section class="card" aria-labelledby="ff-h-dupes">
            <div class="ff-card-h">
                <h2 id="ff-h-dupes">Possible duplicates</h2>
                <span class="ff-card-note">Scanned transactions that a bank import may also contain</span>
            </div>
            <div class="ff-card-b" data-fill="dupes"><div class="ff-skel ff-skel-rows"></div></div>
            <p class="ff-employer-status ff-card-b" data-fill="dupes-status" role="status"></p>
        </section>

        <template id="ff-scan-item">
            <article class="card ff-scan-item">
                <div class="ff-scan-head">
                    <div class="ff-scan-thumb" data-slot="thumb"></div>
                    <div class="ff-scan-title">
                        <h2 data-slot="name"></h2>
                        <p class="ff-scan-state" data-slot="state" role="status"></p>
                    </div>
                    <button type="button" class="btn btn-sm btn-link ff-scan-remove" data-act="remove">Remove</button>
                </div>
                <form class="ff-scan-form" data-slot="form" hidden novalidate>
                    <div class="ff-scan-grid">
                        <label class="ff-field"><span>Payee</span><input class="form-control" name="payee" required></label>
                        <label class="ff-field"><span>Date</span><input class="form-control" type="date" name="date" required></label>
                        <label class="ff-field"><span>Amount</span><input class="form-control" type="number" step="0.01" min="0" inputmode="decimal" name="amount" required></label>
                        <label class="ff-field"><span>Description</span><input class="form-control" name="description" required></label>
                        <label class="ff-field"><span>Category</span><input class="form-control" name="category" list="ff-scan-categories" autocomplete="off"></label>
                        <label class="ff-field"><span>Paid from</span><select class="form-select" name="account"></select></label>
                        <label class="ff-field ff-field-wide"><span>Notes</span><textarea class="form-control" name="notes" rows="2"></textarea></label>
                    </div>
                    <fieldset class="ff-scan-matches">
                        <legend>Attach to</legend>
                        <div data-slot="matches"></div>
                    </fieldset>
                    <div class="ff-scan-submit">
                        <button type="submit" class="btn btn-primary" data-slot="submit">Save</button>
                        <span class="ff-scan-error" data-slot="error" role="alert"></span>
                    </div>
                </form>
            </article>
        </template>
        <datalist id="ff-scan-categories"></datalist>
    </div>
@endsection
@section('scripts')
    @vite(['js/custom/scan.js'])
@endsection
