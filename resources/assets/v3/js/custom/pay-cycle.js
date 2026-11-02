/*
 * pay-cycle.js
 * Firefly III Custom: budgets per pay cycle (resources/views/custom/pay-cycle.blade.php).
 *
 * Pay days are the salary deposits from one income source (chosen on the page, remembered with the
 * Month / Pay cycle choice in the "customCycle" preference; guessed from the deposits until then).
 * js/custom/cycles.js turns them into cycles: salary day to the day before the next salary.
 *
 * A budget's amount for a cycle is an ordinary Firefly budget limit for exactly the cycle's dates,
 * marked with the note "pay-cycle". Monthly limits are left alone and not shown here. When a salary
 * lands on another day than expected, the limits of the cycles around it are moved to the real dates.
 * When the current cycle has no amounts yet, the previous cycle's are copied into it.
 */

import "../boot/bootstrap.js";
import sidebar from "../pages/shared/sidebar.js";
import dates from "../pages/shared/dates.js";
import Alpine from "@alpinejs/csp";
import { addDays, buildCycles, cycleIndex, daysBetween, iso, payDates } from "./cycles.js";

const PREF = "customCycle";
const MARK = "pay-cycle";
const LOOKBACK_DAYS = 400;

const root = document.getElementById("ff-cycle");
const $ = (sel) => root.querySelector(sel);
const fill = (name, html) => ($(`[data-fill="${name}"]`).innerHTML = html);
let hidden = false;
let prefs = { mode: "cycle", source: null };
let deposits = []; // all deposits in the look-back window
let sources = []; // [{ name, months, total }]
let source = null;
let pays = []; // salary pay days, "YYYY-MM-DD"
let cycles = [];
let at = 0; // index of the cycle on screen
let budgets = []; // [{ id, name, spent, limits: [] }]
let busy = false;

// ---------- helpers ----------
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? "";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};
const locale = () => (window.__localeId__ || "en-US").replace("_", "-");
const money = (v) => (hidden ? "•••" : new Intl.NumberFormat(locale(), { style: "currency", currency: "EUR" }).format(v));
const nice = (s, year = false) => new Date(s + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const today = () => iso(new Date());
const words = (s) => new Set(String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1));

async function api(method, path, body) {
    const headers = { Accept: "application/json", "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest" };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, { method, credentials: "same-origin", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || `Request failed (${res.status})`);
        err.data = data;
        throw err;
    }
    return data;
}

async function all(path) {
    const out = [];
    for (let page = 1; ; page++) {
        const res = await api("GET", `${path}${path.includes("?") ? "&" : "?"}limit=500&page=${page}`);
        out.push(...res.data);
        if (page >= (res.meta?.pagination?.total_pages ?? 1)) {
            return out;
        }
    }
}

// ---------- pay days ----------
async function loadPrefs() {
    try {
        const d = (await api("GET", `api/v1/preferences/${PREF}`)).data.attributes.data;
        prefs = { ...prefs, ...(d && typeof d === "object" ? d : {}) };
    } catch {
        // not set yet
    }
}

async function loadDeposits() {
    const from = addDays(today(), -LOOKBACK_DAYS);
    const groups = await all(`api/v1/transactions?type=deposit&start=${from}&end=${addDays(today(), 1)}`);
    deposits = groups.flatMap((g) => g.attributes.transactions.map((s) => ({ name: s.source_name, date: s.date.substring(0, 10), amount: num(s.amount) })));
    const by = new Map();
    for (const d of deposits) {
        const s = by.get(d.name) ?? { name: d.name, months: new Set(), total: 0 };
        if (d.amount >= 300) {
            s.months.add(d.date.substring(0, 7));
        }
        s.total += d.amount;
        by.set(d.name, s);
    }
    sources = [...by.values()].map((s) => ({ ...s, months: s.months.size })).sort((a, b) => b.months - a.months || b.total - a.total);

    // the saved choice, else the employer on the latest payslip, else the most regular large payer
    let employer = "";
    try {
        const slips = (await api("GET", "api/v1/preferences/customEmployer")).data.attributes.data?.payslips ?? [];
        employer = String(slips[slips.length - 1]?.employer ?? "").replace(/^[A-Z]{3} - /, "");
    } catch {
        // no payslips
    }
    const ew = words(employer);
    const score = (s) => s.months + (ew.size && [...words(s.name)].some((w) => ew.has(w)) ? 6 : 0);
    source = sources.find((s) => s.name === prefs.source)?.name ?? [...sources].sort((a, b) => score(b) - score(a))[0]?.name ?? null;
    pays = payDates(deposits.filter((d) => d.name === source));
}

function salaryOn(day) {
    const hit = deposits.filter((d) => d.name === source && d.date === day).sort((a, b) => b.amount - a.amount)[0];
    return hit?.amount ?? null;
}

// ---------- budgets and cycle limits ----------
const belongs = (limit, c) => Math.abs(daysBetween(c.start, limit.start)) <= 6;
const limitFor = (b, c) => b.limits.find((l) => belongs(l, c));

async function loadBudgets() {
    const c = cycles[at];
    const list = await all(`api/v1/budgets?start=${c.start}&end=${c.end}`);
    const from = addDays(cycles[Math.max(0, at - 1)].start, -10);
    const to = addDays(cycles[Math.min(cycles.length - 1, at + 1)].end, 10);
    budgets = await Promise.all(
        list
            .filter((b) => b.attributes.active !== false)
            .map(async (b) => {
                const limits = (await api("GET", `api/v1/budgets/${b.id}/limits?start=${from}&end=${to}`)).data
                    .filter((l) => String(l.attributes.notes ?? "").trim() === MARK)
                    .map((l) => ({ id: l.id, start: l.attributes.start.substring(0, 10), end: l.attributes.end.substring(0, 10), amount: num(l.attributes.amount) }));
                const spent = (b.attributes.spent ?? []).reduce((s, x) => s + Math.abs(num(x.sum)), 0);
                return { id: b.id, name: b.attributes.name, spent, limits };
            }),
    );
}

/** Moves cycle limits to their cycle's real dates (a salary that landed earlier or later than expected). */
async function syncLimits() {
    let moved = 0;
    for (const b of budgets) {
        for (const l of b.limits) {
            const c = cycles.slice(Math.max(0, at - 1), at + 2).find((x) => belongs(l, x));
            if (c && (l.start !== c.start || l.end !== c.end)) {
                await api("PUT", `api/v1/budgets/${b.id}/limits/${l.id}`, { start: c.start, end: c.end, fire_webhooks: false });
                Object.assign(l, { start: c.start, end: c.end });
                moved++;
            }
        }
    }
    return moved;
}

async function setAmount(b, c, amount) {
    const l = limitFor(b, c);
    if (!amount) {
        if (l) {
            await api("DELETE", `api/v1/budgets/${b.id}/limits/${l.id}`);
            b.limits = b.limits.filter((x) => x !== l);
        }
        return;
    }
    if (l) {
        await api("PUT", `api/v1/budgets/${b.id}/limits/${l.id}`, { amount: amount.toFixed(2), fire_webhooks: false });
        l.amount = amount;
    } else {
        const res = await api("POST", `api/v1/budgets/${b.id}/limits`, { start: c.start, end: c.end, amount: amount.toFixed(2), notes: MARK, fire_webhooks: false });
        b.limits.push({ id: res.data.id, start: c.start, end: c.end, amount });
    }
}

/** Copies the previous cycle's amounts into cycle `c` for budgets that have none there. */
async function copyLast(c, prev) {
    let n = 0;
    for (const b of budgets) {
        const from = prev && limitFor(b, prev);
        if (from && !limitFor(b, c)) {
            await setAmount(b, c, from.amount);
            n++;
        }
    }
    return n;
}

// ---------- rendering ----------
function render(noBudget, note) {
    const c = cycles[at];
    const now = today();
    const current = c.start <= now && now <= c.end;
    const length = daysBetween(c.start, c.end) + 1;
    fill("title", `${esc(nice(c.start, c.start.substring(0, 4) !== c.end.substring(0, 4)))} – ${esc(nice(c.end, true))}`);
    let sub;
    if (current) {
        const left = daysBetween(now, c.end) + 1;
        sub = c.late
            ? `Day ${daysBetween(c.start, now) + 1}. Salary was expected ${esc(nice(c.nextPayDay))} and has not landed yet, so this cycle runs on.`
            : `Day ${daysBetween(c.start, now) + 1} of ${length} · ${left} ${left === 1 ? "day" : "days"} to pay day (${esc(nice(c.nextPayDay))}${c.endExpected ? ", expected" : ""})`;
    } else if (c.start > now) {
        sub = `Starts when salary lands, expected ${esc(nice(c.start))} · ${length} days`;
    } else {
        sub = `${length} days · ended`;
    }
    fill("subtitle", sub);
    $('[data-act="prev"]').disabled = at === 0;
    $('[data-act="next"]').disabled = at >= cycles.length - 1;

    const rows = budgets.map((b) => ({ b, l: limitFor(b, c) }));
    const budgeted = rows.reduce((s, r) => s + (r.l?.amount ?? 0), 0);
    const spent = rows.reduce((s, r) => s + (r.l ? r.b.spent : 0), 0);
    const left = budgeted - spent;
    const daysLeft = current ? daysBetween(now, c.end) + 1 : 0;
    const salary = c.startExpected ? null : salaryOn(c.start);
    const tile = (label, value, extra = "") => `<div class="ff-cycle-tile"${extra}><span>${label}</span><b>${value}</b></div>`;
    fill(
        "tiles",
        tile("Salary", salary === null ? "expected" : money(salary)) +
            tile("Budgeted", money(budgeted)) +
            tile("Spent in budgets", money(spent)) +
            tile("Left", money(left), left < 0 ? ' data-neg="1"' : "") +
            (current ? tile("Per day until pay day", money(Math.max(0, left) / Math.max(1, daysLeft))) : "") +
            tile("Not in a budget", money(noBudget)),
    );

    const urlBudget = (id) => root.dataset.urlBudget.replace("__ID__", encodeURIComponent(id));
    const urlNo = root.dataset.urlNoBudget.replace("__START__", c.start).replace("__END__", c.end);
    fill("budgets-note", note ?? (rows.some((r) => r.l) ? "" : "No amounts for this cycle yet"));
    fill(
        "budgets",
        budgets.length
            ? `<div class="ff-cycle-rows">${rows
                  .sort((x, y) => (y.l ? 1 : 0) - (x.l ? 1 : 0) || y.b.spent - x.b.spent)
                  .map(({ b, l }) => {
                      const amount = l?.amount ?? 0;
                      const pct = amount > 0 ? Math.min(100, (b.spent / amount) * 100) : b.spent > 0 ? 100 : 0;
                      const rest = amount - b.spent;
                      return `<div class="ff-cycle-row" data-id="${esc(b.id)}">
                        <a class="ff-cycle-name" href="${esc(urlBudget(b.id))}">${esc(b.name)}</a>
                        <label class="ff-cycle-amount"><span class="visually-hidden">Amount for ${esc(b.name)} this cycle</span>
                            <input class="form-control form-control-sm" type="number" min="0" step="1" inputmode="decimal" value="${l ? esc(amount.toFixed(2)) : ""}" placeholder="–" data-amount></label>
                        <div class="ff-cycle-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"${rest < 0 ? ' data-over="1"' : ""}></i></div>
                        <div class="ff-cycle-fig"><span>${money(b.spent)} spent</span><b${rest < 0 ? ' data-neg="1"' : ""}>${l ? `${money(Math.abs(rest))} ${rest < 0 ? "over" : "left"}` : "no amount"}</b></div>
                    </div>`;
                  })
                  .join("")}</div>
              <p class="ff-employer-help"><a href="${esc(urlNo)}">${money(noBudget)} spent outside a budget this cycle</a> · amounts save when you leave the field</p>`
            : `<p class="ff-empty">You have no budgets yet. <a href="${esc(root.dataset.urlCreate)}">Create one</a></p>`,
    );

    fill(
        "source",
        sources
            .filter((s) => s.months >= 2 || s.name === source)
            .slice(0, 25)
            .map((s) => `<option value="${esc(s.name)}"${s.name === source ? " selected" : ""}>${esc(s.name)} (${s.months} months)</option>`)
            .join("") || '<option value="">No regular income found</option>',
    );
    const recent = pays.slice(-6).reverse();
    fill(
        "paydays",
        `<ul class="ff-cycle-pays">${cycles
            .filter((x) => x.startExpected)
            .slice(0, 1)
            .map((x) => `<li><span>${esc(nice(x.start, true))}</span><small>expected</small></li>`)
            .join("")}${recent.map((d) => `<li><span>${esc(nice(d, true))}</span><b>${money(salaryOn(d) ?? 0)}</b></li>`).join("")}</ul>
        ${pays.length ? "" : '<p class="ff-employer-help">No salary deposits were found from this source, so cycles are counted from the 21st.</p>'}`,
    );
}

async function show(note) {
    const status = $('[data-fill="status"]');
    try {
        busy = true;
        await loadBudgets();
        const moved = await syncLimits();
        const c = cycles[at];
        const now = today();
        let copied = 0;
        if (c.start <= now && now <= c.end && !budgets.some((b) => limitFor(b, c)) && at > 0) {
            copied = await copyLast(c, cycles[at - 1]);
        }
        const nb = await api("GET", `api/v1/insight/expense/no-budget?start=${c.start}&end=${c.end}`);
        const noBudget = (Array.isArray(nb) ? nb : []).reduce((s, x) => s + Math.abs(num(x.difference_float ?? x.difference)), 0);
        render(noBudget, note ?? (copied ? `Amounts copied from the last cycle (${copied})` : moved ? "Moved to the day salary actually landed" : null));
        status.textContent = "";
    } catch (e) {
        console.error("pay-cycle: show", e);
        status.textContent = "This cycle could not be loaded. Reload the page to try again.";
    } finally {
        busy = false;
    }
}

function rebuild(keepDate) {
    cycles = buildCycles(pays, today(), 2);
    const i = cycleIndex(cycles, keepDate ?? today());
    at = i >= 0 ? i : cycles.length - 1;
}

// ---------- events ----------
function bind() {
    root.addEventListener("click", async (ev) => {
        const t = ev.target.closest("[data-act]");
        if (!t || busy) {
            return;
        }
        const status = $('[data-fill="status"]');
        if (t.dataset.act === "prev" && at > 0) {
            at--;
            show();
        } else if (t.dataset.act === "next" && at < cycles.length - 1) {
            at++;
            show();
        } else if (t.dataset.act === "copy") {
            busy = true;
            try {
                const n = await copyLast(cycles[at], cycles[at - 1]);
                await show(n ? `Copied ${n} amounts from the last cycle` : "Nothing to copy: the last cycle has no amounts these budgets lack");
            } catch (e) {
                console.error("pay-cycle: copy", e);
                status.textContent = "Copying did not work. Reload and try again.";
                busy = false;
            }
        } else if (t.dataset.act === "clear") {
            if (t.dataset.confirm !== "1") {
                t.dataset.confirm = "1";
                t.textContent = "Confirm: clear all amounts";
                t.classList.replace("btn-outline-secondary", "btn-danger");
                return;
            }
            busy = true;
            try {
                for (const b of budgets) {
                    await setAmount(b, cycles[at], 0);
                }
                t.dataset.confirm = "";
                t.textContent = "Clear this cycle's amounts";
                t.classList.replace("btn-danger", "btn-outline-secondary");
                await show("Amounts cleared for this cycle");
            } catch (e) {
                console.error("pay-cycle: clear", e);
                status.textContent = "Clearing did not work. Reload and try again.";
                busy = false;
            }
        }
    });
    root.addEventListener("change", async (ev) => {
        const status = $('[data-fill="status"]');
        if (ev.target.matches("[data-amount]")) {
            const b = budgets.find((x) => x.id === ev.target.closest("[data-id]").dataset.id);
            const amount = Math.max(0, num(ev.target.value));
            ev.target.disabled = true;
            try {
                await setAmount(b, cycles[at], amount);
                status.textContent = `${b.name}: ${amount ? money(amount) : "no amount"} this cycle.`;
                await show();
            } catch (e) {
                console.error("pay-cycle: amount", e);
                status.textContent = `${b.name} could not be saved: ${e.message}`;
                ev.target.disabled = false;
            }
        } else if (ev.target.matches('[data-fill="source"]')) {
            source = ev.target.value;
            prefs.source = source;
            pays = payDates(deposits.filter((d) => d.name === source));
            rebuild();
            try {
                await api("POST", "api/v1/preferences", { name: PREF, data: prefs });
            } catch (e) {
                console.error("pay-cycle: save source", e);
            }
            show();
        }
    });
}

async function run0() {
    hidden = true === window.store.get("anonymous");
    bind();
    try {
        await loadPrefs();
        await loadDeposits();
        rebuild();
        await show();
    } catch (e) {
        console.error("pay-cycle: setup", e);
        fill("subtitle", "Your pay days could not be loaded. Reload the page to try again.");
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
