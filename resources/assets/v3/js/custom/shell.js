/*
 * shell.js
 * Firefly III Custom: small behaviour for the redesigned top bar, loaded on every page.
 * - the previous/next arrows reuse the period menu's own prev/next items (pages/shared/dates.js)
 * - a whole month reads "October 2026" instead of "Oct 1 - Oct 31"
 * - "/" focuses the search field
 */

function clickMenuItem(selector) {
    const item = document.querySelector("#date-dropdown " + selector);
    if (item && item.getAttribute("data-start")) {
        item.click();
    }
}

function prettyPeriod() {
    const holder = document.querySelector("#date-dropdown .daterange-holder");
    const pretty = document.querySelector("#date-dropdown .ff-period-pretty");
    if (!holder || !pretty) {
        return;
    }
    const start = new Date(Date.parse(holder.getAttribute("data-start") || ""));
    const end = new Date(Date.parse(holder.getAttribute("data-end") || ""));
    if (isNaN(start) || isNaN(end)) {
        return;
    }
    const lang = document.documentElement.lang || "en";
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    let text = holder.textContent.trim();
    if (start.getDate() === 1 && end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear() && end.getDate() === lastDay) {
        text = start.toLocaleDateString(lang, { month: "long", year: "numeric" });
    }
    pretty.textContent = text;
    holder.closest("#date-dropdown").classList.add("ff-period-ready");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ff-period-prev")?.addEventListener("click", () => clickMenuItem(".daterange-prev"));
    document.getElementById("ff-period-next")?.addEventListener("click", () => clickMenuItem(".daterange-next"));

    const holder = document.querySelector("#date-dropdown .daterange-holder");
    if (holder) {
        new MutationObserver(prettyPeriod).observe(holder, { attributes: true, childList: true, characterData: true, subtree: true });
        prettyPeriod();
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
