/*
 * shell.js
 * Firefly III Custom: small behaviour for the redesigned top bar, loaded on every page.
 * - the previous/next arrows reuse the period menu's own prev/next items (pages/shared/dates.js)
 * - the period reads compactly ("October", "2025", "Jan 1 – Nov 1"; the year only outside this year), built from the
 *   period the pages load their data for (window.store), so it cannot drift from what is shown
 * - "/" focuses the search field
 * - the quick "Add transaction" panel (add-sheet.js)
 */

import "./add-sheet.js";

function clickMenuItem(selector) {
    const item = document.querySelector("#date-dropdown " + selector);
    if (item && item.getAttribute("data-start")) {
        item.click();
    }
}

function periodText(start, end) {
    const lang = document.documentElement.lang || "en";
    const sameYear = start.getFullYear() === end.getFullYear();
    // the year is left out while the whole period is in the current year (the full dates are in the title)
    const thisYear = sameYear && start.getFullYear() === new Date().getFullYear();
    const day = (d, withYear) => d.toLocaleDateString(lang, { month: "short", day: "numeric", ...(withYear && !thisYear ? { year: "numeric" } : {}) });
    const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    if (start.toDateString() === end.toDateString()) {
        return day(start, true);
    }
    if (sameYear && start.getMonth() === 0 && start.getDate() === 1 && end.getMonth() === 11 && end.getDate() === 31) {
        return String(start.getFullYear());
    }
    if (sameYear && start.getMonth() === end.getMonth() && start.getDate() === 1 && end.getDate() === lastOfMonth) {
        return start.toLocaleDateString(lang, thisYear ? { month: "long" } : { month: "long", year: "numeric" });
    }
    if (sameYear) {
        return `${day(start, false)} – ${day(end, true)}`;
    }
    return `${day(start, true)} – ${day(end, true)}`;
}

function prettyPeriod() {
    const holder = document.querySelector("#date-dropdown .daterange-holder");
    const pretty = document.querySelector("#date-dropdown .ff-period-pretty");
    if (!holder || !pretty) {
        return;
    }
    // the store holds the period every page loads its data for; the holder's text can lag behind it
    const fromStore = (k) => (window.store && typeof window.store.get === "function" ? window.store.get(k) : null);
    const start = new Date(fromStore("start") || Date.parse(holder.getAttribute("data-start") || ""));
    const end = new Date(fromStore("end") || Date.parse(holder.getAttribute("data-end") || ""));
    if (isNaN(start) || isNaN(end)) {
        return;
    }
    const lang = document.documentElement.lang || "en";
    const full = (d) => d.toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric" });
    pretty.textContent = periodText(start, end);
    const label = holder.closest(".ff-period-label");
    label?.setAttribute("title", `${full(start)} – ${full(end)}. Choose a period`);
    holder.closest("#date-dropdown").classList.add("ff-period-ready");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ff-period-prev")?.addEventListener("click", () => clickMenuItem(".daterange-prev"));
    document.getElementById("ff-period-next")?.addEventListener("click", () => clickMenuItem(".daterange-next"));

    const holder = document.querySelector("#date-dropdown .daterange-holder");
    if (holder) {
        new MutationObserver(prettyPeriod).observe(holder, { attributes: true, childList: true, characterData: true, subtree: true });
        prettyPeriod();
        // the store is ready only after bootstrap; redraw then, and whenever the period changes
        const watch = () => {
            if (window.store && typeof window.store.observe === "function") {
                window.store.observe("start", prettyPeriod);
                window.store.observe("end", prettyPeriod);
            }
            prettyPeriod();
        };
        if (window.bootstrapped) {
            watch();
        } else {
            document.addEventListener("firefly-iii-bootstrapped", watch, { once: true });
        }
    }

    document.addEventListener("keydown", (e) => {
        if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (["input", "textarea", "select"].includes(tag) || document.activeElement?.isContentEditable) {
            return;
        }
        const search = document.getElementById("searchInput");
        if (search && search.offsetParent !== null) {
            e.preventDefault();
            search.focus();
        }
    });
});
