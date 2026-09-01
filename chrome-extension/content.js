/**
 * Shortlist Chrome Extension — content.js
 *
 * Injects a floating "Shortlist this job" button on supported job boards.
 * Extracts the job description text and opens Shortlist with ?jd= pre-filled.
 *
 * Design principles (see chrome-extension/TESTING.md):
 *  - Injection and extraction are INDEPENDENT. If the URL matches a supported
 *    board, the button always injects and stays injected (self-healing). A
 *    missed selector degrades to a fallback — it never makes the button vanish.
 *  - Extraction is layered: board-specific selector → generic fallbacks, with a
 *    plausibility threshold so a thin/empty match falls through instead of
 *    winning. The path actually used is surfaced in a diagnostic log line.
 *  - Never fail silently. Every extraction run logs one structured [Shortlist]
 *    line. If nothing usable is found, the button says so and still opens the app.
 *
 * Supported: Greenhouse, Lever, Workday, Indeed, LinkedIn (view-only, no API)
 */

const SHORTLIST_APP_URL = "https://shortlist-amber.vercel.app";
const BTN_ID = "shortlist-ext-btn";
const MIN_JD_CHARS = 200; // a real JD is rarely shorter than this
const MAX_JD_CHARS = 12000; // stay well under the app's 20k ?jd= cap
const LOG_PREFIX = "[Shortlist]";

const JD_KEYWORDS = [
  "responsibilities",
  "requirements",
  "qualifications",
  "experience",
  "skills",
];

// ── Board detection (labels the log line + picks the selector set) ─────────────
// Because content_scripts.matches already restricts where this script runs, the
// script running at all means the board is supported. Detection never gates
// injection — it only chooses which selectors to try and what to log.

function detectBoard() {
  const host = location.hostname;
  const path = location.pathname;
  if (host.includes("greenhouse.io")) return "greenhouse";
  if (host.includes("lever.co")) return "lever";
  if (host.includes("workday.com") || host.includes("myworkdayjobs.com")) return "workday";
  if (host.includes("indeed.com")) return "indeed";
  if (
    host.includes("linkedin.com") &&
    (path.includes("/jobs/view/") || path.includes("/jobs/search/"))
  ) {
    return "linkedin";
  }
  return "unknown";
}

// Ordered, board-specific selectors. First one whose text clears MIN_JD_CHARS wins.
const BOARD_SELECTORS = {
  greenhouse: [
    "#content .job-post__description",
    ".job-post__content",
    "#job-post__content",
    "[class*='job-description']",
    ".posting-description",
  ],
  lever: [
    // Covers classic Lever (wealthfront) and newer layouts (metabase); anything
    // the threshold rejects here falls through to the generic layer below.
    "[data-qa='job-description']",
    ".posting-page",
    ".section-wrapper.page-full-width",
    ".content-wrapper",
    ".posting-requirements",
  ],
  workday: [
    "[data-automation-id='jobPostingDescription']",
    "[class*='job-description']",
    "[class*='jobDescription']",
  ],
  indeed: [
    "#jobDescriptionText",
    ".jobDescriptionText",
    "[class*='description']",
  ],
  linkedin: [
    ".jobs-description__content",
    ".jobs-description-content__text",
    "[class*='description__content']",
  ],
  unknown: [],
};

// ── Layered extraction ────────────────────────────────────────────────────────
// Returns { text, path, selector, length, board } — never bare text.
//   path: "board:<board>" | "generic:main" | "generic:article" |
//         "generic:largest" | "generic:body" | "none"

function cleanText(el) {
  if (!el) return "";
  return (el.innerText || "").trim();
}

function extractGeneric() {
  // 1. <main> / <article> — the semantic containers most boards use.
  const main = cleanText(document.querySelector("main"));
  if (main.length >= MIN_JD_CHARS) return { text: main, path: "generic:main" };

  const article = cleanText(document.querySelector("article"));
  if (article.length >= MIN_JD_CHARS) return { text: article, path: "generic:article" };

  // 2. Largest keyword-bearing text block.
  const candidates = Array.from(
    document.querySelectorAll(
      "section, article, div[class*='description'], div[class*='content'], main"
    )
  );
  const scored = candidates
    .map((el) => cleanText(el))
    .filter(
      (t) =>
        t.length >= MIN_JD_CHARS &&
        JD_KEYWORDS.some((kw) => t.toLowerCase().includes(kw))
    )
    .sort((a, b) => b.length - a.length);
  if (scored.length > 0) return { text: scored[0], path: "generic:largest" };

  // 3. document.body.innerText minus chrome (nav/header/footer/script/style).
  const body = document.body;
  if (body) {
    const chromeText = Array.from(
      document.querySelectorAll("nav, header, footer, script, style, noscript")
    )
      .map((el) => (el.innerText || "").trim())
      .filter(Boolean);
    let bodyText = (body.innerText || "").trim();
    for (const chunk of chromeText) {
      if (chunk.length > 0) bodyText = bodyText.split(chunk).join(" ");
    }
    bodyText = bodyText.replace(/\n{3,}/g, "\n\n").trim();
    if (bodyText.length >= MIN_JD_CHARS) return { text: bodyText, path: "generic:body" };
  }

  return { text: "", path: "none" };
}

function extractJobDescription() {
  const board = detectBoard();
  const selectors = BOARD_SELECTORS[board] || [];

  let lastSelectorTried = null;
  let bestText = "";

  // Board layer — first selector clearing the threshold wins.
  for (const sel of selectors) {
    lastSelectorTried = sel;
    let el;
    try {
      el = document.querySelector(sel);
    } catch {
      continue; // malformed selector — skip
    }
    const text = cleanText(el);
    if (text.length > bestText.length) bestText = text;
    if (text.length >= MIN_JD_CHARS) {
      return {
        text,
        path: `board:${board}`,
        selector: sel,
        length: text.length,
        board,
      };
    }
  }

  // Generic fallback layer.
  const generic = extractGeneric();
  if (generic.path !== "none") {
    return {
      text: generic.text,
      path: generic.path,
      selector: lastSelectorTried,
      length: generic.text.length,
      board,
    };
  }

  // Nothing usable — return the longest thing we saw (may be empty) as path:none.
  const fallbackText = bestText.length > generic.text.length ? bestText : generic.text;
  return {
    text: fallbackText,
    path: "none",
    selector: lastSelectorTried,
    length: fallbackText.length,
    board,
  };
}

// ── Diagnostic logging ────────────────────────────────────────────────────────
// One structured line per run. Never logs the JD text itself, only its length.

function logExtraction(result) {
  const selectorHit = result.path.startsWith("board:");
  console.info(
    `${LOG_PREFIX} board=${result.board} url=${location.pathname} ` +
      `selectorTried=${JSON.stringify(result.selector)} selectorHit=${selectorHit} ` +
      `chars=${result.length} path=${result.path}`
  );
}

// ── Button injection (self-healing) ───────────────────────────────────────────

function buildButton() {
  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.setAttribute("aria-label", "Shortlist this job");
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
    <span>Shortlist this job</span>
  `;
  btn.addEventListener("click", onButtonClick);
  return btn;
}

function ensureStyle() {
  if (document.getElementById("shortlist-ext-style")) return;
  const style = document.createElement("style");
  style.id = "shortlist-ext-style";
  style.textContent = `
    #${BTN_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #2F4A3C;
      color: #FAF9F6;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(30, 25, 18, 0.18);
      transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      white-space: nowrap;
    }
    #${BTN_ID}:hover {
      background: #24382D;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(30, 25, 18, 0.24);
    }
    #${BTN_ID}:active { transform: translateY(0); }
    #${BTN_ID}.shortlist-error { background: #8F3A28; }
    #${BTN_ID}.shortlist-error:hover { background: #7A3122; }
    #${BTN_ID} svg { flex-shrink: 0; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function setButtonLabel(text) {
  const span = document.getElementById(BTN_ID)?.querySelector("span");
  if (span) span.textContent = text;
}

function resetButton() {
  const btn = document.getElementById(BTN_ID);
  if (!btn) return;
  btn.classList.remove("shortlist-error");
  setButtonLabel("Shortlist this job");
}

function ensureButton(reason) {
  if (!document.body) return;
  if (document.getElementById(BTN_ID)) return;
  ensureStyle();
  document.body.appendChild(buildButton());
  if (reason === "reinject") {
    console.info(`${LOG_PREFIX} re-injecting (button was removed)`);
  } else {
    console.info(`${LOG_PREFIX} button injected (board=${detectBoard()})`);
  }
}

// ── Click handler + visible failure state ─────────────────────────────────────

function onButtonClick() {
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.classList.remove("shortlist-error");
  setButtonLabel("Opening Shortlist");

  const result = extractJobDescription();
  logExtraction(result);

  if (result.path === "none" || result.text.length < MIN_JD_CHARS) {
    // Nothing usable — tell the user clearly and still open the app (empty).
    if (btn) btn.classList.add("shortlist-error");
    setButtonLabel("Couldn't read this posting — paste manually");
    window.open(`${SHORTLIST_APP_URL}/generate`, "_blank");
    setTimeout(resetButton, 4000);
    return;
  }

  const encoded = encodeURIComponent(result.text.slice(0, MAX_JD_CHARS));
  window.open(`${SHORTLIST_APP_URL}/generate?jd=${encoded}`, "_blank");
  setTimeout(resetButton, 1200);
}

// ── Boot + resilience (self-heal on DOM re-render, re-log on SPA nav) ──────────

let lastUrl = location.href;
let scheduled = false;

function scheduleEnsure(reason) {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    ensureButton(reason);
  });
}

// Inject as soon as the body exists (don't wait on a fixed timer).
if (document.body) {
  ensureButton();
} else {
  document.addEventListener("DOMContentLoaded", () => ensureButton(), { once: true });
}

// One persistent observer handles both concerns:
//  - self-heal: re-append the button whenever a board re-render wipes it
//  - SPA nav: reset the button + emit a fresh diagnostic when the posting changes
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    resetButton();
    console.info(`${LOG_PREFIX} navigation → ${location.pathname} (board=${detectBoard()})`);
  }
  if (document.body && !document.getElementById(BTN_ID)) {
    scheduleEnsure("reinject");
  }
}).observe(document.documentElement, { subtree: true, childList: true });

// ── Test-only exports ─────────────────────────────────────────────────────────
// `module` is undefined in a Chrome content script, so this block is inert in
// the browser. It exists so the Vitest suite can exercise the extraction /
// normalization logic against fixture DOMs.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    detectBoard,
    extractJobDescription,
    BOARD_SELECTORS,
    MIN_JD_CHARS,
    MAX_JD_CHARS,
  };
}
