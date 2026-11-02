/*
 * import.js
 * Firefly III Custom: the Import page (resources/views/custom/import.blade.php).
 *
 * A bank statement (js/custom/statement.js: ING CSV or camt.053) is read in the browser. Each booking
 * is checked against the transactions already in Finance around its date:
 *   - "Already imported": a transaction carries the same bank fingerprint (external_id). Preset to skip.
 *   - "Possible duplicate": same amount and direction on the same account (or a scanned receipt) from
 *     7 days before to 3 days after. These have NO preset: Gaurav chooses skip, import as well, or (for
 *     a scanned receipt) import and merge the receipt into it. Import stays disabled until each is chosen.
 *   - "New": preset to import.
 * Bookings to or from another own account (by IBAN) become transfers. Imported transactions get the
 * "bank-import" tag and the fingerprint as external_id, and Firefly's rules run on them.
 */

import "../boot/bootstrap.js";
import sidebar from "../pages/shared/sidebar.js";
import dates from "../pages/shared/dates.js";
import Alpine from "@alpinejs/csp";
import { parseStatement } from "./statement.js";

const TAG = "bank-import";
const RECEIPT_TAG = "receipt";
const BEFORE = 7; // an existing entry (a scanned receipt) can be dated up to a week before the bank booking…
const AFTER = 3; // …or a few days after it
const PAGE_ROWS = 200;

const root = document.getElementById("ff-import");
const $ = (sel) => root.querySelector(sel);
let accounts = [];
let defaultAccount = null;
let lines = [];
let mapping = {}; // statement IBAN -> asset account id
let filter = "all";
let shown = PAGE_ROWS;
let busy = false;
let hidden = false;

// ---------- helpers ----------
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? "";
const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const locale = () => (window.__localeId__ || "en-US").replace("_", "-");
const money = (v, code = "EUR") => (hidden ? "•••" : new Intl.NumberFormat(locale(), { style: "currency", currency: code || "EUR" }).format(parseFloat(v) || 0));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => {
    const d = new Date(s + "T12:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
};
const dayDiff = (a, b) => Math.round((new Date(a.substring(0, 10) + "T12:00:00") - new Date(b.substring(0, 10) + "T12:00:00")) / 86400000);
const niceDate = (s) => new Date(s.substring(0, 10) + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
const txUrl = (groupId) => root.dataset.urlTransaction.replace("__ID__", encodeURIComponent(groupId));
const ibanOf = (a) => String(a.attributes.iban || a.attributes.account_number || "").replace(/\s+/g, "").toUpperCase();
const accountName = (id) => accounts.find((a) => a.id === String(id))?.attributes.name ?? "?";

async function api(method, path, body) {
    const headers = { Accept: "application/json", "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest" };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, { method, credentials: "same-origin", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || data.error || `Request failed (${res.status})`);
        err.data = data;
        throw err;
    }
    return data;
}

async function pages(path) {
    const out = [];
    for (let page = 1; ; page++) {
        const res = await api("GET", `${path}${path.includes("?") ? "&" : "?"}limit=500&page=${page}`);
        for (const group of res.data) {
            for (const split of group.attributes.transactions) {
                out.push({ ...split, group_id: group.id });
            }
        }
        if (page >= (res.meta?.pagination?.total_pages ?? 1)) {
            return out;
        }
    }
}

const words = (s) => new Set(String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w)));
function nameScore(a, b) {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) {
        return 0;
    }
    let hit = 0;
    for (const w of A) {
        if ([...B].some((x) => x.startsWith(w) || w.startsWith(x))) {
            hit++;
        }
    }
    return hit / A.size;
}

// ---------- reference data ----------
async function loadAccounts() {
    accounts = [];
    for (let page = 1; ; page++) {
        const res = await api("GET", `api/v1/accounts?type=asset&limit=100&page=${page}`);
        accounts = accounts.concat(res.data.filter((a) => a.attributes.active !== false));
        if (page >= (res.meta?.pagination?.total_pages ?? 1)) {
            break;
        }
    }
    try {
        // the Scan page's default account ("customScan" preference) is the fallback here too
        const name = (await api("GET", "api/v1/preferences/customScan")).data.attributes.data?.defaultAccount;
        defaultAccount = accounts.find((a) => a.attributes.name === name)?.id ?? null;
    } catch {
        defaultAccount = null;
    }
}

// ---------- reading the file ----------
async function readFile(file) {
    const status = $('[data-fill="file-status"]');
    status.textContent = `Reading ${file.name}…`;
    $('[data-fill="review-card"]').hidden = true;
    try {
        const buf = await file.arrayBuffer();
        let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        if (text.includes("�")) {
            text = new TextDecoder("windows-1252").decode(buf); // older ING downloads
        }
        lines = (await parseStatement(text)).map((l, i) => ({ ...l, i, status: "checking", action: null, match: null, result: null }));
        if (!lines.length) {
            throw new Error("The file has no bookings.");
        }
        const from = lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date);
        const to = lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date);
        status.textContent = `${lines.length} bookings from ${niceDate(from)} to ${niceDate(to)} in ${file.name}.`;
        mapping = {};
        for (const ib of new Set(lines.map((l) => l.account))) {
            mapping[ib] = accounts.find((a) => ib && ibanOf(a) === ib)?.id ?? defaultAccount ?? accounts[0]?.id ?? null;
        }
        renderAccounts();
        await check();
    } catch (e) {
        console.error("import: read", e);
        lines = [];
        status.textContent = e.message || "This file could not be read.";
    }
}

function renderAccounts() {
    const box = $('[data-fill="accounts"]');
    $('[data-fill="accounts-card"]').hidden = false;
    const options = (sel) => accounts.map((a) => `<option value="${esc(a.id)}"${a.id === sel ? " selected" : ""}>${esc(a.attributes.name)}</option>`).join("");
    box.innerHTML = Object.entries(mapping)
        .map(([ib, id]) => {
            const known = accounts.some((a) => ib && ibanOf(a) === ib);
            const count = lines.filter((l) => l.account === ib).length;
            return `<label class="ff-field ff-import-acct"><span>${esc(ib || "Account in the file")} · ${count} bookings${known ? "" : " · not linked to an account in Finance yet, so pick one"}</span>
                <select class="form-select" data-iban="${esc(ib)}">${options(id)}</select></label>`;
        })
        .join("");
}

// ---------- checking against Finance ----------
const typeFor = (l) => {
    const other = l.counterIban && accounts.find((a) => ibanOf(a) === l.counterIban && a.id !== String(mapping[l.account]));
    return other ? { type: "transfer", other: other.id } : { type: l.direction === "out" ? "withdrawal" : "deposit", other: null };
};

async function check() {
    $('[data-fill="review-card"]').hidden = false;
    $('[data-fill="rows"]').innerHTML = '<div class="ff-skel ff-skel-rows"></div>';
    $('[data-act="import"]').disabled = true;
    const from = addDays(lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date), -AFTER - 1);
    const to = addDays(lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date), BEFORE + 1);
    try {
        const existing = new Map();
        for (const id of new Set(Object.values(mapping))) {
            for (const s of await pages(`api/v1/accounts/${id}/transactions?start=${from}&end=${to}`)) {
                existing.set(s.transaction_journal_id, s);
            }
        }
        for (const s of await pages(`api/v1/search/transactions?query=${encodeURIComponent(`tag_is:${RECEIPT_TAG} date_after:${addDays(from, -1)} date_before:${addDays(to, 1)}`)}`)) {
            existing.set(s.transaction_journal_id, s);
        }
        const all = [...existing.values()];
        const byRef = new Map(all.filter((s) => s.external_id).map((s) => [s.external_id, s]));
        // a transaction that is exactly one of this file's lines is that line, never another line's duplicate
        const fileRefs = new Set(lines.map((l) => l.ref));
        for (const l of lines) {
            const acct = String(mapping[l.account]);
            const { type } = typeFor(l);
            l.result = null;
            const same = byRef.get(l.ref);
            if (same) {
                Object.assign(l, { status: "imported", action: "skip", match: same });
                continue;
            }
            const candidates = all
                .filter((s) => {
                    if (Math.abs(parseFloat(s.amount) - parseFloat(l.amount)) > 0.005 || fileRefs.has(s.external_id)) {
                        return false;
                    }
                    const d = dayDiff(s.date, l.date);
                    if (d < -BEFORE || d > AFTER) {
                        return false;
                    }
                    const receipt = (s.tags ?? []).includes(RECEIPT_TAG);
                    const out = l.direction === "out";
                    if (s.type === "transfer" || type === "transfer") {
                        return s.type === type && String(out ? s.source_id : s.destination_id) === acct;
                    }
                    return s.type === type && (receipt || String(out ? s.source_id : s.destination_id) === acct);
                })
                .map((s) => ({ s, score: nameScore(l.name, s.destination_name || s.source_name || s.description) * 2 - Math.abs(dayDiff(s.date, l.date)) / 7 }))
                .sort((a, b) => b.score - a.score);
            if (candidates.length) {
                Object.assign(l, { status: "dupe", action: null, match: candidates[0].s, others: candidates.length - 1 });
            } else {
                Object.assign(l, { status: "new", action: "import", match: null });
            }
        }
        shown = PAGE_ROWS;
        filter = lines.some((l) => l.status === "dupe") ? "dupe" : "all";
        render();
    } catch (e) {
        console.error("import: check", e);
        $('[data-fill="rows"]').innerHTML = '<p class="ff-empty">Your transactions could not be checked. Reload the page and try again.</p>';
    }
}

// ---------- review ----------
const LABEL = { new: "New", dupe: "Possible duplicate", imported: "Already imported", done: "Imported", failed: "Failed" };

function counts() {
    const c = { all: lines.length, new: 0, dupe: 0, imported: 0, open: 0, go: 0 };
    for (const l of lines) {
        if (l.result === "done") {
            continue;
        }
        c[l.status] = (c[l.status] ?? 0) + 1;
        if (l.status === "dupe" && !l.action) {
            c.open++;
        }
        if (l.action === "import" || l.action === "merge") {
            c.go++;
        }
    }
    return c;
}

function rowHtml(l) {
    const sign = l.direction === "out" ? "−" : "+";
    const { type, other } = typeFor(l);
    const what = type === "transfer" ? `Transfer ${l.direction === "out" ? "to" : "from"} ${esc(accountName(other))}` : esc(l.description);
    let choice = "";
    if (l.result === "done") {
        choice = `<span class="ff-import-done">Imported · <a href="${esc(txUrl(l.groupId))}">open</a>${l.merged ? " · receipt merged" : ""}</span>`;
    } else if (l.status === "dupe") {
        const m = l.match;
        const receipt = (m.tags ?? []).includes(RECEIPT_TAG);
        const opt = (v, text) => `<label class="ff-import-opt"><input type="radio" name="c${l.i}" value="${v}"${l.action === v ? " checked" : ""}> ${text}</label>`;
        choice = `<div class="ff-import-match">Already in Finance: <a href="${esc(txUrl(m.group_id))}">${esc(m.destination_name || m.description)}</a>
                <small>${esc(niceDate(m.date))} · ${esc(m.source_name)}${m.category_name ? " · " + esc(m.category_name) : ""}${receipt ? " · scanned receipt" : ""}${l.others ? ` · and ${l.others} more with this amount` : ""}</small></div>
            <div class="ff-import-opts" role="radiogroup" aria-label="What to do with this booking">
                ${opt("skip", "Skip, it is the same")}${opt("import", "Import as well")}${receipt ? opt("merge", "Import and merge the receipt into it") : ""}
            </div>`;
    } else {
        const on = l.action === "import";
        choice = `<label class="ff-import-opt"><input type="checkbox" data-toggle="${l.i}"${on ? " checked" : ""}> ${l.status === "imported" ? "Import again" : "Import"}</label>`;
    }
    return `<div class="ff-import-row" data-i="${l.i}" data-status="${l.result === "done" ? "done" : l.status}">
        <div class="ff-import-main">
            <div class="ff-import-when">${esc(niceDate(l.date))}</div>
            <div class="ff-import-who"><b>${esc(l.name)}</b><small>${what}</small></div>
            <div class="ff-import-amt" data-dir="${l.direction}">${sign}${money(l.amount, l.currency)}</div>
        </div>
        <div class="ff-import-side">
            <span class="ff-import-chip" data-status="${l.result === "done" ? "done" : l.result === "failed" ? "failed" : l.status}">${LABEL[l.result === "done" ? "done" : l.result === "failed" ? "failed" : l.status]}</span>
            ${choice}
            ${l.error ? `<span class="ff-scan-error" role="alert">${esc(l.error)}</span>` : ""}
        </div>
    </div>`;
}

function render() {
    const c = counts();
    $('[data-fill="summary"]').textContent = `${c.new} new · ${c.dupe} possible duplicates · ${c.imported} already imported`;
    const tab = (key, text, n) => `<button type="button" role="tab" class="btn btn-sm ${filter === key ? "btn-primary" : "btn-outline-secondary"}" aria-selected="${filter === key}" data-filter="${key}">${text} <span>${n}</span></button>`;
    $('[data-fill="filters"]').innerHTML = tab("all", "All", c.all) + tab("dupe", "Possible duplicates", c.dupe) + tab("new", "New", c.new) + tab("imported", "Already imported", c.imported);
    $('[data-fill="bulk"]').innerHTML = filter === "dupe" && c.dupe
        ? `<span>For all ${c.dupe} possible duplicates:</span>
           <button type="button" class="btn btn-sm btn-outline-secondary" data-bulk="skip">Skip all</button>
           <button type="button" class="btn btn-sm btn-outline-secondary" data-bulk="import">Import all as well</button>`
        : "";
    const list = lines.filter((l) => filter === "all" || (l.status === filter && l.result !== "done"));
    $('[data-fill="rows"]').innerHTML = list.length
        ? list.slice(0, shown).map(rowHtml).join("") + (list.length > shown ? `<button type="button" class="btn btn-sm btn-link" data-act="more">Show ${Math.min(PAGE_ROWS, list.length - shown)} more of ${list.length - shown}</button>` : "")
        : '<p class="ff-empty">Nothing here.</p>';
    const go = $('[data-act="import"]');
    go.disabled = busy || c.open > 0 || c.go === 0;
    go.textContent = c.go ? `Import ${c.go}` : "Import";
    if (!busy) {
        $('[data-fill="go-status"]').textContent = c.open ? `Choose what to do with ${c.open} possible duplicate${c.open === 1 ? "" : "s"} first.` : "";
    }
}

// ---------- importing ----------
function payload(l) {
    const acct = String(mapping[l.account]);
    const { type, other } = typeFor(l);
    const t = {
        type,
        date: l.date,
        amount: l.amount,
        currency_code: l.currency,
        description: l.description,
        notes: l.notes || null,
        external_id: l.ref,
        tags: [TAG],
    };
    if (type === "transfer") {
        Object.assign(t, l.direction === "out" ? { source_id: acct, destination_id: other } : { source_id: other, destination_id: acct });
    } else if (type === "withdrawal") {
        Object.assign(t, { source_id: acct, destination_name: l.name });
    } else {
        Object.assign(t, { source_name: l.name, destination_id: acct });
    }
    return { apply_rules: true, fire_webhooks: true, error_if_duplicate_hash: false, transactions: [t] };
}

/** Moves the scanned receipt's files, category and notes onto the imported booking, then removes the receipt. */
async function mergeReceipt(receipt, groupId, split) {
    const atts = await api("GET", `api/v1/transactions/${receipt.group_id}/attachments`);
    for (const a of atts.data) {
        await api("PUT", `api/v1/attachments/${a.id}`, { attachable_type: "TransactionJournal", attachable_id: String(split.transaction_journal_id) });
    }
    const update = { transaction_journal_id: String(split.transaction_journal_id) };
    if (!split.category_name && receipt.category_name) {
        update.category_name = receipt.category_name;
    }
    if (receipt.notes) {
        update.notes = [split.notes, receipt.notes].filter(Boolean).join("\n");
    }
    if (Object.keys(update).length > 1) {
        await api("PUT", `api/v1/transactions/${groupId}`, { apply_rules: false, transactions: [update] });
    }
    await api("DELETE", `api/v1/transactions/${receipt.group_id}`);
}

async function runImport() {
    const todo = lines.filter((l) => l.result !== "done" && (l.action === "import" || l.action === "merge"));
    if (!todo.length) {
        return;
    }
    busy = true;
    render();
    const status = $('[data-fill="go-status"]');
    let ok = 0, failed = 0;
    for (const [n, l] of todo.entries()) {
        status.textContent = `Importing ${n + 1} of ${todo.length}…`;
        try {
            const res = await api("POST", "api/v1/transactions", payload(l));
            l.groupId = res.data.id;
            if (l.action === "merge") {
                await mergeReceipt(l.match, res.data.id, res.data.attributes.transactions[0]);
                l.merged = true;
            }
            l.result = "done";
            l.error = null;
            ok++;
        } catch (e) {
            console.error("import: row", l, e);
            l.result = "failed";
            l.error = (e.data?.errors ? Object.values(e.data.errors).flat()[0] : null) || e.message || "This booking could not be imported.";
            failed++;
        }
    }
    busy = false;
    render();
    status.textContent = `Imported ${ok}${failed ? `; ${failed} failed (shown with the reason)` : ""}.`;
}

// ---------- events ----------
function bind() {
    const input = root.querySelector('[data-input="file"]');
    input.addEventListener("change", () => {
        if (input.files[0]) {
            readFile(input.files[0]);
        }
        input.value = "";
    });
    const drop = $(".ff-scan-start");
    drop.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        drop.classList.add("ff-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("ff-dragging"));
    drop.addEventListener("drop", (ev) => {
        ev.preventDefault();
        drop.classList.remove("ff-dragging");
        if (ev.dataTransfer.files[0]) {
            readFile(ev.dataTransfer.files[0]);
        }
    });
    $('[data-fill="accounts"]').addEventListener("change", (ev) => {
        const sel = ev.target.closest("select[data-iban]");
        if (sel && !busy) {
            mapping[sel.dataset.iban] = sel.value;
            check();
        }
    });
    root.addEventListener("click", (ev) => {
        const t = ev.target.closest("[data-filter],[data-bulk],[data-act]");
        if (!t || busy) {
            return;
        }
        if (t.dataset.filter) {
            filter = t.dataset.filter;
            shown = PAGE_ROWS;
        } else if (t.dataset.bulk) {
            lines.filter((l) => l.status === "dupe" && l.result !== "done").forEach((l) => (l.action = t.dataset.bulk));
        } else if (t.dataset.act === "more") {
            shown += PAGE_ROWS;
        } else if (t.dataset.act === "import") {
            runImport();
            return;
        } else {
            return;
        }
        render();
    });
    $('[data-fill="rows"]').addEventListener("change", (ev) => {
        if (busy) {
            return;
        }
        const row = ev.target.closest("[data-i]");
        const l = row && lines[parseInt(row.dataset.i)];
        if (!l) {
            return;
        }
        if (ev.target.type === "radio") {
            l.action = ev.target.value;
        } else if (ev.target.dataset.toggle !== undefined) {
            l.action = ev.target.checked ? "import" : "skip";
        }
        render();
    });
}

async function run0() {
    hidden = true === window.store.get("anonymous");
    bind();
    try {
        await loadAccounts();
    } catch (e) {
        console.error("import: setup", e);
        $('[data-fill="file-status"]').textContent = "Your accounts could not be loaded. Reload the page.";
    }
}

function start() {
    Alpine.data("sidebar", () => sidebar());
    Alpine.data("dates", () => dates());
    Alpine.start();
    run0();
}

if (window.bootstrapped) {
    start();
} else {
    document.addEventListener("firefly-iii-bootstrapped", start, { once: true });
}
