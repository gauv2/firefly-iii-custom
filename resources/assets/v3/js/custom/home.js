/*
 * home.js
 * Firefly III Custom: the redesigned Home page (resources/views/index.blade.php).
 * Every card reads Firefly's own API for the selected period; nothing on the server changes.
 */

import "../boot/bootstrap.js";
import sidebar from "../pages/shared/sidebar.js";
import dates from "../pages/shared/dates.js";
import Alpine from "@alpinejs/csp";
import axios from "axios";
import formatDate from "../util/format-date.js";
import { getVariables } from "../store/get-variables.js";
import ReleaseNotes from "../api/system/release-notes.js";
import Post from "../api/preferences/post.js";
import { Modal } from "bootstrap";
import i18next from "i18next";

const root = document.getElementById("ff-home");
let currency = "EUR";
let hidden = false;

// ---------- helpers ----------
const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};
const locale = () => (window.__localeId__ || "en-US").replace("_", "-");

function money(amount, code = currency, opts = {}) {
    if (hidden) {
        return '<span class="ff-hidden-amount" aria-label="Amount hidden">•••</span>';
    }
    const n = num(amount);
    const text = new Intl.NumberFormat(locale(), { style: "currency", currency: code, maximumFractionDigits: opts.whole ? 0 : 2, minimumFractionDigits: opts.whole ? 0 : 2 })
        .format(Math.abs(n));
    if (n < 0) {
        return "−" + text;
    }
    if (opts.sign && n > 0) {
        return "+" + text;
    }
    return text;
}

const shortDate = (d) => new Date(d).toLocaleDateString(locale(), { month: "short", day: "numeric" });
const url = (key, id) => root.dataset["url" + key].replace("__ID__", encodeURIComponent(id));
const fill = (key, html) => {
    const el = root.querySelector(`[data-fill="${key}"]`);
    if (el) {
        el.innerHTML = html;
    }
    return el;
};
const empty = (text, link, label) =>
    `<p class="ff-empty">${esc(text)}${link ? ` <a href="${esc(link)}">${esc(label)}</a>` : ""}</p>`;
const failed = () => '<p class="ff-empty">This could not be loaded. Reload the page to try again.</p>';
const initials = (s) =>
    String(s || "?")
        .replace(/[^\p{L}\p{N} ]/gu, " ")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "?";

async function getAll(path, params = {}) {
    let page = 1;
    let out = [];
    for (;;) {
        const res = await axios.get(path, { params: { ...params, page, limit: 100 } });
        out = out.concat(res.data.data);
        const pages = parseInt(res.data.meta?.pagination?.total_pages ?? 1);
        if (page >= pages) {
            return out;
        }
        page++;
    }
}

function period() {
    const start = new Date(window.store.get("start"));
    const end = new Date(window.store.get("end"));
    return { start, end, s: formatDate(start, "yyyy-MM-dd"), e: formatDate(end, "yyyy-MM-dd") };
}

// ---------- page title ----------
function title(p) {
    const h1 = document.querySelector(".ff-page-title");
    if (!h1) {
        return;
    }
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const today = new Date();
    let sub = "";
    if (today >= p.start && today <= p.end) {
        const left = Math.round((p.end - today) / 86400000);
        sub = left > 0 ? `${left} ${left === 1 ? "day" : "days"} left in this period` : "Last day of this period";
    } else {
        sub = `${shortDate(p.start)} – ${shortDate(p.end)}`;
    }
    h1.innerHTML = `<span>${greeting}</span><small>${esc(sub)}</small>`;
}

// ---------- summary ----------
async function summary(p, budgetsOver) {
    const res = await axios.get("api/v1/summary/basic", { params: { start: p.s, end: p.e } });
    const d = res.data;
    const keys = Object.keys(d);
    const nw = keys.find((k) => k.startsWith("net-worth-in-"));
    if (nw) {
        currency = nw.substring("net-worth-in-".length);
    }
    const get = (k) => d[`${k}-in-${currency}`];
    fill("net-worth", money(get("net-worth")?.monetary_value ?? 0));
    fill("earned", money(get("earned")?.monetary_value ?? 0));
    fill("spent", money(Math.abs(num(get("spent")?.monetary_value ?? 0))));
    const left = num(get("left-to-spend")?.monetary_value ?? 0);
    const leftEl = fill("left", money(left));
    leftEl.classList.toggle("ff-neg", left < 0);
    fill("earned-sub", "This period");
    fill("spent-sub", "This period");
    fill("left-sub", budgetsOver.total === 0 ? "No budgets this period" : budgetsOver.over > 0 ? `${budgetsOver.over} of ${budgetsOver.total} budgets over` : "All budgets on track");
}

// ---------- balance chart ----------
async function balance(p) {
    const res = await axios.get("api/v1/chart/account/overview", { params: { period: "1D", start: p.s, end: p.e } });
    const series = res.data.filter((x) => x.currency_code === currency);
    if (series.length === 0) {
        fill("balance-chart", empty("No balance history for this period."));
        return;
    }
    const totals = new Map();
    for (const s of series) {
        for (const [date, value] of Object.entries(s.entries)) {
            const day = date.substring(0, 10);
            totals.set(day, (totals.get(day) ?? 0) + num(value));
        }
    }
    const days = [...totals.keys()].sort();
    const values = days.map((d) => totals.get(d));
    const delta = values[values.length - 1] - values[0];
    const deltaEl = root.querySelector('[data-fill="net-worth-delta"]');
    if (!hidden && values.length > 1) {
        deltaEl.hidden = false;
        deltaEl.classList.toggle("ff-delta-neg", delta < 0);
        deltaEl.innerHTML = `${money(delta, currency, { sign: true })} this period`;
    }
    fill("balance-note", series.length === 1 ? esc(series[0].label) + " · daily" : `${series.length} accounts · daily`);

    // draw at the card's real width so labels stay at their real size on every screen
    const box = root.querySelector('[data-fill="balance-chart"]');
    const w = Math.max(260, Math.round(box.clientWidth || 640)), h = w < 500 ? 170 : 210;
    const padL = hidden ? 0 : 58, padB = 22, padT = 8;
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) {
        min -= 1;
        max += 1;
    }
    const span = max - min;
    const step = niceStep(span / 3);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const x = (i) => padL + (i * (w - padL)) / Math.max(1, values.length - 1);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    let grid = "";
    for (let v = lo; v <= hi + step / 2; v += step) {
        grid += `<line x1="${padL}" x2="${w}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="ff-grid-line"/>`;
        if (!hidden) {
            grid += `<text x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(compact(v))}</text>`;
        }
    }
    const tickIdx = values.length <= 1 ? [0] : [0, Math.round((values.length - 1) / 3), Math.round(((values.length - 1) * 2) / 3), values.length - 1];
    const ticks = [...new Set(tickIdx)]
        .map((i, k, arr) => `<text x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="${k === 0 ? "start" : k === arr.length - 1 ? "end" : "middle"}">${esc(shortDate(days[i]))}</text>`)
        .join("");
    const last = values.length - 1;
    const label = `Balance went from ${hidden ? "hidden" : money(values[0]).replace(/<[^>]+>/g, "")} on ${shortDate(days[0])} to ${hidden ? "hidden" : money(values[last]).replace(/<[^>]+>/g, "")} on ${shortDate(days[last])}`;
    fill(
        "balance-chart",
        `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${grid}
        <polygon points="${x(0)},${h - padB} ${pts} ${x(last)},${h - padB}" class="ff-area"/>
        <polyline points="${pts}" class="ff-line"/>
        <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4.5" class="ff-dot"/>${ticks}</svg>`,
    );
}

function compact(v) {
    return new Intl.NumberFormat(locale(), { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function niceStep(raw) {
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    const n = raw / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

// ---------- accounts ----------
async function accounts() {
    const list = (await getAll("api/v1/accounts", { type: "asset" })).filter((a) => a.attributes.active);
    if (list.length === 0) {
        fill("accounts", empty("No accounts yet."));
        return;
    }
    list.sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));
    const roles = { defaultAsset: "Checking", sharedAsset: "Shared", savingAsset: "Savings", ccAsset: "Credit card", cashWalletAsset: "Cash" };
    fill(
        "accounts",
        list
            .slice(0, 6)
            .map((a) => {
                const at = a.attributes;
                return `<a class="ff-row" href="${esc(url("Account", a.id))}">
                <span class="ff-avatar"><em class="bi ${at.account_role === "ccAsset" ? "bi-credit-card" : at.account_role === "savingAsset" ? "bi-piggy-bank" : "bi-wallet2"}" aria-hidden="true"></em></span>
                <span class="ff-row-t"><b>${esc(at.name)}</b><span>${esc(roles[at.account_role] ?? "Account")}</span></span>
                <span class="ff-row-amt">${money(at.current_balance, at.currency_code)}</span></a>`;
            })
            .join("") + (list.length > 6 ? `<a class="ff-more" href="${esc(url("Accounts"))}">${list.length - 6} more</a>` : ""),
    );
}

// ---------- categories ----------
async function categories(p) {
    const [cats, none] = await Promise.all([
        axios.get("api/v1/insight/expense/category", { params: { start: p.s, end: p.e } }),
        axios.get("api/v1/insight/expense/no-category", { params: { start: p.s, end: p.e } }),
    ]);
    let rows = cats.data
        .filter((c) => c.currency_code === currency)
        .map((c) => ({ name: c.name, v: Math.abs(num(c.difference_float ?? c.difference)) }));
    const nc = none.data.find((c) => c.currency_code === currency);
    if (nc && Math.abs(num(nc.difference_float ?? nc.difference)) > 0) {
        rows.push({ name: "No category", v: Math.abs(num(nc.difference_float ?? nc.difference)) });
    }
    rows = rows.filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    if (rows.length === 0) {
        fill("categories", empty("No spending in this period."));
        return;
    }
    if (rows.length > 8) {
        const rest = rows.slice(7).reduce((a, r) => a + r.v, 0);
        rows = rows.slice(0, 7).concat([{ name: `${rows.length - 7} other categories`, v: rest }]);
    }
    const max = rows[0].v;
    fill(
        "categories",
        rows
            .map(
                (r) => `<div class="ff-cat"><span class="ff-cat-name" title="${esc(r.name)}">${esc(r.name.includes(": ") ? r.name.split(": ").slice(1).join(": ") : r.name)}</span>
                <span class="ff-bar" aria-hidden="true"><i style="width:${((r.v / max) * 100).toFixed(1)}%"></i></span>
                <span class="ff-cat-amt">${money(r.v)}</span></div>`,
            )
            .join(""),
    );
}

// ---------- budgets ----------
async function budgets(p) {
    const [limits, list] = await Promise.all([
        getAll("api/v1/budget-limits", { start: p.s, end: p.e }),
        getAll("api/v1/budgets", { start: p.s, end: p.e }),
    ]);
    const names = new Map(list.filter((b) => b.attributes.active).map((b) => [b.id, b.attributes.name]));
    const rows = limits
        .filter((l) => names.has(l.attributes.budget_id) && l.attributes.currency_code === currency)
        .map((l) => {
            const spent = Math.abs((l.attributes.spent ?? []).reduce((a, s) => a + num(s.sum), 0));
            const limit = num(l.attributes.amount);
            return { name: names.get(l.attributes.budget_id), spent, limit, pct: limit > 0 ? spent / limit : 0 };
        })
        .sort((a, b) => b.pct - a.pct);
    const over = rows.filter((r) => r.pct > 1).length;
    if (rows.length === 0) {
        fill("budgets", empty("No budgets set for this period.", url("CreateBudget"), "Create a budget"));
        return { over: 0, total: 0 };
    }
    fill(
        "budgets",
        rows
            .slice(0, 6)
            .map((r) => {
                const cls = r.pct > 1 ? "ff-over" : r.pct > 0.85 ? "ff-near" : "";
                const status =
                    r.pct > 1
                        ? `<span class="ff-status ff-status-over">${money(r.spent - r.limit)} over</span>`
                        : `<span class="ff-status ff-status-ok">${money(r.limit - r.spent)} left</span>`;
                return `<div class="ff-budget"><div class="ff-budget-l"><b>${esc(r.name)}</b>${status}</div>
                <div class="ff-bar ff-bar-budget" role="img" aria-label="${esc(r.name)}: ${Math.round(r.pct * 100)}% of budget used"><i class="${cls}" style="width:${Math.min(r.pct, 1) * 100}%"></i></div>
                <div class="ff-budget-s">${money(r.spent)} of ${money(r.limit)}</div></div>`;
            })
            .join(""),
    );
    return { over, total: rows.length };
}

// ---------- coming up ----------
async function upcoming() {
    const today = new Date();
    const until = new Date(today.getTime() + 35 * 86400000);
    const list = await getAll("api/v1/bills", { start: formatDate(today, "yyyy-MM-dd"), end: formatDate(until, "yyyy-MM-dd") });
    const items = [];
    const todayKey = formatDate(today, "yyyy-MM-dd");
    for (const b of list) {
        const at = b.attributes;
        if (!at.active) {
            continue;
        }
        const next = (at.pay_dates ?? []).map((d) => d.substring(0, 10)).filter((d) => d >= todayKey).sort()[0];
        if (next) {
            items.push({ id: b.id, name: at.name, date: next, amount: num(at.amount_avg ?? at.amount_max), code: at.currency_code });
        }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    if (items.length === 0) {
        fill("upcoming", empty("Nothing due in the next five weeks."));
        return;
    }
    const tomorrow = formatDate(new Date(today.getTime() + 86400000), "yyyy-MM-dd");
    fill(
        "upcoming",
        items
            .slice(0, 5)
            .map((i) => {
                const when = i.date === todayKey ? "today" : i.date === tomorrow ? "tomorrow" : "";
                return `<div class="ff-row"><span class="ff-avatar">${esc(initials(i.name))}</span>
                <span class="ff-row-t"><b>${esc(i.name)}</b><span>${esc(shortDate(i.date))}</span></span>
                <span class="ff-row-amt">${money(i.amount, i.code)}${when ? `<small class="ff-status ff-status-soon">${when}</small>` : ""}</span></div>`;
            })
            .join(""),
    );
}

// ---------- recent ----------
async function recent() {
    const res = await axios.get("api/v1/transactions", { params: { limit: 6, page: 1, type: "all" } });
    const groups = res.data.data;
    if (groups.length === 0) {
        fill("recent", empty("No transactions yet."));
        return;
    }
    fill(
        "recent",
        groups
            .map((g) => {
                const splits = g.attributes.transactions;
                const t = splits[0];
                const total = splits.reduce((a, s) => a + num(s.amount), 0);
                const name = g.attributes.group_title || (t.type === "deposit" ? t.source_name : t.type === "withdrawal" ? t.destination_name : t.description);
                const sign = t.type === "deposit" ? 1 : t.type === "withdrawal" ? -1 : 0;
                const meta = [shortDate(t.date), t.type === "transfer" ? `${t.source_name} → ${t.destination_name}` : t.category_name || "No category"];
                return `<a class="ff-row" href="${esc(url("Transaction", g.id))}">
                <span class="ff-avatar">${t.type === "transfer" ? '<em class="bi bi-arrow-left-right" aria-hidden="true"></em>' : esc(initials(name))}</span>
                <span class="ff-row-t"><b>${esc(name)}</b><span>${esc(meta.join(" · "))}</span></span>
                <span class="ff-row-amt ${sign > 0 ? "ff-pos" : ""}">${money(sign === 0 ? total : sign * total, t.currency_code, { sign: sign > 0 })}</span></a>`;
            })
            .join(""),
    );
}

// ---------- goals ----------
async function goals() {
    const list = await getAll("api/v1/piggy-banks");
    if (list.length === 0) {
        fill("goals", empty("No savings goals yet.", url("CreatePiggy"), "Create a goal"));
        return;
    }
    fill(
        "goals",
        list
            .slice(0, 6)
            .map((g) => {
                const at = g.attributes;
                const pct = at.target_amount ? Math.min(1, num(at.current_amount) / num(at.target_amount)) : 0;
                let line = at.target_amount ? `${money(at.current_amount, at.currency_code)} of ${money(at.target_amount, at.currency_code)}` : `${money(at.current_amount, at.currency_code)} saved`;
                if (at.target_date && at.save_per_month && num(at.left_to_save) > 0) {
                    line += ` · about ${money(at.save_per_month, at.currency_code)} a month until ${new Date(at.target_date).toLocaleDateString(locale(), { month: "long", year: "numeric" })}`;
                }
                return `<a class="ff-goal" href="${esc(url("Piggy", g.id))}">${ring(pct)}<span><b>${esc(at.name)}</b><span>${line}</span></span></a>`;
            })
            .join(""),
    );
}

function ring(p, s = 56) {
    const r = s / 2 - 5;
    const c = 2 * Math.PI * r;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" role="img" aria-label="${Math.round(p * 100)}% saved" class="ff-ring">
    <circle cx="${s / 2}" cy="${s / 2}" r="${r}" class="ff-ring-track"/>
    <circle cx="${s / 2}" cy="${s / 2}" r="${r}" class="ff-ring-fill" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${s / 2} ${s / 2})"/>
    <text x="50%" y="54%" text-anchor="middle">${Math.round(p * 100)}%</text></svg>`;
}

// ---------- release notes (unchanged behaviour from pages/dashboard/dashboard.js) ----------
function releaseNotes() {
    if (window.showTour) {
        return;
    }
    const version = document.head.querySelector('meta[name="x-firefly-iii-version"]').content;
    const whatsNewDialog = "wn_" + version;
    const lastTimeDialog = "lt_" + version;
    getVariables([whatsNewDialog, lastTimeDialog]).then((values) => {
        const shown = true === values[whatsNewDialog];
        const lastShowTime = null === values[lastTimeDialog] ? 0 : parseInt(values[lastTimeDialog]) * 1000;
        const due = (0 === lastShowTime && !shown) || (!shown && lastShowTime > 0 && (Date.now() - lastShowTime) / 86400000 > 2);
        if (!due) {
            return;
        }
        new ReleaseNotes().get().then((notes) => {
            const now = parseInt(Date.now() / 1000);
            const mark = (revisit) => {
                new Post().post(whatsNewDialog, revisit);
                new Post().post(lastTimeDialog, now);
                window.store.set(whatsNewDialog, revisit);
                window.store.set(lastTimeDialog, now);
            };
            if (null === notes.data.release_notes) {
                mark(true);
                return;
            }
            let v = notes.data.version;
            if (!v.startsWith("develop")) {
                v = "v" + v;
            }
            const element = document.getElementById("releaseNotesModal");
            element.querySelector(".modal-title").innerHTML = i18next.t("firefly.release_notes_title", { version: v });
            element.querySelector(".modal-body").innerHTML = notes.data.release_notes;
            new Modal(element, {}).show();
            element.addEventListener("hidden.bs.modal", () => mark(!document.getElementById("revisitCheckbox").checked));
        });
    });
}

// ---------- boot ----------
async function run() {
    hidden = true === window.store.get("anonymous");
    const p = period();
    title(p);
    const guard = (key, fn) =>
        fn().catch((e) => {
            console.error("home: " + key, e);
            fill(key, failed());
        });
    const budgetResult = await budgets(p).catch((e) => {
        console.error("home: budgets", e);
        fill("budgets", failed());
        return { over: 0, total: 0 };
    });
    await summary(p, budgetResult).catch((e) => console.error("home: summary", e));
    await Promise.all([
        guard("balance-chart", () => balance(p)),
        guard("accounts", accounts),
        guard("categories", () => categories(p)),
        guard("upcoming", upcoming),
        guard("recent", recent),
        guard("goals", goals),
    ]);
    releaseNotes();
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
