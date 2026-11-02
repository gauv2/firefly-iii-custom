/*
 * statement.js
 * Firefly III Custom: reads bank statements for the Import page (js/custom/import.js).
 *
 * parseStatement(text) understands ING's CSV downloads (Mijn ING, comma or semicolon, Dutch or
 * English headers, current and savings accounts) and camt.053 XML. It returns one line per booking:
 *   { account, date: "YYYY-MM-DD", amount: "12.34" (positive), direction: "out" | "in",
 *     name, counterIban, description, notes, currency, ref }
 * "ref" is a stable fingerprint of the bank line, stored as the transaction's external_id, so
 * importing the same statement twice is recognised. No DOM is needed except DOMParser for camt.053.
 */

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const iban = (s) => String(s ?? "").replace(/\s+/g, "").toUpperCase();

// ---------- CSV ----------
export function parseCsv(text, sep) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                cell += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === sep) {
            row.push(cell);
            cell = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") {
                i++;
            }
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += c;
        }
    }
    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const HEADERS = {
    date: ["datum", "date"],
    name: ["naam / omschrijving", "name / description", "omschrijving", "description"],
    account: ["rekening", "account"],
    counter: ["tegenrekening", "counterparty"],
    direction: ["af bij", "debit/credit", "af/bij"],
    amount: ["bedrag (eur)", "amount (eur)", "bedrag", "amount"],
    currency: ["valuta", "currency"],
    kind: ["mutatiesoort", "transaction type"],
    memo: ["mededelingen", "notifications"],
    balance: ["saldo na mutatie", "resulting balance"],
};

/** "1.234,56", "1234,56" or "1234.56" -> "1234.56" */
export function toAmount(s) {
    let v = clean(s).replace(/[€\s]/g, "");
    if (/,\d{1,2}$/.test(v)) {
        v = v.replace(/\./g, "").replace(",", ".");
    } else {
        v = v.replace(/,/g, "");
    }
    const n = Math.abs(parseFloat(v));
    if (!isFinite(n)) {
        throw new Error(`"${s}" is not an amount`);
    }
    return n.toFixed(2);
}

/** 20261101, 2026-11-01, 01-11-2026 or 01/11/2026 -> 2026-11-01 */
export function toDate(s) {
    const v = clean(s);
    let m;
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)) || (m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v))) {
        return `${m[1]}-${m[2]}-${m[3]}`;
    }
    if ((m = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(v))) {
        return `${m[3]}-${m[2]}-${m[1]}`;
    }
    throw new Error(`"${s}" is not a date`);
}

/** The useful part of ING's "Mededelingen": the SEPA description when there is one. */
function describe(name, memo) {
    const m = /Omschrijving:\s*(.+?)\s*(?:IBAN:|Kenmerk:|Machtiging ID:|Incassant ID:|Valutadatum:|$)/i.exec(memo)
        || /Description:\s*(.+?)\s*(?:IBAN:|Reference:|Mandate ID:|Creditor ID:|Value date:|$)/i.exec(memo);
    const text = clean(m?.[1]);
    return (text && text.toLowerCase() !== name.toLowerCase() ? `${name}: ${text}` : name).slice(0, 250);
}

function fromIngCsv(text) {
    const first = text.split(/\r?\n/, 1)[0];
    const sep = (first.match(/;/g) ?? []).length > (first.match(/,/g) ?? []).length ? ";" : ",";
    const rows = parseCsv(text.replace(/^﻿/, ""), sep);
    const head = rows.shift()?.map((h) => clean(h).toLowerCase()) ?? [];
    const col = {};
    for (const [key, names] of Object.entries(HEADERS)) {
        col[key] = head.findIndex((h) => names.includes(h));
    }
    for (const need of ["date", "name", "direction", "amount"]) {
        if (col[need] < 0) {
            throw new Error("This does not look like an ING CSV statement: there is no date, name, debit/credit or amount column.");
        }
    }
    const get = (r, k) => (col[k] >= 0 ? clean(r[col[k]]) : "");
    return rows.map((r, i) => {
        const dir = get(r, "direction").toLowerCase();
        const name = get(r, "name") || "(no name)";
        const memo = get(r, "memo");
        const kind = get(r, "kind");
        const counterIban = iban(get(r, "counter"));
        const line = {
            account: iban(get(r, "account")),
            date: toDate(get(r, "date")),
            amount: toAmount(get(r, "amount")),
            direction: /^(af|debit|d)$/.test(dir) ? "out" : /^(bij|credit|c)$/.test(dir) ? "in" : null,
            name,
            counterIban,
            description: describe(name, memo),
            notes: [memo, kind && `Type: ${kind}`, counterIban && `Counterparty account: ${counterIban}`].filter(Boolean).join("\n"),
            currency: get(r, "currency") || "EUR",
            raw: [get(r, "account"), get(r, "date"), dir, get(r, "amount"), name, counterIban, memo, get(r, "balance")].join("|"),
        };
        if (!line.direction) {
            throw new Error(`Row ${i + 2}: "${get(r, "direction")}" is neither a debit nor a credit.`);
        }
        return line;
    });
}

// ---------- camt.053 ----------
function fromCamt(text, DomParser) {
    const doc = new DomParser().parseFromString(text, "application/xml");
    const all = (el, name) => [...el.getElementsByTagNameNS("*", name)];
    const one = (el, ...path) => {
        let cur = el;
        for (const p of path) {
            cur = cur && all(cur, p)[0];
        }
        return cur ? clean(cur.textContent) : "";
    };
    const lines = [];
    for (const stmt of all(doc, "Stmt")) {
        const account = iban(one(stmt, "Acct", "IBAN"));
        for (const e of all(stmt, "Ntry")) {
            const out = one(e, "CdtDbtInd") === "DBIT";
            const party = out ? "Cdtr" : "Dbtr";
            const name = one(e, "RltdPties", party, "Nm") || one(e, "AddtlNtryInf") || "(no name)";
            const counterIban = iban(one(e, "RltdPties", `${party}Acct`, "IBAN"));
            const memo = all(e, "Ustrd").map((u) => clean(u.textContent)).join(" ");
            const amtEl = all(e, "Amt")[0];
            const ref = one(e, "AcctSvcrRef") || one(e, "NtryRef") || one(e, "EndToEndId");
            lines.push({
                account,
                date: toDate(one(e, "BookgDt", "Dt") || one(e, "BookgDt", "DtTm")),
                amount: toAmount(amtEl?.textContent),
                direction: out ? "out" : "in",
                name: name.slice(0, 250),
                counterIban,
                description: (memo ? `${name}: ${memo}` : name).slice(0, 250),
                notes: [memo, one(e, "AddtlNtryInf"), counterIban && `Counterparty account: ${counterIban}`].filter(Boolean).join("\n"),
                currency: amtEl?.getAttribute("Ccy") || "EUR",
                raw: [account, ref, one(e, "BookgDt", "Dt"), out, amtEl?.textContent, name, memo].join("|"),
            });
        }
    }
    if (!lines.length) {
        throw new Error("No bookings were found in this camt.053 file.");
    }
    return lines;
}

// ---------- fingerprint ----------
async function sha(text) {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Reads a statement file's text into booking lines, each with a stable "ref". */
export async function parseStatement(text, DomParser = globalThis.DOMParser) {
    const lines = /^\s*(<\?xml|<Document)/.test(text) ? fromCamt(text, DomParser) : fromIngCsv(text);
    const seen = new Map();
    for (const l of lines) {
        // identical bank lines (two coffees, same day, same balance column missing) stay apart
        const n = (seen.get(l.raw) ?? 0) + 1;
        seen.set(l.raw, n);
        l.ref = `bank:${await sha(n > 1 ? `${l.raw}#${n}` : l.raw)}`;
        delete l.raw;
    }
    return lines;
}
