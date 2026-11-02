/*
 * cycles.js
 * Firefly III Custom: pay cycles for the budget pay-cycle view (js/custom/pay-cycle.js).
 *
 * A cycle runs from the day the salary lands to the day before the next salary. Pay days are the
 * salary deposits themselves; the next one, while it has not landed, is estimated from the usual day of
 * the month (moved to the Friday before when it falls in a weekend). Dates are "YYYY-MM-DD" strings.
 */

const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (s) => new Date(s.substring(0, 10) + "T12:00:00");
export const addDays = (s, n) => {
    const d = at(s);
    d.setDate(d.getDate() + n);
    return iso(d);
};
export const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 86400000);
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** The salary deposits among a source's deposits: the largest one in each month, ignoring small extras. */
export function payDates(deposits) {
    const byMonth = new Map();
    for (const d of deposits) {
        const key = d.date.substring(0, 7);
        if (!byMonth.has(key) || d.amount > byMonth.get(key).amount) {
            byMonth.set(key, d);
        }
    }
    const biggest = [...byMonth.values()];
    const floor = median(biggest.map((d) => d.amount)) * 0.4;
    return biggest.filter((d) => d.amount >= floor).map((d) => d.date.substring(0, 10)).sort();
}

/** The day of the month salary usually lands, from the last six pay days (21 when there are none). */
export function usualDay(dates) {
    const days = dates.slice(-6).map((s) => at(s).getDate());
    return days.length ? Math.round(median(days)) : 21;
}

/** The expected pay day in the month after `after`: the usual day, or the Friday before it in a weekend. */
export function expectedAfter(after, day) {
    const base = at(after);
    const last = new Date(base.getFullYear(), base.getMonth() + 2, 0).getDate();
    const d = new Date(base.getFullYear(), base.getMonth() + 1, Math.min(day, last), 12);
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() - 1);
    }
    return iso(d);
}

/**
 * Cycles from the pay days, oldest first, plus `ahead` estimated cycles after the current one.
 * Each: { start, end, startExpected, endExpected, late }. "late": the next salary was expected
 * by today but has not landed, so the current cycle keeps running until it does.
 */
export function buildCycles(dates, today, ahead = 2) {
    const day = usualDay(dates);
    const starts = dates.map((d) => ({ date: d, expected: false }));
    if (!starts.length) {
        // no salary found yet: count from the usual day this month (or last month)
        const t = at(today);
        let first = expectedAfter(iso(new Date(t.getFullYear(), t.getMonth() - 1, 1, 12)), day);
        if (first > today) {
            first = expectedAfter(iso(new Date(t.getFullYear(), t.getMonth() - 2, 1, 12)), day);
        }
        starts.push({ date: first, expected: true });
    }
    let late = false;
    for (let i = 0; i <= ahead; i++) {
        const next = expectedAfter(starts[starts.length - 1].date, day);
        if (i === 0 && next <= today) {
            late = true; // salary is due but not booked: the current cycle runs on
        }
        starts.push({ date: late && i === 0 ? addDays(today, 1) : next, expected: true });
    }
    const cycles = [];
    for (let i = 0; i < starts.length - 1; i++) {
        cycles.push({
            start: starts[i].date,
            end: addDays(starts[i + 1].date, -1),
            startExpected: starts[i].expected,
            endExpected: starts[i + 1].expected,
            nextPayDay: late && starts[i + 1].expected && !starts[i].expected ? expectedAfter(starts[i].date, day) : starts[i + 1].date,
            late: late && !starts[i].expected && starts[i + 1].expected,
        });
    }
    return cycles;
}

/** Index of the cycle that contains `date`, or -1. */
export const cycleIndex = (cycles, date) => cycles.findIndex((c) => c.start <= date && date <= c.end);
