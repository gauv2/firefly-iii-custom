# Finance (Firefly III Custom)

A personal fork of [Firefly III](https://github.com/firefly-iii/firefly-iii) (AGPL-3.0) with a redesigned
interface, a few extra pages, and receipt and invoice scanning. It runs as **Finance**: the name and icon
are changed, and the footer keeps Firefly III's copyright and licence notice.

`custom` is the default branch and holds all of this; `main` follows upstream. It is based on Firefly III
v6.7.9.

## What is changed

The look (Blade views and front-end assets) and a few extra pages. Each extra page is one route in
`routes/web.php` and a controller in `app/Http/Controllers/Custom` that only renders a view (or, for Scan,
forwards an upload); data goes through upstream's v1 API. The API and the database schema are
upstream's, so going back to upstream's image is always possible.

| Area | Files |
| --- | --- |
| Design tokens and theme (colours, Geist, corners, focus, contrast) | `resources/assets/v3/sass/_custom-theme.scss`, imported at the end of `app.scss` |
| Shell: top bar, period switcher, search, "Add transaction", phone tab bar | `_custom-shell.scss`, `js/custom/shell.js`, `views/layout/v3/session.blade.php`, `views/components/layout/{sidebar,range,create-menu,user-menu}.blade.php` |
| Home page | `views/index.blade.php`, `js/custom/home.js`, `_custom-home.scss` |
| Transactions list and a quick add-transaction panel | `views/transactions/index.blade.php`, `views/components/lists/groups-day.blade.php`, `views/components/layout/add-sheet.blade.php`, `js/custom/add-sheet.js`, `_custom-transactions.scss` |
| Budgets, subscriptions and savings goals (progress bars, status pills) | `views/budgets/index.blade.php`, `views/components/lists/*.blade.php`, `_custom-lists.scss` |
| Employer page: payslip trend, business expenses vs. reimbursements, mobility budget | `app/Http/Controllers/Custom/EmployerController.php`, `views/custom/employer.blade.php`, `js/custom/employer.js`, `_custom-employer.scss` |
| Scan page: receipts and invoices, see below | `app/Http/Controllers/Custom/ScanController.php`, `views/custom/scan.blade.php`, `js/custom/scan.js`, `_custom-scan.scss`, `scan/` |
| Name and icons | `views/layout/v3/*.blade.php`, `views/components/layout/fav-icons*.blade.php`, `custom/brand/` (SVG sources, rendered into `public/` by the image build) |
| Image | `custom/Dockerfile` |

Custom code is kept in its own files where possible, so upstream updates merge with few conflicts.
Changed upstream files carry a `custom:` comment.

## Scan: receipts and invoices

Take a photo (the phone's camera opens) or pick photos and PDFs. Each one is read by the scan service
(`scan/`), and the page shows what it found: payee, date, amount, description, a category guessed from
earlier payments to that payee, and the account it was paid from. Below that it lists existing
transactions with the same amount from 3 days before to 7 days after, so you can attach the file to the
payment you already have. Otherwise it creates a withdrawal tagged `receipt` and attaches the file
there.

"Possible duplicates" pairs every `receipt` transaction with a transaction of the same amount and type
within a week, for when a bank import brings in a payment you already scanned. Nothing is merged
automatically: Merge (confirmed with a second click) moves the files, category and notes onto the bank
transaction and deletes the scanned one; "Not the same" is remembered.

Settings live in the `customScan` preference, set through `POST /api/v1/preferences`:
`{"name": "customScan", "data": {"defaultAccount": "Checking"}}` picks the account new receipts are paid
from (the first asset account otherwise). The page also stores dismissed duplicate pairs there.

The scan service runs [Claude Code](https://docs.claude.com/en/docs/claude-code) in headless mode, signed
in with a Claude subscription, so reading uses that subscription's usage rather than API credits. Scans
leave your server: the image or PDF is sent to Anthropic to be read. See `scan/README.md`.

## Employer page

Payslips and mobility-budget statements live in the `customEmployer` preference:

```json
{
  "payslips": [{"year": 2026, "period": 1, "employer": "Acme B.V.", "grossSalary": 4000, "mobilityBudgetGross": 300,
                "mobilityBudgetNet": 210, "internetAllowance": 30, "expenseAllowance": 50,
                "incomeTaxWithheld": -1100, "netPay": 2900}],
  "mobility": [{"period": "2026-01", "budgetGranted": 600, "totalCosts": 80, "settlement": {"gross": 300, "net": 240}}],
  "reimbursementSenders": ["Acme"],
  "manual": {"2026-01": {"km": 120, "joint": 150}}
}
```

Business expenses are transactions tagged `business`, reimbursements are deposits whose sender or
description contains a reimbursement sender, and fuel is any category ending in "Fuel". Senders, km
driven and transfers to a joint account are edited on the page itself.

## Build and run

```sh
docker build -f custom/Dockerfile -t firefly-custom:6.7.9 .
docker build -t finance-scan scan/
```

The first image is upstream's `fireflyiii/core:version-6.7.9` with this branch's views, rebuilt assets,
icons, and the custom route and controllers. Run it exactly like upstream's image. For scanning, add the
scan service to the same compose project; `scan/README.md` has the snippet.

## Updating to a new upstream version

```sh
git fetch upstream --tags
git merge v6.x.y            # into custom
# set FIREFLY_VERSION in custom/Dockerfile to 6.x.y, rebuild, check the custom: files still apply
```

## Licence

AGPL-3.0-or-later, like Firefly III. Firefly III is © James Cole and its contributors.
