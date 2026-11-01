/*
 * scan.js
 * Firefly III Custom: the Scan page (resources/views/custom/scan.blade.php).
 *
 * Each photo or PDF is sent to ScanController@extract, which has it read by the scan service
 * (Claude Code on the Claude subscription). The fields come back for review, next to the existing
 * transactions with the same amount around that date. Saving attaches the file to the chosen
 * transaction, or creates a withdrawal tagged "receipt" and attaches it there.
 *
 * "Possible duplicates" pairs each "receipt" transaction with a bank transaction of the same amount
 * within a few days. Nothing is merged without a click: merging moves the attachments, category and
 * notes onto the bank transaction and deletes the scanned one. Dismissed pairs are remembered in the
 * "customScan" preference.
 */

import "../boot/bootstrap.js";
import sidebar from "../pages/shared/sidebar.js";
import dates from "../pages/shared/dates.js";
import Alpine from "@alpinejs/csp";

const TAG = "receipt";
const PREF = "customScan";
const MATCH_DAYS_BEFORE = 3; // a bank booking can be dated a little before the receipt…
const MATCH_DAYS_AFTER = 7; // …and card payments often settle days later
const DUPE_LOOKBACK_DAYS = 120;

const root = document.getElementById("ff-scan");
let accounts = [];
let prefs = { dismissed: [] };
let hidden = false;
let ready = Promise.resolve();

// ---------- helpers ----------
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? "";
const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};
const locale = () => (window.__localeId__ || "en-US").replace("_", "-");
const money = (v, code = "EUR") =>
    hidden ? "•••" : new Intl.NumberFormat(locale(), { style: "currency", currency: code || "EUR" }).format(num(v));
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
const quote = (s) => `"${String(s).replace(/"/g, "")}"`;

async function api(method, path, body, raw) {
    const headers = { Accept: "application/json", "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest" };
    if (raw) {
        headers["Content-Type"] = "application/octet-stream";
    } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, { method, credentials: "same-origin", headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || data.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

async function search(query, max = 200) {
    let page = 1;
    const out = [];
    for (;;) {
        const res = await api("GET", `api/v1/search/transactions?query=${encodeURIComponent(query)}&limit=100&page=${page}`);
        for (const group of res.data) {
            for (const split of group.attributes.transactions) {
                out.push({ ...split, group_id: group.id });
            }
        }
        if (out.length >= max || page >= (res.meta?.pagination?.total_pages ?? 1)) {
            return out;
        }
        page++;
    }
}

const words = (s) =>
    new Set(
        String(s ?? "")
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^\p{L}\p{N} ]/gu, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !/^\d+$/.test(w)),
    );
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
    let page = 1;
    accounts = [];
    for (;;) {
        const res = await api("GET", `api/v1/accounts?type=asset&limit=100&page=${page}`);
        accounts = accounts.concat(res.data.filter((a) => a.attributes.active !== false));
        if (page >= (res.meta?.pagination?.total_pages ?? 1)) {
            break;
        }
        page++;
    }
}

async function loadCategories() {
    const res = await api("GET", "api/v1/categories?limit=200");
    root.querySelector("#ff-scan-categories").innerHTML = res.data.map((c) => `<option value="${esc(c.attributes.name)}">`).join("");
}

async function loadPrefs() {
    try {
        const res = await api("GET", `api/v1/preferences/${PREF}`);
        const d = res.data.attributes.data;
        prefs = { dismissed: Array.isArray(d?.dismissed) ? d.dismissed : [] };
    } catch (e) {
        if (e.status !== 404) {
            throw e;
        }
    }
}

const savePrefs = () => api("POST", "api/v1/preferences", { name: PREF, data: prefs });

// ---------- files ----------
// Photos are scaled down before upload: a phone photo is often 4–8 MB, and 2000 px is plenty to read.
async function prepare(file) {
    if (file.type === "application/pdf") {
        return { blob: file, type: "application/pdf", name: file.name || "document.pdf" };
    }
    if (!file.type.startsWith("image/")) {
        throw new Error("Only photos and PDFs can be read.");
    }
    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        throw new Error("This photo format cannot be opened here. Try a JPEG or PNG.");
    }
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return { blob, type: "image/jpeg", name: `${base}.jpg` };
}

async function extract(doc) {
    const form = new FormData();
    form.append("file", new File([doc.blob], doc.name, { type: doc.type }));
    const res = await fetch(root.dataset.urlExtract, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest" },
        body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        throw new Error(data.error || `Reading failed (${res.status}).`);
    }
    return data.data;
}

// ---------- one document ----------
let counter = 0;

function addItem(file) {
    const id = `ff-scan-${++counter}`;
    const node = root.querySelector("#ff-scan-item").content.firstElementChild.cloneNode(true);
    node.id = id;
    const slot = (k) => node.querySelector(`[data-slot="${k}"]`);
    const state = (text, kind = "") => {
        slot("state").textContent = text;
        slot("state").dataset.kind = kind;
    };
    slot("name").textContent = file.name || "Photo";
    root.querySelector('[data-fill="list"]').prepend(node);
    const item = { node, slot, state, file, doc: null, data: null, matches: [], done: false };

    node.querySelector('[data-act="remove"]').addEventListener("click", () => {
        if (item.thumbUrl) {
            URL.revokeObjectURL(item.thumbUrl);
        }
        node.remove();
    });
    run(item);
    return item;
}

async function run(item) {
    const { slot, state } = item;
    try {
        state("Preparing…");
        await ready;
        item.doc = await prepare(item.file);
        if (item.doc.type.startsWith("image/")) {
            item.thumbUrl = URL.createObjectURL(item.doc.blob);
            slot("thumb").innerHTML = `<img src="${item.thumbUrl}" alt="">`;
        } else {
            slot("thumb").innerHTML = '<em class="bi bi-file-earmark-pdf" aria-hidden="true"></em>';
        }
        state("Reading… this takes about ten seconds.", "busy");
        [item.data] = await Promise.all([extract(item.doc), ready]);
    } catch (e) {
        console.error("scan: read", e);
        state(e.message || "This could not be read.", "error");
        showForm(item, {});
        return;
    }
    const d = item.data;
    const bits = [d.document_type === "invoice" ? "Invoice" : d.document_type === "receipt" ? "Receipt" : "Document"];
    if (d.confidence && d.confidence !== "high") {
        bits.push(`read with ${d.confidence} confidence, check the fields`);
    }
    state(bits.join(", ") + (d.problems && d.confidence !== "high" ? `. ${d.problems}` : "."), d.confidence === "low" ? "warn" : "");
    showForm(item, d);
}

function notesFrom(d) {
    const lines = [];
    if (d.document_type === "invoice" && d.invoice_number) {
        lines.push(`Invoice ${d.invoice_number}`);
    }
    if (d.due_date) {
        lines.push(`Due ${d.due_date}`);
    }
    if (d.vat_total !== null && d.vat_total !== undefined) {
        lines.push(`VAT ${Number(d.vat_total).toFixed(2)}`);
    }
    if (Array.isArray(d.line_items) && d.line_items.length > 0 && d.line_items.length <= 12) {
        lines.push(d.line_items.map((l) => `${l.description}${l.amount !== null && l.amount !== undefined ? " " + Number(l.amount).toFixed(2) : ""}`).join("; "));
    }
    return lines.join("\n");
}

function showForm(item, d) {
    const form = item.slot("form");
    const f = (n) => form.elements[n];
    f("payee").value = d.merchant ?? "";
    f("date").value = d.date ?? iso(new Date());
    f("amount").value = d.total ?? "";
    f("description").value = d.description || d.merchant || "";
    f("notes").value = notesFrom(d);
    item.currency = d.currency || "EUR";

    const def = root.dataset.defaultAccount.toLowerCase();
    const preferred = accounts.find((a) => a.attributes.name.toLowerCase() === def) ?? accounts[0];
    f("account").innerHTML = accounts
        .map((a) => `<option value="${esc(a.id)}"${a === preferred ? " selected" : ""}>${esc(a.attributes.name)}</option>`)
        .join("");
    form.hidden = false;

    let timer;
    const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => findMatches(item), 400);
    };
    ["amount", "date", "payee"].forEach((n) => f(n).addEventListener("input", refresh));
    form.addEventListener("change", (ev) => {
        if (ev.target.name === "match") {
            updateSubmit(item);
        }
    });
    form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        save(item);
    });
    findMatches(item);
    suggestCategory(item);
}

async function suggestCategory(item) {
    const payee = item.slot("form").elements.payee.value.trim();
    const input = item.slot("form").elements.category;
    if (!payee || input.value) {
        return;
    }
    try {
        const past = await search(`destination_account_contains:${quote(payee)} type:withdrawal`, 30);
        const counts = new Map();
        for (const s of past) {
            if (s.category_name) {
                counts.set(s.category_name, (counts.get(s.category_name) ?? 0) + 1);
            }
        }
        const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && !input.value) {
            input.value = best[0];
        }
    } catch (e) {
        console.error("scan: category", e);
    }
}

async function findMatches(item) {
    const form = item.slot("form");
    const box = item.slot("matches");
    const amount = num(form.elements.amount.value);
    const date = form.elements.date.value;
    const payee = form.elements.payee.value;
    if (!amount || !date) {
        item.matches = [];
        renderMatches(item);
        return;
    }
    box.innerHTML = '<p class="ff-muted">Looking for this payment in your transactions…</p>';
    try {
        const found = await search(`amount_is:${amount.toFixed(2)} date_after:${addDays(date, -MATCH_DAYS_BEFORE - 1)} date_before:${addDays(date, MATCH_DAYS_AFTER + 1)}`, 50);
        item.matches = found
            .filter((s) => Math.abs(num(s.amount) - amount) < 0.005)
            .filter((s) => {
                const diff = dayDiff(s.date, date);
                return diff >= -MATCH_DAYS_BEFORE && diff <= MATCH_DAYS_AFTER;
            })
            .map((s) => ({ ...s, score: nameScore(payee, `${s.destination_name} ${s.description}`) * 2 - Math.abs(dayDiff(s.date, date)) * 0.1 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    } catch (e) {
        console.error("scan: matches", e);
        item.matches = [];
    }
    renderMatches(item);
}

function renderMatches(item) {
    const box = item.slot("matches");
    const options = item.matches.map((s, i) => {
        const other = s.type === "deposit" ? s.source_name : s.destination_name;
        const from = s.type === "deposit" ? s.destination_name : s.source_name;
        const attached = s.has_attachments ? ' · <em class="bi bi-paperclip" aria-hidden="true"></em> has a file' : "";
        const scanned = (s.tags ?? []).includes(TAG) ? " · scanned" : "";
        return `<label class="ff-match">
            <input type="radio" name="match" value="${i}"${i === 0 ? " checked" : ""}>
            <span><b>${esc(other || s.description)}</b>
            <small>${esc(niceDate(s.date))} · ${esc(from)} · ${esc(s.description)}${attached}${scanned}</small></span>
            <span class="ff-match-amt">${money(s.amount, s.currency_code)}</span>
        </label>`;
    });
    const lead = item.matches.length
        ? `<p class="ff-scan-found">We already have ${item.matches.length === 1 ? "a transaction" : "transactions"} with this amount around this date. Attach the file to ${item.matches.length === 1 ? "it" : "one of them"}, or create a new one.</p>`
        : '<p class="ff-muted">No transaction with this amount around this date yet.</p>';
    box.innerHTML =
        lead +
        options.join("") +
        `<label class="ff-match"><input type="radio" name="match" value="new"${item.matches.length ? "" : " checked"}>
            <span><b>Create a new transaction</b><small>A withdrawal tagged “${TAG}”, with this file attached</small></span></label>`;
    updateSubmit(item);
}

function updateSubmit(item) {
    const choice = item.slot("form").querySelector('input[name="match"]:checked')?.value ?? "new";
    item.slot("submit").textContent = choice === "new" ? "Create transaction and attach" : "Attach to this transaction";
    // the fields only matter for a new transaction
    for (const n of ["payee", "description", "category", "account"]) {
        item.slot("form").elements[n].disabled = choice !== "new";
    }
}

async function attach(doc, journalId, title) {
    const meta = await api("POST", "api/v1/attachments", {
        filename: doc.name,
        attachable_type: "TransactionJournal",
        attachable_id: String(journalId),
        title,
    });
    await api("POST", `api/v1/attachments/${meta.data.id}/upload`, undefined, doc.blob);
}

async function save(item) {
    const form = item.slot("form");
    const f = (n) => form.elements[n];
    const err = item.slot("error");
    const btn = item.slot("submit");
    err.textContent = "";
    if (!item.doc) {
        err.textContent = "There is no file to attach.";
        return;
    }
    const choice = form.querySelector('input[name="match"]:checked')?.value ?? "new";
    const title = [f("payee").value.trim(), f("date").value].filter(Boolean).join(" ");
    btn.disabled = true;
    try {
        let groupId, journalId;
        if (choice === "new") {
            if (!form.reportValidity()) {
                btn.disabled = false;
                return;
            }
            const res = await api("POST", "api/v1/transactions", {
                apply_rules: true,
                fire_webhooks: true,
                error_if_duplicate_hash: false,
                transactions: [
                    {
                        type: "withdrawal",
                        date: f("date").value,
                        amount: num(f("amount").value).toFixed(2),
                        currency_code: item.currency,
                        description: f("description").value.trim(),
                        source_id: f("account").value,
                        destination_name: f("payee").value.trim(),
                        category_name: f("category").value.trim() || null,
                        notes: f("notes").value.trim() || null,
                        tags: [TAG],
                    },
                ],
            });
            groupId = res.data.id;
            journalId = res.data.attributes.transactions[0].transaction_journal_id;
        } else {
            const m = item.matches[parseInt(choice)];
            groupId = m.group_id;
            journalId = m.transaction_journal_id;
            const extra = f("notes").value.trim();
            if (extra && !(m.notes ?? "").includes(extra)) {
                await api("PUT", `api/v1/transactions/${groupId}`, {
                    apply_rules: false,
                    transactions: [{ transaction_journal_id: String(journalId), notes: [m.notes, extra].filter(Boolean).join("\n") }],
                });
            }
        }
        await attach(item.doc, journalId, title || item.doc.name);
        item.done = true;
        form.hidden = true;
        item.state("", "");
        item.slot("state").innerHTML = `${choice === "new" ? "Created and attached." : "Attached."} <a href="${esc(txUrl(groupId))}">Open the transaction</a>`;
        item.slot("state").dataset.kind = "done";
        if (choice === "new") {
            loadDupes();
        }
    } catch (e) {
        console.error("scan: save", e);
        err.textContent = (e.data?.errors ? Object.values(e.data.errors).flat()[0] : null) || e.message || "That could not be saved.";
    } finally {
        btn.disabled = false;
    }
}

// ---------- possible duplicates ----------
const pairKey = (r, b) => `${r.transaction_journal_id}:${b.transaction_journal_id}`;
let dupes = [];

async function loadDupes() {
    const box = root.querySelector('[data-fill="dupes"]');
    try {
        const since = addDays(iso(new Date()), -DUPE_LOOKBACK_DAYS);
        const scanned = (await search(`tag_is:${TAG} date_after:${since}`, 300)).filter((s) => (s.tags ?? []).includes(TAG));
        dupes = [];
        for (const r of scanned) {
            const twins = (await search(`amount_is:${num(r.amount).toFixed(2)} date_after:${addDays(r.date.substring(0, 10), -MATCH_DAYS_AFTER - 1)} date_before:${addDays(r.date.substring(0, 10), MATCH_DAYS_AFTER + 1)}`, 30)).filter(
                (b) =>
                    b.transaction_journal_id !== r.transaction_journal_id &&
                    !(b.tags ?? []).includes(TAG) &&
                    b.type === r.type &&
                    Math.abs(num(b.amount) - num(r.amount)) < 0.005 &&
                    Math.abs(dayDiff(b.date, r.date)) <= MATCH_DAYS_AFTER &&
                    !prefs.dismissed.includes(pairKey(r, b)),
            );
            for (const b of twins) {
                dupes.push({ r, b });
            }
        }
        renderDupes();
    } catch (e) {
        console.error("scan: duplicates", e);
        box.innerHTML = '<p class="ff-empty">This could not be loaded. Reload the page to try again.</p>';
    }
}

function renderDupes() {
    const box = root.querySelector('[data-fill="dupes"]');
    if (dupes.length === 0) {
        box.innerHTML = '<p class="ff-empty">Nothing to review. When a bank import brings in a payment you already scanned, the pair shows up here.</p>';
        return;
    }
    const side = (s, label) => `<div class="ff-dupe-side"><span class="ff-dupe-label">${label}</span>
        <a href="${esc(txUrl(s.group_id))}"><b>${esc(s.destination_name || s.description)}</b></a>
        <small>${esc(niceDate(s.date))} · ${esc(s.source_name)} · ${esc(s.description)}${s.category_name ? " · " + esc(s.category_name) : ""}${s.has_attachments ? " · has a file" : ""}</small></div>`;
    box.innerHTML = dupes
        .map(
            ({ r, b }, i) => `<div class="ff-dupe" data-i="${i}">
            <div class="ff-dupe-pair">${side(r, "Scanned")}${side(b, "From the bank")}</div>
            <div class="ff-dupe-amt">${money(r.amount, r.currency_code)}</div>
            <div class="ff-dupe-acts">
                <button type="button" class="btn btn-sm btn-primary" data-dupe="merge" aria-describedby="ff-merge-help">Merge</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-dupe="keep">Not the same</button>
            </div>
        </div>`,
        )
        .join("") +
        '<p class="ff-employer-help" id="ff-merge-help">Merge keeps the bank transaction, moves the scanned file, category and notes onto it, and deletes the scanned one.</p>';
}

async function mergePair({ r, b }) {
    // 1. move every attachment of the scanned transaction to the bank one
    const atts = await api("GET", `api/v1/transactions/${r.group_id}/attachments`);
    for (const a of atts.data) {
        await api("PUT", `api/v1/attachments/${a.id}`, { attachable_type: "TransactionJournal", attachable_id: String(b.transaction_journal_id) });
    }
    // 2. carry over what the bank transaction lacks
    const update = { transaction_journal_id: String(b.transaction_journal_id) };
    if (!b.category_name && r.category_name) {
        update.category_name = r.category_name;
    }
    if (r.notes && !(b.notes ?? "").includes(r.notes)) {
        update.notes = [b.notes, r.notes].filter(Boolean).join("\n");
    }
    if (Object.keys(update).length > 1) {
        await api("PUT", `api/v1/transactions/${b.group_id}`, { apply_rules: false, transactions: [update] });
    }
    // 3. remove the scanned transaction
    await api("DELETE", `api/v1/transactions/${r.group_id}`);
}

function bindDupes() {
    const box = root.querySelector('[data-fill="dupes"]');
    const status = root.querySelector('[data-fill="dupes-status"]');
    box.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-dupe]");
        if (!btn) {
            return;
        }
        const row = btn.closest(".ff-dupe");
        const pair = dupes[parseInt(row.dataset.i)];
        const name = pair.r.destination_name || pair.r.description;
        if (btn.dataset.dupe === "merge" && btn.dataset.confirm !== "1") {
            btn.dataset.confirm = "1";
            btn.textContent = "Confirm merge";
            btn.classList.replace("btn-primary", "btn-danger");
            return;
        }
        row.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
            if (btn.dataset.dupe === "merge") {
                await mergePair(pair);
                status.textContent = `Merged ${name} into the bank transaction.`;
            } else {
                prefs.dismissed = [...prefs.dismissed, pairKey(pair.r, pair.b)];
                await savePrefs();
                status.textContent = `Kept both ${name} transactions.`;
            }
            await loadDupes();
        } catch (e) {
            console.error("scan: duplicate action", e);
            status.textContent = "That did not work. Reload the page and try again.";
            row.querySelectorAll("button").forEach((b) => (b.disabled = false));
        }
    });
}

// ---------- boot ----------
function bindInputs() {
    for (const input of root.querySelectorAll("[data-input]")) {
        input.addEventListener("change", () => {
            [...input.files].forEach(addItem);
            input.value = "";
        });
    }
    const drop = root.querySelector(".ff-scan-start");
    drop.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        drop.classList.add("ff-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("ff-dragging"));
    drop.addEventListener("drop", (ev) => {
        ev.preventDefault();
        drop.classList.remove("ff-dragging");
        [...ev.dataTransfer.files].forEach(addItem);
    });
}

async function run0() {
    hidden = true === window.store.get("anonymous");
    bindInputs();
    bindDupes();
    ready = Promise.all([loadAccounts(), loadPrefs(), loadCategories()]).catch((e) => console.error("scan: setup", e));
    await ready;
    loadDupes();
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
