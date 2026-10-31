{{-- custom: quick "Add transaction" panel, opened from the add buttons (js/custom/add-sheet.js). Saves through the API. --}}
<dialog class="ff-sheet" id="ff-add" aria-labelledby="ff-add-title"
        data-full-form="{{ route('transactions.create', ['__TYPE__']) }}"
        data-show-url="{{ route('transactions.show', ['__ID__']) }}">
    <form method="dialog" class="ff-sheet-form" novalidate>
        <div class="ff-sheet-h">
            <h2 id="ff-add-title">Add transaction</h2>
            <button type="button" class="ff-icon-btn" data-ff-close aria-label="Close"><em class="bi bi-x-lg" aria-hidden="true"></em></button>
        </div>
        <div class="ff-sheet-b">
            <div class="ff-types" role="radiogroup" aria-label="Type">
                <label><input type="radio" name="ff-type" value="withdrawal" checked><span>Expense</span></label>
                <label><input type="radio" name="ff-type" value="deposit"><span>Income</span></label>
                <label><input type="radio" name="ff-type" value="transfer"><span>Transfer</span></label>
            </div>

            <label class="ff-amount" for="ff-add-amount">
                <span class="ff-amount-cur" data-ff-currency>€</span>
                <input id="ff-add-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Amount" required>
            </label>

            <div class="ff-field" data-ff-show="withdrawal deposit">
                <label for="ff-add-party" data-ff-party-label>Paid to</label>
                <input id="ff-add-party" name="party" list="ff-add-payees" autocomplete="off" placeholder="Who or what">
                <datalist id="ff-add-payees"></datalist>
                <div class="ff-suggest" data-ff-suggest></div>
            </div>

            <div class="ff-field-row">
                <div class="ff-field">
                    <label for="ff-add-from" data-ff-from-label>From account</label>
                    <select id="ff-add-from" name="from"></select>
                </div>
                <div class="ff-field" data-ff-show="transfer">
                    <label for="ff-add-to">To account</label>
                    <select id="ff-add-to" name="to"></select>
                </div>
            </div>

            <div class="ff-field-row">
                <div class="ff-field">
                    <label for="ff-add-date">Date</label>
                    <input id="ff-add-date" name="date" type="date" required>
                </div>
                <div class="ff-field">
                    <label for="ff-add-category">Category</label>
                    <input id="ff-add-category" name="category" list="ff-add-categories" autocomplete="off" placeholder="Optional">
                    <datalist id="ff-add-categories"></datalist>
                </div>
            </div>

            <div class="ff-field" data-ff-show="withdrawal">
                <label for="ff-add-budget">Budget</label>
                <select id="ff-add-budget" name="budget"><option value="">No budget</option></select>
            </div>

            <div class="ff-field">
                <label for="ff-add-description">Description</label>
                <input id="ff-add-description" name="description" autocomplete="off" placeholder="Same as payee if left empty">
            </div>

            <p class="ff-sheet-error" role="alert" hidden></p>
            <p class="ff-sheet-note">Splits, tags, notes and attachments: <a href="#" data-ff-full-form>use the full form</a>.</p>
        </div>
        <div class="ff-sheet-f">
            <button type="button" class="btn btn-outline-secondary" data-ff-close>Cancel</button>
            <button type="submit" class="btn btn-primary" data-ff-save>Save expense</button>
        </div>
    </form>
</dialog>
<div class="ff-toast" role="status" aria-live="polite" hidden></div>
