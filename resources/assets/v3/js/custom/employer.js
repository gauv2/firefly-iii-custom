/*
 * employer.js
 * Firefly III Custom: the Employer page (resources/views/custom/employer.blade.php).
 *
 * Payslips, mobility statements, reimbursement senders and the figures typed in here live in one user
 * preference, "customEmployer" (written through the v1 preferences API). Business expenses,
 * reimbursements and fuel come from Firefly's own transactions through the search API.
 */

import "../boot/bootstrap.js";
import sidebar from "../pages/shared/sidebar.js";
import dates from "../pages/shared/dates.js";
import Alpine from "@alpinejs/csp";
import axios from "axios";

const PREF = "customEmployer";
const KM_RATE = 0.26;
const BUSINESS_TAG = "business";
const FUEL = /(^|:\s*)(fuel|brandstof)$/i;

const root = document.getElementById("ff-employer");
let hidden = false;
let data = null;
let tx = { business: [], reimbursed: [], fuel: [] };
let since = "";

// ---------- helpers ----------
const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};
const locale = () => (window.__localeId__ || "en-US").replace("_", "-");

function money(amount) {
    if (hidden) {
        return '<span class="ff-hidden-amount" aria-label="Amount hidden">•••</span>';
    }
    const n = num(amount);
    const text = new Intl.NumberFormat(locale(), { style: "currency", currency: "EUR" }).format(Math.abs(n));
    return n < 0 ? "−" + text : text;
}

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonth = (key, by) => {
    const [y, m] = key.split("-").map(Number);
    return monthKey(new Date(y, m - 1 + by, 1));
};
const monthName = (key, style = "short") => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: style, year: "numeric" });
};
const slipKey = (p) => `${p.year}-${pad(p.period)}`;

const fill = (key, html) => {
    const el = root.querySelector(`[data-fill="${key}"]`);
    if (el) {
        el.innerHTML = html;
    }
    return el;
};
const part = (key) => root.querySelector(`[data-part="${key}"]`);
const empty = (text) => `<p class="ff-empty">${esc(text)}</p>`;
const failed = () => '<p class="ff-empty">This could not be loaded. Reload the page to try again.</p>';
const status = (key, text) => {
    const el = fill(key, esc(text));
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.textContent = ""), 4000);
};

// ---------- data ----------
async function loadPreference() {
    try {
        const res = await axios.get(`api/v1/preferences/${PREF}`);
        const d = res.data.data.attributes.data;
        return d && typeof d === "object" && !Array.isArray(d) ? d : {};
    } catch (e) {
        if (e.response?.status === 404) {
            return {};
        }
        throw e;
    }
}

function normalise(d) {
    return {
        version: 1,
        payslips: Array.isArray(d.payslips) ? [...d.payslips].sort((a, b) => a.year - b.year || a.period - b.period) : [],
        mobility: Array.isArray(d.mobility) ? [...d.mobility].sort((a, b) => b.period.localeCompare(a.period)) : [],
        reimbursementSenders: Array.isArray(d.reimbursementSenders) ? d.reimbursementSenders : [],
        manual: d.manual && typeof d.manual === "object" && !Array.isArray(d.manual) ? d.manual : {},
    };
}

async function save() {
    await axios.post("api/v1/preferences", { name: PREF, data });
}

const quote = (s) => `"${String(s).replace(/"/g, "")}"`;

// every split matching a search query, dated from `since`
async function search(query) {
    let page = 1;
    const out = [];
    for (;;) {
        const res = await axios.get("api/v1/search/transactions", { params: { query: `${query} date_after:${since}-01`, page, limit: 100 } });
        for (const group of res.data.data) {
            for (const split of group.attributes.transactions) {
                if (split.date.substring(0, 7) >= since) {
                    out.push({ ...split, group_id: group.id });
                }
            }
        }
        if (page >= parseInt(res.data.meta?.pagination?.total_pages ?? 1)) {
            return out;
        }
        page++;
    }
}

const unique = (splits) => [...new Map(splits.map((s) => [s.transaction_journal_id, s])).values()];

// spending is positive, a refund (a deposit) counts against it
const spend = (s) => (s.type === "deposit" ? -1 : 1) * Math.abs(num(s.amount));

function byMonth(splits, value) {
    const out = new Map();
    for (const s of splits) {
        const m = s.date.substring(0, 7);
        out.set(m, (out.get(m) ?? 0) + value(s));
    }
    return out;
}

async function loadBusiness() {
    tx.business = unique(await search(`tag_is:${quote(BUSINESS_TAG)}`));
}

async function loadReimbursements() {
    const found = [];
    for (const sender of data.reimbursementSenders) {
        found.push(...(await search(`type:deposit source_account_contains:${quote(sender)}`)));
        found.push(...(await search(`type:deposit description_contains:${quote(sender)}`)));
    }
    tx.reimbursed = unique(found);
}

async function loadFuel() {
    const found = [...(await search("category_ends:fuel")), ...(await search("category_ends:brandstof"))];
    tx.fuel = unique(found).filter((s) => FUEL.test((s.category_name ?? "").trim()) && s.type !== "transfer");
}

// ---------- salary trend ----------
function renderSalary() {
    const slips = data.payslips;
    if (slips.length === 0) {
        part("salary").hidden = true;
        return;
    }
    part("salary").hidden = false;
    fill("salary-note", `${slips.length} ${slips.length === 1 ? "payslip" : "payslips"} · ${esc(slips[slips.length - 1].employer.replace(/^[A-Z]{3} - /, ""))}`);
    const rows = [
        ["Gross salary", (p) => money(p.grossSalary)],
        ["Mobility budget (gross, taxed)", (p) => money(p.mobilityBudgetGross)],
        ["Mobility budget (net, tax-free)", (p) => (p.mobilityBudgetNet === null || p.mobilityBudgetNet === undefined ? '<span class="ff-muted">paid as salary</span>' : money(p.mobilityBudgetNet))],
        ["Internet allowance", (p) => money(p.internetAllowance)],
        ["Expense allowance", (p) => money(p.expenseAllowance)],
        ["Income tax withheld", (p) => money(Math.abs(num(p.incomeTaxWithheld)))],
        ["Net pay", (p) => money(p.netPay), true],
    ];
    const head = slips.map((p) => `<th scope="col" class="ff-num">${esc(monthName(slipKey(p)))}</th>`).join("");
    const body = rows
        .map(([label, cell, strong]) => `<tr${strong ? ' class="ff-strong"' : ""}><th scope="row">${esc(label)}</th>${slips.map((p) => `<td class="ff-num">${cell(p)}</td>`).join("")}</tr>`)
        .join("");
    fill(
        "salary",
        `<div class="ff-table-scroll" tabindex="0" role="region" aria-labelledby="ff-h-salary">
            <table class="table ff-employer-table ff-sticky-first"><thead><tr><th scope="col">Payslip</th>${head}</tr></thead><tbody>${body}</tbody></table>
        </div>`,
    );
    // newest payslip in view
    const scroll = root.querySelector('[data-fill="salary"] .ff-table-scroll');
    scroll.scrollLeft = scroll.scrollWidth;
}

// ---------- expensing ----------
function renderExpensing() {
    const expenses = byMonth(tx.business.filter((s) => !isReimbursement(s)), spend);
    const reimbursed = byMonth(tx.reimbursed, (s) => Math.abs(num(s.amount)));
    const months = [...new Set([...expenses.keys(), ...reimbursed.keys()])].sort((a, b) => b.localeCompare(a));
    fill("expensing-note", `Since ${esc(monthName(since, "long"))}`);
    if (months.length === 0) {
        fill(
            "expensing",
            empty(`Nothing yet. Tag a transaction “${BUSINESS_TAG}” to count it as a business expense; a payment in from a sender listed below counts as a reimbursement.`),
        );
        return;
    }
    let te = 0, tr = 0;
    const body = months
        .map((m) => {
            const e = expenses.get(m) ?? 0, r = reimbursed.get(m) ?? 0;
            te += e;
            tr += r;
            return `<tr><th scope="row">${esc(monthName(m, "long"))}</th>
                <td class="ff-num">${searchLink(`tag_is:${quote(BUSINESS_TAG)} date_after:${m}-01 date_before:${shiftMonth(m, 1)}-01`, money(e), e)}</td>
                <td class="ff-num">${money(r)}</td>
                <td class="ff-num ${r - e < 0 ? "ff-neg" : r - e > 0 ? "ff-pos" : ""}">${money(r - e)}</td></tr>`;
        })
        .join("");
    fill(
        "expensing",
        `<div class="ff-table-scroll" tabindex="0" role="region" aria-label="Business expenses vs. reimbursements">
            <table class="table ff-employer-table">
                <thead><tr><th scope="col">Month</th><th scope="col" class="ff-num">Business expenses</th><th scope="col" class="ff-num">Reimbursements</th><th scope="col" class="ff-num">Net</th></tr></thead>
                <tbody>${body}</tbody>
                <tfoot><tr class="ff-strong"><th scope="row">Total</th><td class="ff-num">${money(te)}</td><td class="ff-num">${money(tr)}</td><td class="ff-num ${tr - te < 0 ? "ff-neg" : tr - te > 0 ? "ff-pos" : ""}">${money(tr - te)}</td></tr></tfoot>
            </table>
        </div>`,
    );
}

const isReimbursement = (s) => tx.reimbursed.some((r) => r.transaction_journal_id === s.transaction_journal_id);

function searchLink(query, html, value) {
    if (!value) {
        return html;
    }
    return `<a href="${esc(root.dataset.urlSearch)}?search=${encodeURIComponent(query)}">${html}</a>`;
}

function renderSenders() {
    const senders = data.reimbursementSenders;
    fill(
        "senders",
        senders.length === 0
            ? '<li class="ff-muted">None yet: every payment from your employer counts as income.</li>'
            : senders
                  .map(
                      (s, i) => `<li class="ff-chip"><span>${esc(s)}</span>
                        <button type="button" class="ff-chip-x" data-remove="${i}" aria-label="Remove ${esc(s)}" title="Stop counting payments from ${esc(s)} as reimbursements"><em class="bi bi-x" aria-hidden="true"></em></button></li>`,
                  )
                  .join(""),
    );
}

async function changeSenders(next, message) {
    const before = data.reimbursementSenders;
    data.reimbursementSenders = next;
    renderSenders();
    try {
        await save();
        status("senders-status", message);
    } catch (e) {
        console.error("employer: save senders", e);
        data.reimbursementSenders = before;
        renderSenders();
        status("senders-status", "That could not be saved. Try again.");
        return;
    }
    fill("expensing", '<div class="ff-skel ff-skel-rows"></div>');
    try {
        await loadReimbursements();
        renderExpensing();
    } catch (e) {
        console.error("employer: reimbursements", e);
        fill("expensing", failed());
    }
}

function bindSenders() {
    root.querySelector('[data-fill="senders"]').addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-remove]");
        if (!btn) {
            return;
        }
        const i = parseInt(btn.dataset.remove);
        const name = data.reimbursementSenders[i];
        changeSenders(data.reimbursementSenders.filter((_, k) => k !== i), `Removed ${name}.`);
        root.querySelector("#ff-sender-input").focus();
    });
    root.querySelector('[data-form="sender"]').addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = root.querySelector("#ff-sender-input");
        const value = input.value.trim();
        if (!value) {
            return;
        }
        if (data.reimbursementSenders.some((s) => s.toLowerCase() === value.toLowerCase())) {
            status("senders-status", `${value} is already on the list.`);
            return;
        }
        input.value = "";
        changeSenders([...data.reimbursementSenders, value], `Added ${value}.`);
    });
}

// ---------- mobility ----------
function paidOut(statement) {
    if (statement.settlement && statement.settlement.net !== undefined && statement.settlement.net !== null) {
        return { amount: num(statement.settlement.net), from: "statement" };
    }
    // the statement for month M pays out on the payslip for month M + 1
    const payout = shiftMonth(statement.period, 1);
    const slip = data.payslips.find((p) => slipKey(p) === payout);
    if (slip && slip.mobilityBudgetNet !== null && slip.mobilityBudgetNet !== undefined) {
        return { amount: num(slip.mobilityBudgetNet), from: "payslip" };
    }
    return { amount: null, payout };
}

function renderMobility() {
    const statements = data.mobility;
    if (statements.length === 0) {
        part("mobility").hidden = true;
        return;
    }
    part("mobility").hidden = false;
    const fuel = byMonth(tx.fuel, spend);
    const body = statements
        .map((st) => {
            const m = st.period;
            const manual = data.manual[m] ?? {};
            const paid = paidOut(st);
            const spent = Math.max(0, fuel.get(m) ?? 0);
            const paidCell =
                paid.amount === null
                    ? `<span class="ff-muted">On the ${esc(monthName(paid.payout, "long"))} payslip</span>`
                    : money(paid.amount) + (paid.from === "payslip" ? `<span class="ff-muted ff-note-line">from the ${esc(monthName(shiftMonth(m, 1)))} payslip</span>` : "");
            let fuelCell;
            if (spent <= 0) {
                fuelCell = '<span class="ff-muted">No fuel spend</span>';
            } else if (paid.amount === null) {
                fuelCell = `<span class="ff-muted">? of</span> ${money(spent)}`;
            } else {
                fuelCell = `${money(Math.min(spent, paid.amount))} <span class="ff-muted">of</span> ${money(spent)}`;
            }
            const km = manual.km ?? "";
            const joint = manual.joint ?? "";
            const label = monthName(m, "long");
            return `<tr data-month="${esc(m)}"><th scope="row">${esc(label)}</th>
                <td class="ff-num">${paidCell}</td>
                <td class="ff-num">${fuelCell}</td>
                <td class="ff-num"><input type="number" class="form-control ff-cell-input" data-field="km" min="0" step="1" inputmode="numeric" value="${esc(km)}" placeholder="0" aria-label="Km driven in ${esc(label)}"></td>
                <td class="ff-num" data-fill="reimbursed-${esc(m)}">${money(num(km) * KM_RATE)}</td>
                <td class="ff-num"><input type="number" class="form-control ff-cell-input" data-field="joint" min="0" step="0.01" inputmode="decimal" value="${esc(joint)}" placeholder="0.00" aria-label="Transfer to joint account in ${esc(label)}, in euro"></td></tr>`;
        })
        .join("");
    fill(
        "mobility",
        `<div class="ff-table-scroll" tabindex="0" role="region" aria-labelledby="ff-h-mobility">
            <table class="table ff-employer-table ff-sticky-first">
                <thead><tr><th scope="col">Month</th><th scope="col" class="ff-num">Paid out (tax-free)</th><th scope="col" class="ff-num">Fuel covered</th><th scope="col" class="ff-num">Km driven</th><th scope="col" class="ff-num">Reimbursed</th><th scope="col" class="ff-num">Transfer to joint account</th></tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`,
    );
}

function bindMobility() {
    const box = root.querySelector('[data-fill="mobility"]');
    box.addEventListener("input", (ev) => {
        const input = ev.target.closest('[data-field="km"]');
        if (input) {
            const m = input.closest("tr").dataset.month;
            fill(`reimbursed-${m}`, money(Math.max(0, num(input.value)) * KM_RATE));
        }
    });
    box.addEventListener("change", async (ev) => {
        const input = ev.target.closest("[data-field]");
        if (!input) {
            return;
        }
        const m = input.closest("tr").dataset.month;
        const field = input.dataset.field;
        const raw = input.value.trim();
        const value = raw === "" ? null : Math.max(0, field === "km" ? Math.round(num(raw)) : Math.round(num(raw) * 100) / 100);
        const before = data.manual[m] ? { ...data.manual[m] } : undefined;
        const next = { km: null, joint: null, ...(data.manual[m] ?? {}), [field]: value };
        if (next.km === null && next.joint === null) {
            delete data.manual[m];
        } else {
            data.manual[m] = next;
        }
        try {
            await save();
            status("mobility-status", `Saved ${field === "km" ? "km driven" : "transfer to joint account"} for ${monthName(m, "long")}.`);
        } catch (e) {
            console.error("employer: save mobility", e);
            if (before) {
                data.manual[m] = before;
            } else {
                delete data.manual[m];
            }
            status("mobility-status", "That could not be saved. Try again.");
        }
    });
}

// ---------- boot ----------
async function run() {
    hidden = true === window.store.get("anonymous");
    try {
        data = normalise(await loadPreference());
    } catch (e) {
        console.error("employer: preference", e);
        fill("salary", failed());
        fill("expensing", failed());
        return;
    }
    // everything is counted from the first payslip's month, or the last 12 months without payslips
    since = data.payslips.length > 0 ? slipKey(data.payslips[0]) : shiftMonth(monthKey(new Date()), -11);
    if (data.mobility.length > 0 && data.mobility[data.mobility.length - 1].period < since) {
        since = data.mobility[data.mobility.length - 1].period;
    }

    if (data.payslips.length === 0 && data.mobility.length === 0) {
        const el = fill(
            "empty",
            `<section class="card"><div class="ff-card-b ff-employer-empty"><h2>No employer documents yet</h2>
            <p>Payslips and mobility statements are stored in the <code>customEmployer</code> preference through the API (see custom/README.md). Business expenses and reimbursements below work without them.</p></div></section>`,
        );
        el.hidden = false;
    }
    renderSalary();
    renderSenders();
    bindSenders();
    bindMobility();

    const guard = (key, fn) =>
        fn().catch((e) => {
            console.error("employer: " + key, e);
            return e;
        });
    const [bErr, rErr] = await Promise.all([guard("business", loadBusiness), guard("reimbursements", loadReimbursements)]);
    if (bErr || rErr) {
        fill("expensing", failed());
    } else {
        renderExpensing();
    }
    if (data.mobility.length > 0) {
        const fErr = await guard("fuel", loadFuel);
        if (fErr) {
            part("mobility").hidden = false;
            fill("mobility", failed());
        } else {
            renderMobility();
        }
    }
}

function start() {
    Alpine.data("sidebar", () => sidebar());
    Alpine.data("dates", () => dates());
    Alpine.start();
    run();
}

if (window.bootstrapped) {
    start();
} else {
    document.addEventListener("firefly-iii-bootstrapped", start, { once: true });
}
