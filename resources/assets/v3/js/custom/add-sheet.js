/*
 * add-sheet.js
 * Firefly III Custom: the quick "Add transaction" panel (views/components/layout/add-sheet.blade.php).
 * Opens from any element with [data-ff-add]; a plain click on such a link still works without JS.
 * Saves one transaction with POST api/v1/transactions, with rules applied as in the full form.
 */

const dialog = document.getElementById("ff-add");
let loaded = false;
let accounts = [];

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? "";
const locale = () => (document.documentElement.lang || "en").replace("_", "-");

async function api(method, path, body) {
    const res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": csrf(),
            "X-Requested-With": "XMLHttpRequest",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || `Request failed (${res.status})`);
        err.data = data;
        throw err;
    }
    return data;
}

async function all(path) {
    let page = 1;
    let out = [];
    for (;;) {
        const sep = path.includes("?") ? "&" : "?";
        const res = await api("GET", `${path}${sep}limit=100&page=${page}`);
        out = out.concat(res.data);
        if (page >= (res.meta?.pagination?.total_pages ?? 1)) {
            return out;
        }
        page++;
    }
}

const el = (sel) => dialog.querySelector(sel);
const type = () => dialog.querySelector('input[name="ff-type"]:checked').value;
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function option(value, label) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
}

async function load() {
    if (loaded) {
        return;
    }
    const [assets, liabilities, budgets, categories, recent] = await Promise.all([
        all("api/v1/accounts?type=asset"),
        all("api/v1/accounts?type=liabilities").catch(() => []),
        all("api/v1/budgets").catch(() => []),
        api("GET", "api/v1/autocomplete/categories?limit=100").catch(() => []),
        api("GET", "api/v1/transactions?type=withdrawal&limit=40&page=1").catch(() => ({ data: [] })),
    ]);
    accounts = assets.concat(liabilities).filter((a) => a.attributes.active);
    accounts.sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));
    for (const select of [el("#ff-add-from"), el("#ff-add-to")]) {
        select.replaceChildren(...accounts.map((a) => option(a.id, a.attributes.name)));
    }
    if (accounts.length > 1) {
        el("#ff-add-to").selectedIndex = 1;
    }
    const budgetSelect = el("#ff-add-budget");
    budgets.filter((b) => b.attributes.active).forEach((b) => budgetSelect.append(option(b.id, b.attributes.name)));
    el("#ff-add-categories").replaceChildren(...(Array.isArray(categories) ? categories : []).map((c) => option(c.name, "")));

    // payees: most frequent recent ones become one-tap suggestions
    const counts = new Map();
    for (const g of recent.data ?? []) {
        const name = g.attributes.transactions[0]?.destination_name;
        if (name) {
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    const payees = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    el("#ff-add-payees").replaceChildren(...payees.map((p) => option(p, "")));
    const suggest = el("[data-ff-suggest]");
    suggest.replaceChildren(
        ...payees.slice(0, 4).map((p) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = p;
            b.addEventListener("click", () => {
                el("#ff-add-party").value = p;
                el("#ff-add-amount").focus();
            });
            return b;
        }),
    );
    loaded = true;
}

function applyType() {
    const t = type();
    dialog.querySelectorAll("[data-ff-show]").forEach((node) => {
        node.hidden = !node.dataset.ffShow.split(" ").includes(t);
    });
    el("[data-ff-party-label]").textContent = t === "deposit" ? "Received from" : "Paid to";
    el("[data-ff-from-label]").textContent = t === "deposit" ? "Into account" : "From account";
    el("[data-ff-save]").textContent = { withdrawal: "Save expense", deposit: "Save income", transfer: "Save transfer" }[t];
    updateCurrency();
}

function selectedAccount() {
    return accounts.find((a) => a.id === el("#ff-add-from").value);
}

function updateCurrency() {
    const code = selectedAccount()?.attributes.currency_code ?? "EUR";
    const sym = new Intl.NumberFormat(locale(), { style: "currency", currency: code }).formatToParts(0).find((p) => p.type === "currency")?.value;
    el("[data-ff-currency]").textContent = sym ?? code;
}

function showError(text) {
    const box = el(".ff-sheet-error");
    box.textContent = text;
    box.hidden = !text;
}

function toast(html) {
    const t = document.querySelector(".ff-toast");
    t.innerHTML = html;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 5000);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function save(e) {
    e.preventDefault();
    showError("");
    const t = type();
    const amount = parseFloat(String(el("#ff-add-amount").value).replace(/\s/g, "").replace(",", "."));
    const party = el("#ff-add-party").value.trim();
    if (!(amount > 0)) {
        showError("Enter an amount above zero.");
        el("#ff-add-amount").focus();
        return;
    }
    if (t !== "transfer" && !party) {
        showError(t === "deposit" ? "Enter who the money came from." : "Enter who you paid.");
        el("#ff-add-party").focus();
        return;
    }
    const from = el("#ff-add-from").value;
    const to = el("#ff-add-to").value;
    if (t === "transfer" && from === to) {
        showError("Choose two different accounts for a transfer.");
        return;
    }
    const split = {
        type: t,
        date: el("#ff-add-date").value || today(),
        amount: amount.toFixed(2),
        description: el("#ff-add-description").value.trim() || party || "Transfer",
        category_name: el("#ff-add-category").value.trim() || null,
    };
    if (t === "withdrawal") {
        Object.assign(split, { source_id: from, destination_name: party });
        if (el("#ff-add-budget").value) {
            split.budget_id = el("#ff-add-budget").value;
        }
    } else if (t === "deposit") {
        Object.assign(split, { source_name: party, destination_id: from });
    } else {
        Object.assign(split, { source_id: from, destination_id: to });
    }
    const button = el("[data-ff-save]");
    button.disabled = true;
    try {
        const res = await api("POST", "api/v1/transactions", { error_if_duplicate_hash: false, apply_rules: true, fire_webhooks: true, transactions: [split] });
        dialog.close();
        const code = selectedAccount()?.attributes.currency_code ?? "EUR";
        const money = new Intl.NumberFormat(locale(), { style: "currency", currency: code }).format(amount);
        const link = dialog.dataset.showUrl.replace("__ID__", res.data.id);
        toast(`Saved ${esc(money)} · ${esc(split.description)} <a href="${esc(link)}">View</a>`);
        if (document.getElementById("ff-home") || document.querySelector(".ff-txlist")) {
            setTimeout(() => location.reload(), 900);
        }
    } catch (err) {
        const fields = err.data?.errors ? Object.values(err.data.errors).flat().join(" ") : "";
        showError(fields || err.message || "Saving failed. Check the fields and try again.");
    } finally {
        button.disabled = false;
    }
}

function open() {
    showError("");
    el("form").reset();
    el("#ff-add-date").value = today();
    dialog.showModal();
    applyType();
    el("#ff-add-amount").focus();
    load()
        .then(() => {
            applyType();
        })
        .catch(() => showError("Accounts could not be loaded. Use the full form instead."));
}

if (dialog && typeof dialog.showModal === "function") {
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-ff-add]");
        if (!trigger || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
            return;
        }
        e.preventDefault();
        open();
    });
    dialog.addEventListener("click", (e) => {
        if (e.target === dialog || e.target.closest("[data-ff-close]")) {
            dialog.close();
        }
    });
    dialog.querySelectorAll('input[name="ff-type"]').forEach((r) => r.addEventListener("change", applyType));
    el("#ff-add-from").addEventListener("change", updateCurrency);
    el("form").addEventListener("submit", save);
    el("[data-ff-full-form]").addEventListener("click", (e) => {
        e.preventDefault();
        location.href = dialog.dataset.fullForm.replace("__TYPE__", type());
    });
}
